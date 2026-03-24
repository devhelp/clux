import { Command } from 'commander';
import { TmuxSessionManager } from '@clux-cli/core';
import chalk from 'chalk';
import { printSessionDetails } from '../format';

export function registerInfoCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('info <name>')
    .description('Show detailed info about a session')
    .action(async (name: string) => {
      try {
        const session = await manager.getSession(name);
        const record = manager.store.get(name);

        printSessionDetails(session);

        if (record) {
          console.log('');
          if (record.description)
            console.log(`  ${chalk.cyan('Description:')} ${record.description}`);
          if (record.projectPath)
            console.log(`  ${chalk.cyan('Project:')}     ${record.projectPath}`);
          if (record.command) console.log(`  ${chalk.cyan('Command:')}     ${record.command}`);
          if (record.tags.length)
            console.log(`  ${chalk.cyan('Tags:')}        ${record.tags.join(', ')}`);
          console.log(`  ${chalk.cyan('Commands:')}    ${record.commandsSent} sent`);
          console.log(
            `  ${chalk.cyan('Last active:')} ${new Date(record.lastActivity).toLocaleString()}`,
          );
        }
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
