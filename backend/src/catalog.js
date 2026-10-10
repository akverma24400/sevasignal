export const catalog = [
  ['pan-assistance', 'PAN assistance', 'पैन आवेदन सहायता', 'Applications'],
  ['certificate-printing', 'Certificate printing', 'प्रमाणपत्र प्रिंटिंग', 'Documents'],
  ['bill-payment', 'Bill payment assistance', 'बिल भुगतान सहायता', 'Payments'],
  ['form-assistance', 'Online form assistance', 'ऑनलाइन फॉर्म सहायता', 'Applications'],
  ['document-scanning', 'Document scanning', 'दस्तावेज़ स्कैनिंग', 'Documents'],
  ['pension-support', 'Pension application support', 'पेंशन आवेदन सहायता', 'Applications'],
];
export async function seedCatalog(db) {
  for (const row of catalog)
    await db.query(
      'INSERT INTO service_catalog(id,name,name_hi,category) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      row,
    );
}
