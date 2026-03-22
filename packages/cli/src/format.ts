import chalk from 'chalk';
import type { TmuxSession } from '@clux/core';

export function printSessionDetails(session: TmuxSession): void {
  console.log(`\n  ${chalk.bold(session.name)}`);
  console.log(
    `  Status:  ${session.isAttached ? chalk.green('attached') : chalk.yellow('detached')}`,
  );
  console.log(`  Created: ${session.createdAt.toLocaleString()}`);

  for (const win of session.windows) {
    console.log(
      `\n  ${chalk.cyan(`Window ${win.index}: ${win.name}`)} ${win.isActive ? chalk.green('(active)') : ''}`,
    );
    for (const pane of win.panes) {
      console.log(
        `    Pane ${pane.index}: ${pane.width}x${pane.height}  pid=${pane.pid}  ${chalk.dim(pane.currentPath)}`,
      );
    }
  }
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
