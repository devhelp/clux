#!/usr/bin/env node

import { Command } from 'commander';
import { TmuxSessionManager } from './core';
import pkg from '../package.json';
import { registerCreateCommand } from './cli/commands/create';
import { registerListCommand } from './cli/commands/list';
import { registerInfoCommand } from './cli/commands/info';
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
} from './cli/commands/session';
import { registerRelayCommand } from './cli/commands/relay';
import { registerStatsCommand } from './cli/commands/stats';
import { registerClaudeCommand } from './cli/commands/claude';
import { registerWebCommand } from './cli/commands/web';

const manager = new TmuxSessionManager();
const program = new Command();

program.name('clux').description('Clux — tmux session multiplexer').version(pkg.version);

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
registerClaudeCommand(program, manager);
registerWebCommand(program, manager);
program.parse();
