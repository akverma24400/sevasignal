import { serviceView, statusSql } from './status.js';
import { AppError } from './security.js';
export async function attachServices(db, centres) {
  if (!centres.length) return [];
  const { rows } = await db.query(
    `SELECT cs.*, s.name, s.name_hi, s.category FROM centre_services cs JOIN service_catalog s ON s.id=cs.service_id WHERE cs.centre_id=ANY($1::text[]) AND cs.active=true ORDER BY s.name`,
    [centres.map((c) => c.id)],
  );
  return centres.map((c) => ({
    ...c,
    total_count: undefined,
    services: rows.filter((s) => s.centre_id === c.id).map((s) => serviceView(s)),
  }));
}
export async function centreById(db, id) {
  const { rows } = await db.query('SELECT * FROM centres WHERE id=$1', [id]);
  if (!rows[0]) throw new AppError(404, 'Centre not found.', 'NOT_FOUND');
  return (await attachServices(db, rows))[0];
}
export async function searchCentres(db, filters) {
  const {
    q = '',
    city = '',
    service = '',
    status = '',
    exclude = '',
    page = 1,
    pageSize = 9,
  } = filters;
  const values = [
    q ? `%${q}%` : '',
    city,
    service,
    status,
    exclude,
    pageSize,
    (page - 1) * pageSize,
  ];
  const where = `WHERE ($1='' OR c.name ILIKE $1 OR c.name_hi ILIKE $1 OR c.city ILIKE $1 OR c.area ILIKE $1 OR c.pincode ILIKE $1)
    AND ($2='' OR c.city=$2) AND ($5='' OR c.id<>$5)
    AND (($3='' AND $4='') OR EXISTS(SELECT 1 FROM centre_services cs WHERE cs.centre_id=c.id AND cs.active=true AND ($3='' OR cs.service_id=$3) AND ($4='' OR ${statusSql('cs')}=$4)))`;
  const { rows } = await db.query(
    `SELECT c.*, COUNT(*) OVER() AS total_count FROM centres c ${where} ORDER BY c.city,c.name LIMIT $6 OFFSET $7`,
    values,
  );
  // A window count has no row to attach to when the requested page is empty.
  const total = rows.length
    ? Number(rows[0].total_count)
    : Number(
        (await db.query(`SELECT COUNT(*) AS count FROM centres c ${where}`, values.slice(0, 5)))
          .rows[0].count,
      );
  return { centres: await attachServices(db, rows), total, page, pageSize };
}
export async function historyForCentre(db, id, limit = 40) {
  return (
    await db.query(
      `SELECT e.id,e.previous_status,e.new_status,e.note,e.reason,e.created_at,e.expires_at,s.name,s.name_hi FROM status_events e JOIN centre_services cs ON cs.id=e.centre_service_id JOIN service_catalog s ON s.id=cs.service_id WHERE cs.centre_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT $2`,
      [id, limit],
    )
  ).rows;
}
