import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { AppError, operatorAuth } from '../security.js';
import { centreById, historyForCentre } from '../repository.js';
import { effectiveStatus } from '../status.js';
const statuses = z.enum(['available', 'unavailable', 'closed', 'unknown']);
export function operatorRoutes(db) {
  const router = Router();
  router.use(operatorAuth(db));
  router.get('/dashboard', async (req, res) => {
    const centre = await centreById(db, req.operator.centre_id);
    const incidents = (
      await db.query(
        `SELECT i.*,s.name,s.name_hi,cs.reported_status,cs.expires_at,cs.confirmed_at,cs.active FROM incidents i JOIN centre_services cs ON cs.id=i.centre_service_id JOIN service_catalog s ON s.id=cs.service_id WHERE cs.centre_id=$1 ORDER BY i.started_at DESC LIMIT 100`,
        [req.operator.centre_id],
      )
    ).rows.map((i) => ({ ...i, current_status: effectiveStatus(i) }));
    res.json({
      centre,
      history: await historyForCentre(db, centre.id),
      incidents,
      serverTime: new Date().toISOString(),
    });
  });
  router.patch('/services/:id/status', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const input = z
      .object({
        status: statuses,
        reason: z.enum(['', 'network', 'equipment', 'staff', 'scheduled', 'other']).default(''),
        note: z.string().trim().max(240).default(''),
        ttlMinutes: z.number().int().min(1).max(240),
        version: z.number().int().positive(),
      })
      .parse(req.body);
    if (input.status === 'unavailable' && !input.reason)
      throw new AppError(400, 'Select a reason for the interruption.');
    await db.transaction(async (tx) => {
      const row = (
        await tx.query(
          'SELECT * FROM centre_services WHERE id=$1 AND centre_id=$2 AND active=true FOR UPDATE',
          [id, req.operator.centre_id],
        )
      ).rows[0];
      if (!row) throw new AppError(404, 'Service not found for your centre.', 'NOT_FOUND');
      if (row.version !== input.version)
        throw new AppError(
          409,
          'This service changed in another session. Refresh and try again.',
          'VERSION_CONFLICT',
        );
      const now = new Date();
      const expiry =
        input.status === 'unknown' ? null : new Date(now.getTime() + input.ttlMinutes * 60000);
      const reason = input.status === 'unavailable' ? input.reason : '';
      await tx.query(
        'UPDATE centre_services SET reported_status=$1,reason=$2,note=$3,confirmed_at=$4,expires_at=$5,version=version+1 WHERE id=$6',
        [input.status, reason, input.note, now, expiry, id],
      );
      await tx.query(
        'INSERT INTO status_events(id,centre_service_id,operator_id,previous_status,new_status,reason,note,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          randomUUID(),
          id,
          req.operator.id,
          effectiveStatus(row),
          input.status,
          reason,
          input.note,
          expiry,
          now,
        ],
      );
      if (input.status === 'unavailable')
        await tx.query(
          'INSERT INTO incidents(id,centre_service_id,reason,note,started_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
          [randomUUID(), id, reason, input.note, now],
        );
      if (input.status === 'available')
        await tx.query(
          'UPDATE incidents SET resolved_at=$1,resolution_note=$2 WHERE centre_service_id=$3 AND resolved_at IS NULL',
          [now, input.note, id],
        );
    });
    res.json({ centre: await centreById(db, req.operator.centre_id) });
  });
  router.post('/services', async (req, res) => {
    const { serviceId } = z.object({ serviceId: z.string().min(1).max(100) }).parse(req.body);
    if (!(await db.query('SELECT id FROM service_catalog WHERE id=$1', [serviceId])).rows[0])
      throw new AppError(400, 'Choose a service from the catalogue.');
    const existing = (
      await db.query('SELECT id,active FROM centre_services WHERE centre_id=$1 AND service_id=$2', [
        req.operator.centre_id,
        serviceId,
      ])
    ).rows[0];
    if (existing?.active) throw new AppError(409, 'This service is already listed.');
    if (existing)
      await db.query(
        "UPDATE centre_services SET active=true,reported_status='unknown',confirmed_at=NULL,expires_at=NULL,note='',reason='',version=version+1 WHERE id=$1",
        [existing.id],
      );
    else
      await db.query('INSERT INTO centre_services(id,centre_id,service_id) VALUES($1,$2,$3)', [
        randomUUID(),
        req.operator.centre_id,
        serviceId,
      ]);
    res.status(201).json({ centre: await centreById(db, req.operator.centre_id) });
  });
  router.delete('/services/:id', async (req, res) => {
    const id = z.uuid().parse(req.params.id);
    const result = await db.query(
      'UPDATE centre_services SET active=false,version=version+1 WHERE id=$1 AND centre_id=$2 AND active=true RETURNING id',
      [id, req.operator.centre_id],
    );
    if (!result.rows.length) throw new AppError(404, 'Service not found for your centre.');
    res.status(204).end();
  });
  router.patch('/centre', async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(3).max(100),
        name_hi: z.string().trim().max(100).default(''),
        area: z.string().trim().min(2).max(80),
        city: z.string().trim().min(2).max(80),
        pincode: z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid six-digit PIN code.'),
        address: z.string().trim().min(5).max(240),
        opening_hours: z.string().trim().min(3).max(120),
        description: z.string().trim().max(400).default(''),
        phone: z
          .string()
          .trim()
          .regex(/^(?:\+?[0-9 -]{10,18})?$/, 'Enter a valid phone number or leave it empty.')
          .default(''),
      })
      .parse(req.body);
    await db.query(
      'UPDATE centres SET name=$1,name_hi=$2,area=$3,city=$4,pincode=$5,address=$6,opening_hours=$7,description=$8,phone=$9,updated_at=NOW() WHERE id=$10',
      [
        input.name,
        input.name_hi,
        input.area,
        input.city,
        input.pincode,
        input.address,
        input.opening_hours,
        input.description,
        input.phone,
        req.operator.centre_id,
      ],
    );
    res.json({ centre: await centreById(db, req.operator.centre_id) });
  });
  return router;
}
