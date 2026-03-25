import { Command } from 'commander';
import { TmuxSessionManager } from '../../core';
import chalk from 'chalk';
import { printSessionDetails } from '../format';

export function registerTagCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('tag <session> <tags...>')
    .description('Add tags to a session')
    .option('-r, --remove', 'Remove tags instead of adding')
    .action(async (session: string, tags: string[], opts) => {
      for (const tag of tags) {
        if (opts.remove) {
          manager.store.removeTag(session, tag);
        } else {
          manager.store.addTag(session, tag);
        }
      }
      const record = manager.store.get(session);
      console.log(chalk.green(`Tags for "${session}": ${record?.tags.join(', ') || '(none)'}`));
    });
}

export function registerDescribeCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('describe <session> <description>')
    .description('Set session description')
    .action(async (session: string, description: string) => {
      manager.store.updateDescription(session, description);
      console.log(chalk.green(`Description set for "${session}"`));
    });
}

export function registerAttachCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('attach <session>')
    .description('Attach to a tmux session (takes over terminal)')
    .action(async (session: string) => {
      try {
        if (!(await manager.sessionExists(session))) {
          console.error(chalk.red(`Session "${session}" not found`));
          process.exit(1);
        }
        console.log(chalk.dim(`Attaching to "${session}"... (use Ctrl+B D to detach)`));
        const { spawn } = require('child_process');
        const proc = spawn('tmux', ['attach-session', '-t', session], { stdio: 'inherit' });
        proc.on('exit', (code: number) => process.exit(code || 0));
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}

export function registerKillCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('kill <session>')
    .description('Kill a tmux session')
    .action(async (session: string) => {
      try {
        await manager.killSession(session);
        console.log(chalk.green(`Session "${session}" killed`));
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}

export function registerSendCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('send <session> <message>')
    .description('Send text/command to a session pane')
    .option('--pane <id>', 'Target pane (e.g. 0.1)', '0.0')
    .option('--no-enter', 'Do not send Enter after text')
    .action(async (session: string, message: string, opts) => {
      try {
        await manager.sendKeys(session, opts.pane, message, { noEnter: !opts.enter });
        console.log(chalk.green(`Sent to ${session}:${opts.pane}`));
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}

export function registerCaptureCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('capture <session>')
    .description('Capture pane output')
    .option('--pane <id>', 'Pane to capture', '0.0')
    .option('-n, --lines <n>', 'Number of lines', '50')
    .option('-a, --all', 'Capture full scrollback history')
    .option('-o, --output <file>', 'Write to file instead of stdout')
    .action(async (session: string, opts) => {
      try {
        const output = opts.all
          ? await manager.capturePaneAll(session, opts.pane)
          : await manager.capturePane(session, opts.pane, parseInt(opts.lines));

        if (opts.output) {
          const fs = require('fs');
          fs.writeFileSync(opts.output, output.content);
          console.log(chalk.green(`Saved to ${opts.output} (${output.lines} lines)`));
        } else {
          console.log(output.content);
        }
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}

export function registerExportCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('export <session>')
    .description('Export session to Markdown')
    .option('-o, --output <file>', 'Output file (default: <session>.md)')
    .action(async (session: string, opts) => {
      const spinner = require('ora')(`Exporting "${session}"...`).start();
      try {
        const md = await manager.exportSessionMarkdown(session);
        const file = opts.output || `${session}.md`;
        const fs = require('fs');
        fs.writeFileSync(file, md);
        spinner.succeed(chalk.green(`Exported to ${file}`));
      } catch (err: any) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
      }
    });
}

export function registerMonitorCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('monitor <session>')
    .description('Monitor a session pane in real-time (Ctrl+C to stop)')
    .option('--pane <id>', 'Pane to monitor', '0.0')
    .option('-i, --interval <ms>', 'Polling interval in ms', '1000')
    .action(async (session: string, opts) => {
      console.log(chalk.cyan(`Monitoring ${session}:${opts.pane} (Ctrl+C to stop)\n`));

      let lastContent = '';

      manager.on('output-changed', (event) => {
        if (event.paneId === opts.pane) {
          const content: string = (event.data as any).content;
          if (content !== lastContent) {
            process.stdout.write('\x1B[2J\x1B[H');
            console.log(
              chalk.dim(
                `--- ${session}:${opts.pane} @ ${event.timestamp.toLocaleTimeString()} ---\n`,
              ),
            );
            console.log(content);
            lastContent = content;
          }
        }
      });

      manager.startMonitoringPane(session, opts.pane, parseInt(opts.interval));

      process.on('SIGINT', () => {
        manager.stopMonitoring();
        console.log(chalk.yellow('\nMonitoring stopped.'));
        process.exit(0);
      });

      await new Promise(() => {});
    });
}

export function registerWindowCommands(program: Command, manager: TmuxSessionManager): void {
  program
    .command('add-window <session> <name>')
    .description('Add a new window to a session')
    .option('-c, --command <cmd>', 'Command to run in the new window')
    .action(async (session: string, name: string, opts) => {
      try {
        await manager.addWindow(session, name, opts.command);
        console.log(chalk.green(`Window "${name}" added to "${session}"`));
        const s = await manager.getSession(session);
        printSessionDetails(s);
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  program
    .command('rename-window <session> <windowIndex> <newName>')
    .description('Rename a window')
    .action(async (session: string, windowIndex: string, newName: string) => {
      try {
        await manager.renameWindow(session, parseInt(windowIndex), newName);
        console.log(chalk.green(`Window ${windowIndex} renamed to "${newName}"`));
      } catch (err: any) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
