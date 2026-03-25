import { execFile } from 'child_process';
import { promisify } from 'util';
import type { TmuxSession } from './types';

const execFileAsync = promisify(execFile);

export async function getClaudeParentPids(): Promise<Set<number>> {
  const pids = new Set<number>();
  try {
    const { stdout } = await execFileAsync('ps', ['-eo', 'ppid,comm']);
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const comm = match[2];
        if (comm === 'claude' || comm.endsWith('/claude')) {
          pids.add(parseInt(match[1]));
        }
      }
    }
  } catch (err) {
    console.warn('Failed to detect LLM processes via ps:', (err as Error).message);
  }
  return pids;
}

export async function enrichWithClaudeDetection(sessions: TmuxSession[]): Promise<void> {
  const claudeParents = await getClaudeParentPids();
  for (const session of sessions) {
    for (const win of session.windows) {
      for (const pane of win.panes) {
        if (claudeParents.has(pane.pid)) {
          pane.currentCommand = 'claude';
        }
      }
    }
  }
}
