#!/usr/bin/env node

import { Command } from 'commander';
import { TmuxSessionManager } from '@clux/core';
import { registerCreateCommand } from './commands/create';
import { registerListCommand } from './commands/list';
import { registerInfoCommand } from './commands/info';
import {
  registerTagCommand,
  registerDescribeCommand,
  registerAttachCommand,
  registerKillCommand,
  registerSendCommand,
  registerCaptureCommand,
  registerExportCommand,
  registerMonitorCommand,
  registerWindowCommands,
} from './commands/session';
import { registerRelayCommand } from './commands/relay';
import { registerStatsCommand } from './commands/stats';

const manager = new TmuxSessionManager();
const program = new Command();

program.name('clux').description('Clux — tmux session multiplexer').version('0.1.0');

registerCreateCommand(program, manager);
registerListCommand(program, manager);
registerInfoCommand(program, manager);
registerTagCommand(program, manager);
registerDescribeCommand(program, manager);
registerRelayCommand(program, manager);
registerStatsCommand(program, manager);
registerWindowCommands(program, manager);
registerSendCommand(program, manager);
registerCaptureCommand(program, manager);
registerExportCommand(program, manager);
registerMonitorCommand(program, manager);
registerAttachCommand(program, manager);
registerKillCommand(program, manager);
program.parse();
