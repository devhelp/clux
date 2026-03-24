import { Command } from 'commander';
import { TmuxSessionManager } from '@clux-cli/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import { formatRelativeTime } from '../format';

export function registerStatsCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('stats [session]')
    .description('Show session statistics')
    .action(async (session?: string) => {
      const stats = manager.store.getStats(session);

      if (stats.totalSessions === 0) {
        console.log(chalk.yellow(session ? `No data for "${session}".` : 'No session data yet.'));
        return;
      }

      if (!session) {
        console.log(chalk.bold(`\n  Overall Statistics`));
        console.log(`  Total sessions: ${chalk.cyan(String(stats.totalSessions))}`);
        console.log(`  Total commands:  ${chalk.cyan(String(stats.totalCommands))}`);
        console.log('');
      }

      const table = new Table({
        head: [
          chalk.cyan('Session'),
          chalk.cyan('Commands'),
          chalk.cyan('Duration'),
          chalk.cyan('Last Active'),
          chalk.cyan('Template'),
          chalk.cyan('Project'),
        ],
        style: { head: [], border: ['dim'] },
      });

      for (const s of stats.sessions) {
        table.push([
          chalk.bold(s.name),
          String(s.commandsSent),
          s.durationHuman,
          formatRelativeTime(new Date(s.lastActivity)),
          s.template || chalk.dim('-'),
          chalk.dim(s.projectPath || '-'),
        ]);
      }

      console.log(table.toString());
    });
}
