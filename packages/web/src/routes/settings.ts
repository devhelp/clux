import { Router } from 'express';

export function createSettingsRoutes(serverConfig: { host: string; port: number }): Router {
  const router = Router();

  router.get('/api/settings', (_req, res) => {
    res.json({
      server: serverConfig,
    });
  });

  return router;
}
