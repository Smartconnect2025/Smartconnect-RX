const { Client } = require('pg');
(async () => {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) { console.error('NO_SUPABASE_DATABASE_URL'); process.exit(3); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('connected');
    await client.query('ALTER TABLE pharmacy_backends ADD COLUMN IF NOT EXISTS drug_name_prefix text;');
    console.log('column ensured');
    const upd = await client.query("UPDATE pharmacy_backends SET drug_name_prefix = 'AIM-' WHERE drug_name_prefix IS NULL AND system_type = 'DigitalRx';");
    console.log('backfilled DigitalRx rows:', upd.rowCount);
    const col = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='pharmacy_backends' AND column_name='drug_name_prefix';");
    console.log('column meta:', JSON.stringify(col.rows));
    const dist = await client.query("SELECT system_type, drug_name_prefix, count(*)::int AS n FROM pharmacy_backends GROUP BY 1,2 ORDER BY 1,2;");
    console.log('distribution:', JSON.stringify(dist.rows));
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
