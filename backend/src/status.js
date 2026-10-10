export function effectiveStatus(row, now = Date.now()) {
  if (row.reported_status === 'unknown' || !row.confirmed_at || !row.expires_at) return 'unknown';
  return new Date(row.expires_at).getTime() <= now ? 'unknown' : row.reported_status;
}
export function serviceView(row, now = Date.now()) {
  return {
    ...row,
    status: effectiveStatus(row, now),
    stale:
      row.reported_status !== 'unknown' &&
      !!row.expires_at &&
      new Date(row.expires_at).getTime() <= now,
  };
}
export const statusSql = (alias) =>
  `CASE WHEN ${alias}.reported_status='unknown' OR ${alias}.confirmed_at IS NULL OR ${alias}.expires_at IS NULL OR ${alias}.expires_at<=NOW() THEN 'unknown' ELSE ${alias}.reported_status END`;
