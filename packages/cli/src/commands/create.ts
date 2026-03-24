import { Command } from 'commander';
import { TmuxSessionManager } from '@clux-cli/core';
import chalk from 'chalk';
import ora from 'ora';
import { printSessionDetails } from '../format';

export function registerCreateCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('create <name>')
    .description('Create a new tmux session')
    .option('-p, --path <path>', 'Project working directory', process.cwd())
    .option('-c, --command <cmd>', 'Command to run in main pane (e.g. "claude")')
    .option('-l, --layout <layout>', 'Pane layout', 'tiled')
    .option('-d, --description <text>', 'Session description')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .action(async (name: string, opts) => {
      const spinner = ora(`Creating session "${name}"...`).start();
      try {
        const session = await manager.createSession({
          projectName: name,
          projectPath: opts.path,
          command: opts.command,
          layout: opts.layout,
        });

        if (opts.description) {
          manager.store.updateDescription(session.name, opts.description);
        }
        if (opts.tags) {
          manager.store.updateTags(
            session.name,
            opts.tags.split(',').map((t: string) => t.trim()),
          );
        }

        spinner.succeed(chalk.green(`Session "${session.name}" created`));
        printSessionDetails(session);
        console.log(chalk.dim(`\n  Attach with: clux attach ${session.name}`));
      } catch (err: any) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
      }
    });
}
