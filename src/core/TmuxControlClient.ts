import { ChildProcess, spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execFileAsync = promisify(execFile);

export interface PaneOutputEvent {
  tmuxPaneId: string;
  windowPane: string | null;
  data: string;
}

export class TmuxControlClient extends EventEmitter {
  private proc: ChildProcess | null = null;
  private buffer = '';
  private sessionName: string;
  private destroyed = false;

  private paneToWindow = new Map<string, string>();
  private windowToPane = new Map<string, string>();

  private pendingCmd: {
    resolve: (output: string) => void;
    reject: (err: Error) => void;
    lines: string[];
  } | null = null;
  private cmdQueue: Array<{
    cmd: string;
    resolve: (output: string) => void;
    reject: (err: Error) => void;
  }> = [];
  private inBlock = false;
  private initialBlockDone = false;

  constructor(sessionName: string) {
    super();
    this.sessionName = sessionName;
  }

  get name(): string {
    return this.sessionName;
  }

  get isConnected(): boolean {
    return !this.destroyed && this.proc !== null;
  }

  async connect(): Promise<void> {
    if (this.destroyed) throw new Error('Client has been destroyed');

    await this.refreshPaneMap();

    return new Promise<void>((resolve, reject) => {
      this.proc = spawn('tmux', ['-C', 'attach-session', '-t', this.sessionName, '-r'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let settled = false;

      this.proc.stdout!.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
        if (!settled && this.initialBlockDone) {
          settled = true;
          resolve();
        }
      });

      this.proc.stderr!.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg && !settled) {
          settled = true;
          reject(new Error(`tmux control mode: ${msg}`));
        }
      });

      this.proc.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
        this.emit('error', err);
      });

      this.proc.on('close', (code) => {
        if (!settled) {
          settled = true;
          reject(new Error(`tmux control mode exited with code ${code}`));
        }
        this.emit('close', code);
        this.doCleanup();
      });

      setTimeout(() => {
        if (!settled) {
          settled = true;
          this.initialBlockDone = true;
          resolve();
        }
      }, 3000);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      this.processLine(line);
    }
  }

  private processLine(line: string): void {
    if (line.startsWith('%begin ')) {
      this.inBlock = true;
      return;
    }

    if (line.startsWith('%end ')) {
      this.inBlock = false;
      if (!this.initialBlockDone) this.initialBlockDone = true;
      if (this.pendingCmd) {
        const cmd = this.pendingCmd;
        this.pendingCmd = null;
        cmd.resolve(cmd.lines.join('\n'));
      }
      this.drainQueue();
      return;
    }

    if (line.startsWith('%error ')) {
      this.inBlock = false;
      if (!this.initialBlockDone) this.initialBlockDone = true;
      if (this.pendingCmd) {
        const cmd = this.pendingCmd;
        this.pendingCmd = null;
        cmd.reject(new Error(cmd.lines.join('\n') || 'tmux command failed'));
      }
      this.drainQueue();
      return;
    }

    if (this.inBlock && this.pendingCmd) {
      this.pendingCmd.lines.push(line);
      return;
    }

    if (this.inBlock) return;

    if (line.startsWith('%output ')) {
      const firstSpace = 8;
      const secondSpace = line.indexOf(' ', firstSpace);
      if (secondSpace === -1) return;

      const tmuxPaneId = line.substring(firstSpace, secondSpace);
      const escapedData = line.substring(secondSpace + 1);
      const data = this.unescapeData(escapedData);
      const windowPane = this.paneToWindow.get(tmuxPaneId) || null;

      this.emit('pane-output', {
        tmuxPaneId,
        windowPane,
        data,
      } as PaneOutputEvent);
      return;
    }

    if (
      line.startsWith('%layout-change') ||
      line.startsWith('%window-add') ||
      line.startsWith('%window-close') ||
      line.startsWith('%window-renamed') ||
      line.startsWith('%session-window-changed')
    ) {
      this.refreshPaneMap().catch(() => {});
      this.emit('structure-change', line);
      return;
    }

    if (line.startsWith('%exit')) {
      this.emit('exit');
      return;
    }
  }

  private unescapeData(data: string): string {
    let result = '';
    let i = 0;
    while (i < data.length) {
      if (data[i] === '\\' && i + 1 < data.length) {
        if (data[i + 1] >= '0' && data[i + 1] <= '7') {
          let oct = '';
          let j = i + 1;
          while (j < data.length && j < i + 4 && data[j] >= '0' && data[j] <= '7') {
            oct += data[j];
            j++;
          }
          result += String.fromCharCode(parseInt(oct, 8));
          i = j;
        } else if (data[i + 1] === '\\') {
          result += '\\';
          i += 2;
        } else {
          result += data[i];
          i++;
        }
      } else {
        result += data[i];
        i++;
      }
    }
    return result;
  }

  async command(cmd: string): Promise<string> {
    if (this.destroyed || !this.proc) throw new Error('Control client not connected');
    return new Promise((resolve, reject) => {
      this.cmdQueue.push({ cmd, resolve, reject });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    if (this.pendingCmd || this.cmdQueue.length === 0) return;
    if (!this.proc?.stdin?.writable) return;
    const { cmd, resolve, reject } = this.cmdQueue.shift()!;
    this.pendingCmd = { resolve, reject, lines: [] };
    this.proc.stdin.write(cmd + '\n');
  }

  async refreshPaneMap(): Promise<void> {
    try {
      const { stdout } = await execFileAsync('tmux', [
        'list-panes',
        '-s',
        '-t',
        this.sessionName,
        '-F',
        '#{pane_id}|#{window_index}.#{pane_index}',
      ]);
      this.paneToWindow.clear();
      this.windowToPane.clear();
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        const [tmuxId, wp] = line.split('|');
        this.paneToWindow.set(tmuxId, wp);
        this.windowToPane.set(wp, tmuxId);
      }
    } catch {}
  }

  getWindowPane(tmuxPaneId: string): string | undefined {
    return this.paneToWindow.get(tmuxPaneId);
  }

  getTmuxPaneId(windowPane: string): string | undefined {
    return this.windowToPane.get(windowPane);
  }

  private doCleanup(): void {
    this.destroyed = true;
    this.paneToWindow.clear();
    this.windowToPane.clear();
    if (this.pendingCmd) {
      this.pendingCmd.reject(new Error('Control client disconnected'));
      this.pendingCmd = null;
    }
    for (const cmd of this.cmdQueue) {
      cmd.reject(new Error('Control client disconnected'));
    }
    this.cmdQueue = [];
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.proc) {
      try {
        this.proc.stdin?.write('detach\n');
      } catch {}
      setTimeout(() => {
        try {
          this.proc?.kill('SIGTERM');
        } catch {}
        this.proc = null;
      }, 500);
    }
    this.doCleanup();
    this.removeAllListeners();
  }
}
