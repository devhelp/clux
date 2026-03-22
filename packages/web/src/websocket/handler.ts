import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { TmuxSessionManager } from '@clux/core';
import type { PaneOutputEvent, TmuxControlClient } from '@clux/core';

const subscribers = new Map<string, Set<WebSocket>>();
const sessionMode = new Map<string, 'control' | 'poll'>();
const controlListenerSessions = new Set<string>();
const pendingCaptures = new Map<string, NodeJS.Timeout>();

async function captureAndBroadcast(
  manager: TmuxSessionManager,
  session: string,
  paneId: string,
  key: string,
): Promise<void> {
  try {
    const output = await manager.capturePaneVisible(session, paneId);
    const subs = subscribers.get(key);
    if (!subs || subs.size === 0) return;

    const msg = JSON.stringify({
      type: 'output',
      sessionName: session,
      paneId,
      content: output.content,
      timestamp: output.timestamp,
    });

    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  } catch {
    // pane may have been closed
  }
}

function setupControlListener(
  manager: TmuxSessionManager,
  session: string,
  client: TmuxControlClient,
): void {
  if (controlListenerSessions.has(session)) return;
  controlListenerSessions.add(session);

  client.on('pane-output', (event: PaneOutputEvent) => {
    if (!event.windowPane) return;
    const key = `${session}:${event.windowPane}`;
    const subs = subscribers.get(key);
    if (!subs || subs.size === 0) return;

    const existing = pendingCaptures.get(key);
    if (existing) clearTimeout(existing);
    pendingCaptures.set(
      key,
      setTimeout(() => {
        pendingCaptures.delete(key);
        captureAndBroadcast(manager, session, event.windowPane!, key);
      }, 30),
    );
  });

  client.on('close', () => {
    controlListenerSessions.delete(session);
    sessionMode.delete(session);
    for (const [key, timer] of pendingCaptures) {
      if (key.startsWith(`${session}:`)) {
        clearTimeout(timer);
        pendingCaptures.delete(key);
      }
    }
  });
}

function cleanupSubscription(
  manager: TmuxSessionManager,
  ws: WebSocket,
  session: string | null,
  pane: string | null,
) {
  if (!session || !pane) return;
  const key = `${session}:${pane}`;

  const subs = subscribers.get(key);
  if (!subs) return;
  subs.delete(ws);

  if (subs.size === 0) {
    subscribers.delete(key);

    const mode = sessionMode.get(session);

    if (mode === 'poll') {
      manager.stopMonitoringPane(session, pane);
    }

    let sessionHasSubs = false;
    for (const k of subscribers.keys()) {
      if (k.startsWith(`${session}:`)) {
        sessionHasSubs = true;
        break;
      }
    }

    if (!sessionHasSubs) {
      if (mode === 'control') {
        manager.destroyControlClient(session);
        controlListenerSessions.delete(session);
      }
      sessionMode.delete(session);
    }
  }
}

export function setupWebSocket(server: Server, manager: TmuxSessionManager): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let subscribedSession: string | null = null;
    let subscribedPane: string | null = null;

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'subscribe': {
            const oldSession = subscribedSession;
            const oldPane = subscribedPane;

            subscribedSession = msg.session;
            subscribedPane = msg.pane || '0.0';
            const key = `${subscribedSession}:${subscribedPane}`;

            if (!subscribers.has(key)) subscribers.set(key, new Set());
            subscribers.get(key)!.add(ws);

            cleanupSubscription(manager, ws, oldSession, oldPane);

            try {
              const targetPane = subscribedPane!;
              const targetSession = subscribedSession!;
              const output = await manager.capturePaneVisible(targetSession, targetPane);
              if (subscribedPane === targetPane && subscribedSession === targetSession) {
                ws.send(JSON.stringify({ type: 'output', ...output }));
              }
            } catch (err) {
              console.error(`capturePane failed for ${subscribedSession}:${subscribedPane}:`, err);
            }

            const mode = sessionMode.get(subscribedSession!);
            if (mode === 'control') {
              // already active
            } else if (mode === 'poll') {
              manager.startMonitoringPane(subscribedSession!, subscribedPane!, 500);
            } else {
              try {
                const client = await manager.getControlClient(subscribedSession!);
                setupControlListener(manager, subscribedSession!, client);
                sessionMode.set(subscribedSession!, 'control');
              } catch {
                sessionMode.set(subscribedSession!, 'poll');
                manager.startMonitoringPane(subscribedSession!, subscribedPane!, 500);
              }
            }
            break;
          }
          case 'unsubscribe': {
            cleanupSubscription(manager, ws, subscribedSession, subscribedPane);
            subscribedSession = null;
            subscribedPane = null;
            break;
          }
          case 'send': {
            if (msg.session && msg.text) {
              await manager.sendKeys(msg.session, msg.pane || '0.0', msg.text, {
                literal: msg.literal || false,
                noEnter: msg.noEnter || false,
              });
            }
            break;
          }
          case 'special-key': {
            if (msg.session && msg.key) {
              await manager.sendSpecialKey(msg.session, msg.pane || '0.0', msg.key);
            }
            break;
          }
          case 'input': {
            if (msg.session && msg.data) {
              await manager.sendRawInput(msg.session, msg.pane || '0.0', msg.data);
            }
            break;
          }
          case 'resize': {
            // Resize disabled — GUI is read-only and should not
            // affect terminal size for other attached clients.
            break;
          }
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
      }
    });

    ws.on('close', () => {
      cleanupSubscription(manager, ws, subscribedSession, subscribedPane);
    });
  });

  manager.on('output-changed', (event) => {
    const mode = sessionMode.get(event.sessionName);
    if (mode === 'control') return;

    const key = `${event.sessionName}:${event.paneId}`;
    const subs = subscribers.get(key);
    if (subs) {
      const msg = JSON.stringify({
        type: 'output',
        sessionName: event.sessionName,
        paneId: event.paneId,
        content: (event.data as any).content,
        timestamp: event.timestamp,
      });
      for (const ws of subs) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  });
}
