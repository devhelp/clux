import { Router } from 'express';
import { TmuxSessionManager } from '@clux-cli/core';

export function createSessionRoutes(manager: TmuxSessionManager): Router {
  const router = Router();

  router.get('/api/sessions', async (_req, res) => {
    try {
      const sessions = await manager.listSessions();
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/sessions/:name', async (req, res) => {
    try {
      const session = await manager.getSession(req.params.name);
      res.json(session);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  router.post('/api/sessions', async (req, res) => {
    try {
      const { projectName, projectPath, command, layout } = req.body;
      const session = await manager.createSession({
        projectName,
        projectPath: projectPath || process.cwd(),
        command,
        layout,
      });
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/api/sessions/:name', async (req, res) => {
    try {
      await manager.killSession(req.params.name);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:name/send', async (req, res) => {
    try {
      const { paneId, text } = req.body;
      await manager.sendKeys(req.params.name, paneId || '0.0', text);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/sessions/:name/capture/:paneId', async (req, res) => {
    try {
      const lines = parseInt(req.query.lines as string) || 100;
      const output = await manager.capturePane(req.params.name, req.params.paneId, lines);
      res.json(output);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/sessions/:name/export', async (req, res) => {
    try {
      const md = await manager.exportSessionMarkdown(req.params.name);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.md"`);
      res.send(md);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:name/relay', async (req, res) => {
    try {
      const { from, to, message, capture, lines } = req.body;
      if (capture) {
        await manager.relayCapturedOutput(req.params.name, from, to, lines || 50);
      } else {
        await manager.relayMessage(req.params.name, from, to, message);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:name/windows', async (req, res) => {
    try {
      const { windowName, command } = req.body;
      await manager.addWindow(req.params.name, windowName, command);
      const session = await manager.getSession(req.params.name);
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/api/sessions/:name/panes/:paneId', async (req, res) => {
    try {
      await manager.killPane(req.params.name, req.params.paneId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/api/sessions/:name/windows/:index', async (req, res) => {
    try {
      const { newName } = req.body;
      await manager.renameWindow(req.params.name, parseInt(req.params.index), newName);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
