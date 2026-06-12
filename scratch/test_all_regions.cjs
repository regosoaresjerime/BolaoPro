const { Client } = require('pg');

const projectRef = 'iwwlkqqgdtarkmstlcov';
const password = 'qReK9kEZ3MP55BRU';

const allRegions = [
  'sa-east-1',      // São Paulo
  'us-east-1',      // North Virginia
  'us-east-2',      // Ohio
  'us-west-1',      // Northern California
  'us-west-2',      // Oregon
  'ca-central-1',   // Canada Central
  'eu-central-1',   // Frankfurt
  'eu-central-2',   // Zurich
  'eu-west-1',      // Ireland
  'eu-west-2',      // London
  'eu-west-3',      // Paris
  'eu-north-1',     // Stockholm
  'ap-northeast-1', // Tokyo
  'ap-northeast-2', // Seoul
  'ap-northeast-3', // Osaka
  'ap-south-1',     // Mumbai
  'ap-southeast-1', // Singapore
  'ap-southeast-2', // Sydney
  'me-central-1'    // Middle East
];

async function testAllRegions() {
  console.log("Starting scan of all Supabase pooler regions...");
  
  for (const region of allRegions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    
    try {
      await client.connect();
      const res = await client.query('SELECT NOW()');
      console.log(`\n🎉 SUCCESS! Connected to region: ${region}`);
      console.log(`Host: ${host}`);
      console.log(`Current Time: ${res.rows[0].now}`);
      await client.end();
      return;
    } catch (err) {
      if (err.message.includes('tenant/user') && err.message.includes('not found')) {
        // This means we reached the pooler, but the project is not in this region
        console.log(`[-] Region ${region}: Project not in this region.`);
      } else {
        console.log(`[?] Region ${region}: ${err.message}`);
      }
    }
  }
  
  console.log("\n❌ Scan complete. Could not connect to any region pooler.");
}

testAllRegions();
