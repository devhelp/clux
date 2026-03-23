import express from 'express';
import http from 'http';
import path from 'path';
import { TmuxSessionManager } from '@clux/core';
import { createSessionRoutes } from './routes/sessions';
import { createSettingsRoutes } from './routes/settings';
import { setupWebSocket } from './websocket/handler';

const app = express();
const server = http.createServer(app);
const manager = new TmuxSessionManager();

const PORT = parseInt(process.env.PORT || '3456');
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(createSessionRoutes(manager));
app.use(createSettingsRoutes({ host: HOST, port: PORT }));

setupWebSocket(server, manager);

server.listen(PORT, HOST, () => {
  console.log(`\n  Clux web dashboard running at http://${HOST}:${PORT}\n`);
});
