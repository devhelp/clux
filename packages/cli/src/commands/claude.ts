import { Command } from 'commander';
import { TmuxSessionManager } from '@clux/core';
import chalk from 'chalk';
import ora from 'ora';
import { spawn, spawnSync } from 'child_process';
import { printSessionDetails } from '../format';

/**
 * Shortens an absolute path for use as a tmux session name.
 * Keeps the last two path segments intact, shortens all earlier segments
 * to their first letter, and joins with dashes.
 *
 * Examples:
 *   /home/user                        → "home-user"
 *   /home/user/projects/clux          → "h-u-projects-clux"
 *   /home/user/projects/clux/foo/bar  → "h-u-p-c-foo-bar"
 */
export function shortenPath(absolutePath: string): string {
  const parts = absolutePath.split('/').filter(Boolean);
  if (parts.length <= 2) {
    return parts.join('-');
  }
  return [...parts.slice(0, -2).map((p) => p[0]), ...parts.slice(-2)].join('-');
}

/**
 * Generates a session name for a Claude session based on the working directory.
 * Format: claude_<shortened-path>
 */
export function buildSessionName(name: string | undefined, cwd: string): string {
  return name || `claude_${shortenPath(cwd)}`;
}

/**
 * Switches to a tmux session. Uses switch-client when already inside tmux,
 * falls back to attach-session otherwise.
 */
function switchToSession(sessionName: string): void {
  if (process.env.TMUX) {
    spawnSync('tmux', ['switch-client', '-t', sessionName], { stdio: 'inherit' });
  } else {
    const proc = spawn('tmux', ['attach-session', '-t', sessionName], { stdio: 'inherit' });
    proc.on('exit', (code: number) => process.exit(code || 0));
  }
}

export function registerClaudeCommand(program: Command, manager: TmuxSessionManager): void {
  program
    .command('claude [name]')
    .description('Create a tmux session running Claude Code')
    .option('-p, --path <path>', 'Project working directory', process.cwd())
    .option('-d, --detach', 'Do not attach to the session after creation')
    .option('--danger', 'Run Claude with --dangerously-skip-permissions')
    .action(async (name: string | undefined, opts) => {
      const cwd = opts.path || process.cwd();
      const sessionName = buildSessionName(name, cwd);

      const exists = await manager.sessionExists(sessionName);

      if (exists) {
        console.log(chalk.yellow(`Session "${sessionName}" already exists, switching...`));
        if (!opts.detach) {
          switchToSession(sessionName);
        }
        return;
      }

      const spinner = ora(`Creating Claude session "${sessionName}"...`).start();

      try {
        const session = await manager.createSession({
          projectName: sessionName,
          projectPath: cwd,
          command: opts.danger ? 'claude --dangerously-skip-permissions' : 'claude',
          layout: 'tiled',
        });

        manager.store.updateDescription(session.name, 'Claude Code session');
        manager.store.updateTags(session.name, ['claude', 'ai']);

        spinner.succeed(chalk.green(`Claude session "${session.name}" created`));
        printSessionDetails(session);

        if (!opts.detach) {
          switchToSession(session.name);
        } else {
          console.log(chalk.dim(`\n  Attach with: clux attach ${session.name}`));
        }
      } catch (err: any) {
        spinner.fail(chalk.red(err.message));
        process.exit(1);
      }
    });
}
