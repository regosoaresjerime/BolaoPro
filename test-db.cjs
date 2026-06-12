const { Client } = require('pg');

const url = 'postgresql://postgres.iwwlkqqgdtarkmstlcov:qReK9kEZ3MP55BRU@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  console.log(`Testing: ${url}`);
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`SUCCESS! Connected. Public tables:`);
    res.rows.forEach(r => console.log(` - ${r.table_name}`));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  }
}
main();
