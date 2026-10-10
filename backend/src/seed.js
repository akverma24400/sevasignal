import { randomUUID } from 'node:crypto';
import { hashPassword } from './security.js';
import { catalog, seedCatalog } from './catalog.js';
export const demoAccounts = [
  ['roorkee@sevasignal.demo', 'Aarav (demo)', 'roorkee-civil-lines'],
  ['dehradun@sevasignal.demo', 'Meera (demo)', 'dehradun-rajpur'],
  ['haridwar@sevasignal.demo', 'Kabir (demo)', 'haridwar-jwalapur'],
];
export async function seed(db, password) {
  if (password.length < 12) throw new Error('DEMO_PASSWORD must have at least 12 characters.');
  const centres = [
    [
      'roorkee-civil-lines',
      'Civil Lines Seva Centre',
      'सिविल लाइन्स सेवा केंद्र',
      'Civil Lines',
      'Roorkee',
      '247667',
    ],
    [
      'roorkee-ganeshpur',
      'Ganeshpur Digital Centre',
      'गणेशपुर डिजिटल केंद्र',
      'Ganeshpur',
      'Roorkee',
      '247667',
    ],
    [
      'roorkee-rampur',
      'Rampur Community Centre',
      'रामपुर सामुदायिक केंद्र',
      'Rampur',
      'Roorkee',
      '247667',
    ],
    [
      'dehradun-rajpur',
      'Rajpur Road Seva Centre',
      'राजपुर रोड सेवा केंद्र',
      'Rajpur Road',
      'Dehradun',
      '248001',
    ],
    [
      'dehradun-premnagar',
      'Prem Nagar Digital Centre',
      'प्रेम नगर डिजिटल केंद्र',
      'Prem Nagar',
      'Dehradun',
      '248007',
    ],
    [
      'dehradun-dharampur',
      'Dharampur Seva Centre',
      'धर्मपुर सेवा केंद्र',
      'Dharampur',
      'Dehradun',
      '248001',
    ],
    [
      'haridwar-jwalapur',
      'Jwalapur Seva Centre',
      'ज्वालापुर सेवा केंद्र',
      'Jwalapur',
      'Haridwar',
      '249407',
    ],
    [
      'haridwar-ranipur',
      'Ranipur Digital Centre',
      'रानीपुर डिजिटल केंद्र',
      'Ranipur',
      'Haridwar',
      '249403',
    ],
  ];
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await seedCatalog(tx);
    for (let ci = 0; ci < centres.length; ci++) {
      const c = centres[ci];
      const inserted = await tx.query(
        'INSERT INTO centres(id,name,name_hi,area,city,pincode,address,opening_hours,description,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true) ON CONFLICT DO NOTHING RETURNING id',
        [
          ...c,
          `Sample location, ${c[3]}, ${c[4]}, Uttarakhand`,
          'Mon–Sat, 9:00 am–6:00 pm',
          'A fictional centre for exploring SevaSignal. This listing does not represent a real service provider.',
        ],
      );
      if (!inserted.rows.length) continue;
      for (let si = 0; si < catalog.length - (ci % 3); si++) {
        const id = randomUUID();
        let status = ['available', 'available', 'unavailable', 'available', 'closed', 'unknown'][
          (ci + si) % 6
        ];
        if (ci === 0)
          status = ['available', 'unavailable', 'available', 'available', 'unknown', 'closed'][si];
        const stale = status === 'unknown';
        const reported = stale ? 'available' : status;
        const confirmed = new Date(Date.now() - (stale ? 95 : 3 + ci * 2 + si) * 60000);
        const expiry = new Date(confirmed.getTime() + 60 * 60000);
        const reason = status === 'unavailable' ? 'equipment' : '';
        const note =
          status === 'unavailable'
            ? 'Equipment maintenance is in progress. Please check again before travelling.'
            : status === 'closed'
              ? 'This service counter is closed for the day.'
              : '';
        await tx.query(
          'INSERT INTO centre_services(id,centre_id,service_id,reported_status,reason,note,confirmed_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, c[0], catalog[si][0], reported, reason, note, confirmed, expiry],
        );
        await tx.query(
          'INSERT INTO status_events(id,centre_service_id,previous_status,new_status,note,reason,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [randomUUID(), id, 'unknown', reported, note, reason, confirmed, expiry],
        );
        if (status === 'unavailable')
          await tx.query(
            'INSERT INTO incidents(id,centre_service_id,reason,note,started_at) VALUES($1,$2,$3,$4,$5)',
            [randomUUID(), id, reason, note, confirmed],
          );
        if (si === 0)
          await tx.query(
            'INSERT INTO incidents(id,centre_service_id,reason,note,started_at,resolved_at,resolution_note) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              randomUUID(),
              id,
              'network',
              'Earlier sample network interruption.',
              new Date(Date.now() - 150 * 60000),
              new Date(Date.now() - 120 * 60000),
              'Connection restored and service confirmed.',
            ],
          );
      }
    }
    for (const [email, name, centreId] of demoAccounts)
      await tx.query(
        'INSERT INTO operators(id,email,name,centre_id,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING',
        [randomUUID(), email, name, centreId, hash],
      );
  });
}
