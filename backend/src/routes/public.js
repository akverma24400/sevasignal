import { Router } from 'express';
import { z } from 'zod';
import { centreById, searchCentres, historyForCentre } from '../repository.js';
export function publicRoutes(db, config) {
  const router = Router();
  router.get('/config', async (_req, res) => {
    const catalog = (await db.query('SELECT * FROM service_catalog ORDER BY name')).rows;
    const cities = (await db.query('SELECT DISTINCT city FROM centres ORDER BY city')).rows.map(
      (r) => r.city,
    );
    res.json({ catalog, cities, defaultTtl: config.defaultTtl, showDemoHelp: config.showDemoHelp });
  });
  router.get('/centres', async (req, res) => {
    const filters = z
      .object({
        q: z.string().trim().max(100).default(''),
        city: z.string().max(100).default(''),
        service: z.string().max(100).default(''),
        status: z.enum(['', 'available', 'unavailable', 'closed', 'unknown']).default(''),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        pageSize: z.coerce.number().int().min(1).max(24).default(9),
      })
      .parse(req.query);
    res.json({ ...(await searchCentres(db, filters)), serverTime: new Date().toISOString() });
  });
  router.get('/centres/:id', async (req, res) =>
    res.json({
      centre: await centreById(db, req.params.id),
      history: await historyForCentre(db, req.params.id, 15),
      serverTime: new Date().toISOString(),
    }),
  );
  router.get('/centres/:id/alternatives', async (req, res) => {
    const { service } = z.object({ service: z.string().min(1).max(100) }).parse(req.query);
    await centreById(db, req.params.id);
    res.json({
      ...(await searchCentres(db, {
        service,
        status: 'available',
        exclude: req.params.id,
        pageSize: 6,
      })),
      serverTime: new Date().toISOString(),
    });
  });
  return router;
}
