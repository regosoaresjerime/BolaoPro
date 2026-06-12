const { Client } = require('pg');

const projectRef = 'iwwlkqqgdtarkmstlcov';
const password = 'qReK9kEZ3MP55BRU';

const regions = ['sa-east-1', 'us-east-1', 'us-west-1', 'eu-central-1', 'ap-southeast-1'];

async function testRegions() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    console.log(`Testing region ${region} (${host})...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      const res = await client.query('SELECT NOW()');
      console.log(`\n✅ Success for region ${region}! Current time:`, res.rows[0].now);
      await client.end();
      return;
    } catch (err) {
      console.error(`❌ Failed for region ${region}: ${err.message}`);
    }
  }
  
  // Test direct connection (IPv6)
  const directHost = `db.${projectRef}.supabase.co`;
  console.log(`\nTesting direct host ${directHost} (Port 5432)...`);
  const client = new Client({
    host: directHost,
    port: 5432,
    user: 'postgres',
    password: password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(`✅ Success for direct host! Current time:`, res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error(`❌ Failed for direct host: ${err.message}`);
  }
}

testRegions();
