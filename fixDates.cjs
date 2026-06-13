const fs = require('fs');

const mockDataSrc = fs.readFileSync('src/data/mockData.ts', 'utf8');
const arrayStart = mockDataSrc.indexOf('[');
// Find the closing bracket of the first array (RAW_INITIAL_MATCHES)
let arrayEnd = arrayStart;
let bracketCount = 0;
let inString = false;
for (let i = arrayStart; i < mockDataSrc.length; i++) {
  const char = mockDataSrc[i];
  if (char === '"' && mockDataSrc[i-1] !== '\\') {
    inString = !inString;
  }
  if (!inString) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }
  if (bracketCount === 0) {
    arrayEnd = i + 1;
    break;
  }
}

const rawArray = mockDataSrc.substring(arrayStart, arrayEnd).replace(/\\/g, '');

let mockMatches;
try {
  mockMatches = JSON.parse(rawArray);
} catch(e) {
  console.log('Error parsing array', e);
  process.exit(1);
}

const apiMatches = JSON.parse(fs.readFileSync('api_matches.json'));
let discrepancies = 0;
let outputStr = mockDataSrc;

apiMatches.forEach(apiM => {
  if (!apiM.homeTeam.name || !apiM.awayTeam.name) return;
  const tlaA = apiM.homeTeam.tla || apiM.homeTeam.name.substring(0,3).toUpperCase();
  const tlaB = apiM.awayTeam.tla || apiM.awayTeam.name.substring(0,3).toUpperCase();

  const mockM = mockMatches.find(m => 
    (m.teamA === tlaA && m.teamB === tlaB) ||
    (m.teamA === tlaB && m.teamB === tlaA) ||
    (m.teamA.includes(apiM.homeTeam.name.substring(0,3).toUpperCase()))
  );

  if (mockM) {
    const apiDate = new Date(apiM.utcDate);
    const mockDateStr = mockM.startedAt.replace(/\\/g, '');
    const mockDate = new Date(mockDateStr);
    
    if (apiDate.getTime() !== mockDate.getTime()) {
      console.log('DISCREPANCY:', mockM.teamA, 'vs', mockM.teamB);
      console.log('  Mock:', mockDate.toISOString());
      console.log('  API :', apiDate.toISOString());
      
      const localD = new Date(apiDate.getTime() - 3 * 3600000);
      const dd = String(localD.getUTCDate()).padStart(2, '0');
      const mm = String(localD.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = localD.getUTCFullYear();
      const HH = String(localD.getUTCHours()).padStart(2, '0');
      const MM = String(localD.getUTCMinutes()).padStart(2, '0');
      const newDateText = `${dd}/${mm}/${yyyy}, ${HH}:${MM}`;
      const newStartedAt = apiDate.toISOString();
      
      console.log('  New dateText:', newDateText);
      console.log('  New startedAt:', newStartedAt);
      
      const idMatch = new RegExp(`("id":\\s*"${mockM.id}"[\\s\\S]*?"dateText":\\s*")[^"]+(")`);
      outputStr = outputStr.replace(idMatch, `$1${newDateText}$2`);
      
      const startMatch = new RegExp(`("id":\\s*"${mockM.id}"[\\s\\S]*?"startedAt":\\s*")[^"]+(")`);
      outputStr = outputStr.replace(startMatch, `$1${newStartedAt}$2`);
      discrepancies++;
    }
  }
});

outputStr = outputStr.replace(/(\d{2}:\d{2})\\"/g, '$1"');
outputStr = outputStr.replace(/(\d{2})\\:(\d{2})/g, '$1:$2');
outputStr = outputStr.replace(/(\d{2}:\d{2})\\/g, '$1');

fs.writeFileSync('src/data/mockData.ts', outputStr);
console.log('Fixed', discrepancies, 'discrepancies');
