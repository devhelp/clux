import { Command } from 'commander';
import { TmuxSessionManager } from '@clux/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { formatRelativeTime } from '../format';

export function registerListCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('list')
    .alias('ls')
    .description('List all tmux sessions')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-s, --search <query>', 'Search sessions')
    .action(async (opts) => {
      let sessions = await manager.listSessions();

      if (opts.tag) {
        const matching = manager.store.findByTag(opts.tag);
        const names = new Set(matching.map((r) => r.name));
        sessions = sessions.filter((s) => names.has(s.name));
      }
      if (opts.search) {
        const matching = manager.store.search(opts.search);
        const names = new Set(matching.map((r) => r.name));
        sessions = sessions.filter((s) => names.has(s.name));
      }

      if (sessions.length === 0) {
        console.log(chalk.yellow('No active tmux sessions.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.cyan('Name'),
          chalk.cyan('Status'),
          chalk.cyan('Win'),
          chalk.cyan('Panes'),
          chalk.cyan('Cmds'),
          chalk.cyan('Tags'),
          chalk.cyan('Created'),
        ],
        style: { head: [], border: ['dim'] },
      });

      for (const s of sessions) {
        const totalPanes = s.windows.reduce((sum, w) => sum + w.panes.length, 0);
        const tags = s.metadata?.tags?.join(', ') || '';
        const cmds = s.metadata?.commandsSent ?? '';

        table.push([
          chalk.bold(s.name),
          s.isAttached ? chalk.green('attached') : chalk.yellow('detached'),
          String(s.windows.length),
          String(totalPanes),
          String(cmds),
          chalk.dim(tags),
          formatRelativeTime(s.createdAt),
        ]);
      }

      console.log(table.toString());
    });
}
