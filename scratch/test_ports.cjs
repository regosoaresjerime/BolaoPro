const { Client } = require('pg');

const projectRef = 'iwwlkqqgdtarkmstlcov';
const password = 'qReK9kEZ3MP55BRU';
const host = 'aws-0-sa-east-1.pooler.supabase.com';

async function testPorts() {
  const ports = [6543, 5432];
  for (const port of ports) {
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:${port}/postgres`;
    console.log(`Testing host ${host} on port ${port}...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      const res = await client.query('SELECT NOW()');
      console.log(`✅ Success on port ${port}! Current time:`, res.rows[0].now);
      await client.end();
      return;
    } catch (err) {
      console.error(`❌ Failed on port ${port}: ${err.message}`);
    }
  }
}

testPorts();
