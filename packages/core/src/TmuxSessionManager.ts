import { execFile } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import type {
  TmuxSession,
  TmuxWindow,
  TmuxPane,
  ProjectConfig,
  PaneOutput,
  SendKeysOptions,
  SessionEvent,
} from './types';
import { SessionStore } from './SessionStore';
import { TmuxControlClient } from './TmuxControlClient';
import { parseTerminalSequences } from './TerminalParser';
import { enrichWithClaudeDetection } from './ProcessDetector';

const execFileAsync = promisify(execFile);

export class TmuxSessionManager extends EventEmitter {
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private paneBufferCache = new Map<string, string>();
  private pendingCaptures = new Map<string, NodeJS.Timeout>();
  private controlClients = new Map<string, TmuxControlClient>();
  public store: SessionStore;

  constructor(dbPath?: string) {
    super();
    this.store = new SessionStore(dbPath);
  }

  private validateName(name: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        `Invalid session name: "${name}". Only alphanumeric, dash, and underscore allowed.`,
      );
    }
  }

  private validatePaneId(paneId: string): void {
    if (!/^\d+\.\d+$/.test(paneId)) {
      throw new Error(`Invalid pane ID: "${paneId}". Expected format: N.N (e.g., 0.0)`);
    }
  }

  private validateWindowIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid window index: ${index}`);
    }
  }

  async createSession(config: ProjectConfig): Promise<TmuxSession> {
    const name = this.sanitize(config.projectName);

    if (await this.sessionExists(name)) {
      throw new Error(`Session "${name}" already exists`);
    }

    await this.tmux('new-session', '-d', '-s', name, '-c', config.projectPath);
    await this.tmux('set-option', '-t', name, 'history-limit', '50000');
    await this.tmux('rename-window', '-t', `${name}:0`, 'main');

    if (config.command) {
      await this.sendKeys(name, '0.0', config.command);
      await this.delay(500);
    }

    if (config.layout) {
      await this.tmux('select-layout', '-t', `${name}:0`, config.layout).catch(() => {});
    }

    const session = await this.getSession(name);

    const now = new Date().toISOString();
    this.store.save({
      name,
      projectPath: config.projectPath,
      description: null,
      tags: [],
      command: config.command || null,
      template: null,
      createdAt: now,
      lastActivity: now,
      commandsSent: 0,
    });

    this.emitEvent('created', name);
    return session;
  }

  async sessionExists(name: string): Promise<boolean> {
    this.validateName(name);
    try {
      await this.tmux('has-session', '-t', name);
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<TmuxSession[]> {
    try {
      const { stdout } = await this.tmux(
        'list-sessions',
        '-F',
        '#{session_name}|#{session_created}|#{session_attached}',
      );
      if (!stdout.trim()) return [];

      const sessions: TmuxSession[] = [];
      for (const line of stdout.trim().split('\n')) {
        const [name, created, attached] = line.split('|');
        const record = this.store.get(name);
        sessions.push({
          name,
          createdAt: new Date(parseInt(created) * 1000),
          isAttached: attached === '1',
          windows: await this.getWindows(name),
          metadata: record
            ? {
                projectPath: record.projectPath || undefined,
                description: record.description || undefined,
                tags: record.tags,
                command: record.command || undefined,
                commandsSent: record.commandsSent,
              }
            : undefined,
        });
      }
      await enrichWithClaudeDetection(sessions);
      return sessions;
    } catch {
      return [];
    }
  }

  async getSession(name: string): Promise<TmuxSession> {
    this.validateName(name);
    if (!(await this.sessionExists(name))) {
      throw new Error(`Session "${name}" not found`);
    }

    const { stdout } = await this.tmux(
      'list-sessions',
      '-F',
      '#{session_name}|#{session_created}|#{session_attached}',
      '-f',
      `#{==:#{session_name},${name}}`,
    );
    const [, created, attached] = stdout.trim().split('|');

    return {
      name,
      createdAt: new Date(parseInt(created) * 1000),
      isAttached: attached === '1',
      windows: await this.getWindows(name),
    };
  }

  async killSession(name: string): Promise<void> {
    this.validateName(name);
    this.stopMonitoring(name);
    if (await this.sessionExists(name)) {
      await this.tmux('kill-session', '-t', name);
    }
    this.store.delete(name);
    this.emitEvent('killed', name);
  }

  async addWindow(sessionName: string, windowName: string, command?: string): Promise<void> {
    this.validateName(sessionName);
    await this.tmux('new-window', '-a', '-t', sessionName, '-n', windowName);
    if (command) {
      const windows = await this.getWindows(sessionName);
      const lastWindow = windows[windows.length - 1];
      await this.sendKeys(sessionName, `${lastWindow.index}.0`, command);
    }
    this.emitEvent('window-added', sessionName, undefined, { windowName, command });
  }

  async renameWindow(sessionName: string, windowIndex: number, newName: string): Promise<void> {
    this.validateName(sessionName);
    this.validateWindowIndex(windowIndex);
    await this.tmux('rename-window', '-t', `${sessionName}:${windowIndex}`, newName);
    this.emitEvent('window-renamed', sessionName, undefined, { windowIndex, newName });
  }

  async killPane(sessionName: string, paneId: string): Promise<void> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    await this.tmux('kill-pane', '-t', `${sessionName}:${paneId}`);
  }

  async sendKeys(
    sessionName: string,
    paneId: string,
    text: string,
    options: SendKeysOptions = {},
  ): Promise<void> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const target = `${sessionName}:${paneId}`;

    if (options.literal) {
      await this.tmux('send-keys', '-t', target, '-l', text);
    } else {
      await this.tmux('send-keys', '-t', target, text);
    }

    if (!options.noEnter) {
      await this.tmux('send-keys', '-t', target, 'Enter');
    }

    this.store.incrementCommandsSent(sessionName);
    this.emitEvent('keys-sent', sessionName, paneId, { text });
  }

  async sendSpecialKey(sessionName: string, paneId: string, key: string): Promise<void> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    await this.tmux('send-keys', '-t', `${sessionName}:${paneId}`, key);
  }

  async resizePane(sessionName: string, paneId: string, cols: number, rows: number): Promise<void> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const target = `${sessionName}:${paneId}`;
    await this.tmux('resize-window', '-t', target, '-x', String(cols), '-y', String(rows));
  }

  async sendRawInput(sessionName: string, paneId: string, data: string): Promise<void> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const target = `${sessionName}:${paneId}`;
    const seqs = parseTerminalSequences(data);

    for (const seq of seqs) {
      if (seq.type === 'key') {
        await execFileAsync('tmux', ['send-keys', '-t', target, seq.value]);
      } else {
        await execFileAsync('tmux', ['send-keys', '-t', target, '-l', seq.value]);
      }
    }

    this.triggerImmediateCapture(sessionName, paneId);
  }

  async capturePane(sessionName: string, paneId: string, lines = 100): Promise<PaneOutput> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const { stdout } = await this.tmux(
      'capture-pane',
      '-t',
      `${sessionName}:${paneId}`,
      '-e',
      '-p',
      '-S',
      `-${lines}`,
    );
    return {
      sessionName,
      paneId,
      content: stdout,
      timestamp: new Date(),
      lines: stdout.split('\n').length,
    };
  }

  async capturePaneVisible(sessionName: string, paneId: string): Promise<PaneOutput> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const { stdout } = await this.tmux(
      'capture-pane',
      '-t',
      `${sessionName}:${paneId}`,
      '-e',
      '-p',
    );
    return {
      sessionName,
      paneId,
      content: stdout,
      timestamp: new Date(),
      lines: stdout.split('\n').length,
    };
  }

  async capturePaneAll(sessionName: string, paneId: string): Promise<PaneOutput> {
    this.validateName(sessionName);
    this.validatePaneId(paneId);
    const { stdout } = await this.tmux(
      'capture-pane',
      '-t',
      `${sessionName}:${paneId}`,
      '-e',
      '-p',
      '-S',
      '-',
    );
    return {
      sessionName,
      paneId,
      content: stdout,
      timestamp: new Date(),
      lines: stdout.split('\n').length,
    };
  }

  async getControlClient(sessionName: string): Promise<TmuxControlClient> {
    this.validateName(sessionName);
    let client = this.controlClients.get(sessionName);
    if (client?.isConnected) return client;

    if (client) {
      client.destroy();
      this.controlClients.delete(sessionName);
    }

    client = new TmuxControlClient(sessionName);
    client.on('close', () => {
      this.controlClients.delete(sessionName);
    });

    await client.connect();
    this.controlClients.set(sessionName, client);
    return client;
  }

  destroyControlClient(sessionName: string): void {
    const client = this.controlClients.get(sessionName);
    if (client) {
      client.destroy();
      this.controlClients.delete(sessionName);
    }
  }

  hasControlClient(sessionName: string): boolean {
    const client = this.controlClients.get(sessionName);
    return !!client?.isConnected;
  }

  triggerImmediateCapture(sessionName: string, paneId: string): void {
    if (this.controlClients.has(sessionName)) return;

    const key = `${sessionName}:${paneId}`;
    const existing = this.pendingCaptures.get(key);
    if (existing) clearTimeout(existing);

    this.pendingCaptures.set(
      key,
      setTimeout(async () => {
        this.pendingCaptures.delete(key);
        try {
          const output = await this.capturePaneVisible(sessionName, paneId);
          const cached = this.paneBufferCache.get(key);
          if (output.content !== cached) {
            this.paneBufferCache.set(key, output.content);
            this.emitEvent('output-changed', sessionName, paneId, {
              content: output.content,
            });
          }
        } catch {}
      }, 16),
    );
  }

  async exportSessionMarkdown(sessionName: string): Promise<string> {
    const session = await this.getSession(sessionName);
    const record = this.store.get(sessionName);
    const lines: string[] = [];

    lines.push(`# Session: ${sessionName}`);
    lines.push('');
    lines.push(`- **Status:** ${session.isAttached ? 'attached' : 'detached'}`);
    lines.push(`- **Created:** ${session.createdAt.toLocaleString()}`);
    if (record?.projectPath) lines.push(`- **Project:** ${record.projectPath}`);
    if (record?.command) lines.push(`- **Command:** ${record.command}`);
    if (record?.description) lines.push(`- **Description:** ${record.description}`);
    if (record?.tags.length) lines.push(`- **Tags:** ${record.tags.join(', ')}`);
    if (record?.commandsSent) lines.push(`- **Commands sent:** ${record.commandsSent}`);
    lines.push('');

    for (const win of session.windows) {
      for (const pane of win.panes) {
        const paneId = `${win.index}.${pane.index}`;
        lines.push(`## Window ${win.index} (${win.name}) — Pane ${pane.index}`);
        lines.push('');
        lines.push(`- **Size:** ${pane.width}x${pane.height}`);
        lines.push(`- **Path:** ${pane.currentPath}`);
        lines.push('');

        try {
          const output = await this.capturePaneAll(sessionName, paneId);
          const clean = output.content.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
          lines.push('```');
          lines.push(clean.trimEnd());
          lines.push('```');
        } catch {
          lines.push('*(pane capture unavailable)*');
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*Exported at ${new Date().toLocaleString()} by Clux*`);

    return lines.join('\n');
  }

  startMonitoringPane(sessionName: string, paneId: string, intervalMs = 1000): void {
    const key = `${sessionName}:${paneId}`;
    if (this.monitoringIntervals.has(key)) {
      this.stopMonitoringPane(sessionName, paneId);
    }

    const interval = setInterval(async () => {
      try {
        const output = await this.capturePaneVisible(sessionName, paneId);
        const cached = this.paneBufferCache.get(key);

        if (output.content !== cached) {
          this.paneBufferCache.set(key, output.content);
          this.emitEvent('output-changed', sessionName, paneId, {
            content: output.content,
          });
        }
      } catch {
        this.stopMonitoringPane(sessionName, paneId);
      }
    }, intervalMs);

    this.monitoringIntervals.set(key, interval);
  }

  async startMonitoringSession(sessionName: string, intervalMs = 1000): Promise<void> {
    const session = await this.getSession(sessionName);
    for (const window of session.windows) {
      for (const pane of window.panes) {
        this.startMonitoringPane(sessionName, `${window.index}.${pane.index}`, intervalMs);
      }
    }
  }

  stopMonitoringPane(sessionName: string, paneId: string): void {
    const key = `${sessionName}:${paneId}`;
    const interval = this.monitoringIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(key);
      this.paneBufferCache.delete(key);
    }
  }

  stopMonitoring(sessionName?: string): void {
    for (const [key, interval] of this.monitoringIntervals) {
      if (!sessionName || key.startsWith(`${sessionName}:`)) {
        clearInterval(interval);
        this.monitoringIntervals.delete(key);
        this.paneBufferCache.delete(key);
      }
    }
  }

  async getWindows(sessionName: string): Promise<TmuxWindow[]> {
    try {
      const { stdout } = await this.tmux(
        'list-windows',
        '-t',
        sessionName,
        '-F',
        '#{window_index}|#{window_name}|#{window_active}',
      );
      const windows: TmuxWindow[] = [];
      for (const line of stdout.trim().split('\n')) {
        const [index, name, active] = line.split('|');
        windows.push({
          index: parseInt(index),
          name,
          isActive: active === '1',
          panes: await this.getPanes(sessionName, parseInt(index)),
        });
      }
      return windows;
    } catch {
      return [];
    }
  }

  async getPanes(sessionName: string, windowIndex: number): Promise<TmuxPane[]> {
    try {
      const { stdout } = await this.tmux(
        'list-panes',
        '-t',
        `${sessionName}:${windowIndex}`,
        '-F',
        '#{pane_index}|#{pane_active}|#{pane_width}|#{pane_height}|#{pane_pid}|#{pane_current_path}|#{pane_current_command}',
      );
      return stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [index, active, width, height, pid, currentPath, currentCommand] = line.split('|');
          return {
            id: `${sessionName}:${windowIndex}.${index}`,
            index: parseInt(index),
            isActive: active === '1',
            width: parseInt(width),
            height: parseInt(height),
            pid: parseInt(pid),
            currentPath,
            currentCommand: currentCommand || undefined,
          };
        });
    } catch {
      return [];
    }
  }

  async sendToAgent(sessionName: string, paneId: string, message: string): Promise<void> {
    await this.sendKeys(sessionName, paneId, message);
  }

  async relayMessage(
    sessionName: string,
    fromPaneId: string,
    toPaneId: string,
    message: string,
  ): Promise<void> {
    await this.sendKeys(sessionName, toPaneId, message);
    this.emitEvent('message-relayed', sessionName, toPaneId, { from: fromPaneId, message });
  }

  async relayCapturedOutput(
    sessionName: string,
    fromPaneId: string,
    toPaneId: string,
    lines = 50,
  ): Promise<void> {
    const output = await this.capturePane(sessionName, fromPaneId, lines);
    const clean = output.content.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
    const message = `[Output from pane ${fromPaneId}]:\n${clean}`;
    await this.sendKeys(sessionName, toPaneId, message);
    this.emitEvent('message-relayed', sessionName, toPaneId, { from: fromPaneId, lines });
  }

  private sanitize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  private async tmux(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('tmux', args);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private emitEvent(
    type: SessionEvent['type'],
    sessionName: string,
    paneId?: string,
    data?: unknown,
  ): void {
    const event: SessionEvent = {
      type,
      sessionName,
      paneId,
      data,
      timestamp: new Date(),
    };
    this.emit(type, event);
    this.emit('event', event);
  }

  destroy(): void {
    this.stopMonitoring();
    for (const client of this.controlClients.values()) client.destroy();
    this.controlClients.clear();
    this.removeAllListeners();
    this.store.close();
  }
}
