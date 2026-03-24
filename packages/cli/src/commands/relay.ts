import { Command } from 'commander';
import { TmuxSessionManager } from '@clux-cli/core';
import chalk from 'chalk';

export function registerRelayCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('relay <session>')
    .description('Relay a message between panes (inter-agent communication)')
    .requiredOption('--from <paneId>', 'Source pane ID (e.g. 0.0)')
    .requiredOption('--to <paneId>', 'Target pane ID (e.g. 0.1)')
    .option('-m, --message <text>', 'Message to relay')
    .option('-c, --capture [lines]', 'Capture output from source pane and relay it')
    .action(async (session: string, opts) => {
      try {
        if (opts.capture) {
          const lines = typeof opts.capture === 'string' ? parseInt(opts.capture) : 50;
          await manager.relayCapturedOutput(session, opts.from, opts.to, lines);
          console.log(
            chalk.green(`Relayed ${lines} lines of output from ${opts.from} → ${opts.to}`),
          );
        } else if (opts.message) {
          await manager.relayMessage(session, opts.from, opts.to, opts.message);
          console.log(chalk.green(`Relayed message from ${opts.from} → ${opts.to}`));
        } else {
          console.error(chalk.red('Provide either --message or --capture'));
          process.exit(1);
        }
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
