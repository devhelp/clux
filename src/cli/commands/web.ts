import { Command } from 'commander';
import { TmuxSessionManager } from '../../core';

export function registerWebCommand(program: Command, _manager: TmuxSessionManager) {
  program
    .command('web')
    .description('Start the Clux web dashboard')
    .option('-p, --port <port>', 'Port to listen on', '3456')
    .option('-H, --host <host>', 'Host to bind to', '127.0.0.1')
    .action((opts) => {
      process.env.PORT = opts.port;
      process.env.HOST = opts.host;
      require('../../web/server');
    });
}
