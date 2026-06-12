const fs = require('fs');
const path = require('path');

// 1. Path to the Markdown file containing the schedule
const docPath = path.join(__dirname, '../docs/Calendário Oficial da Copa do Mundo FIFA 2026.md');
const mdContent = fs.readFileSync(docPath, 'utf8');

// Helper to clean names from footnote numbers or spaces
function cleanName(name) {
  if (!name) return '';
  return name.replace(/\s+\d+$/, '').replace(/\(\d+º coloc.*?\)/, (m) => m).trim();
}

// Map of flags (standard emojis)
const FLAG_MAP = {
  'México': '🇲🇽',
  'África do Sul': '🇿🇦',
  'República da Coreia': '🇰🇷',
  'Coreia do Sul': '🇰🇷',
  'República Tcheca': '🇨🇿',
  'Canadá': '🇨🇦',
  'Bósnia e Herzegovina': '🇧🇦',
  'Estados Unidos': '🇺🇸',
  'Paraguai': '🇵🇾',
  'Catar': '🇶🇦',
  'Suíça': '🇨🇭',
  'Brasil': '🇧🇷',
  'Marrocos': '🇲🇦',
  'Haiti': '🇭🇹',
  'Escócia': '🏴\u200D󠁧\u200D󠁢\u200D󠁳\u200D󠁣\u200D󠁴\u200D󠁿',
  'Austrália': '🇦🇺',
  'Turquia': '🇹🇷',
  'Alemanha': '🇩🇪',
  'Curaçau': '🇨🇼',
  'Holanda': '🇳🇱',
  'Japão': '🇯🇵',
  'Costa do Marfim': '🇨🇮',
  'Equador': '🇪🇨',
  'Suécia': '🇸🇪',
  'Tunísia': '🇹🇳',
  'Espanha': '🇪🇸',
  'Cabo Verde': '🇨🇻',
  'Bélgica': '🇧🇪',
  'Egito': '🇪🇬',
  'Arábia Saudita': '🇸🇦',
  'Uruguai': '🇺🇾',
  'Irã': '🇮🇷',
  'Nova Zelândia': '🇳🇿',
  'França': '🇫🇷',
  'Senegal': '🇸🇳',
  'Iraque': '🇮🇶',
  'Noruega': '🇳🇴',
  'Argentina': '🇦🇷',
  'Argélia': '🇩🇿',
  'Áustria': '🇦🇹',
  'Jordânia': '🇯🇴',
  'Portugal': '🇵🇹',
  'República Democrática do Congo': '🇨🇩',
  'Inglaterra': '🏴\u200D󠁧\u200D󠁢\u200D󠁥\u200Dbi\u200D󠁧\u200D󠁿',
  'Croácia': '🇭🇷',
  'Gana': '🇬🇭',
  'Panamá': '🇵🇦',
  'Uzbequistão': '🇺🇿',
  'Colômbia': '🇨🇴',
  'Catar': '🇶🇦',
  'República da Coreia': '🇰🇷',
  'Bósnia e Herzegovina': '🇧🇦',
  'Uzbequistão': '🇺🇿',
  'TBD': '🏳️',
  'A Definir (TBD)': '🏳️'
};

const FLAG_IMAGE_MAP = {
  'BRA': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7vNzeE8RsyKo8Fr3rL2PkL4AstJSLPk5MWkhnbl3_vaFgGY2W7ZdBkDFcG60VaUClxdeO7VlkAG7sW3Oeudi9UnoTjtfhV8suOhFHG0MJ8yQu7wpgSePrLv_RwXoCMzLm2JhHrAjVzRyCHIMxNP82eKEZVzXuGp71_CM6_7utJO38M1Nq2jr_gpR1Y6-J78ySQ1I7HNZ4jS4z7gqLZ-QjQuTjA8aQx1XpI7XPXcjw0Ka0mzLgp6Hcd845_Wbtr_t1XHE0zasSwZo',
  'FRA': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhVo1hDodGOp_am6i25Ouqv7M_OFbPrP5NJ1cpKT9k3gQ-FdE_6ghYfsJ3CVlpwD0kobx0MgoQmWocgZde_nmvarXBy7oDl18KCrgCrvxUuk8I4yYx8KtEAQ2c1nepnLvW0O6DiqcGfBYFfWLOQlN89wybYdl6himRuKg9JDuF8XNELWsH4k0jHAcv_j_ogeHmB9LYj-Rzx-t8weTLz2dVaZ5WHf_KtK3PdLAIGdPVAps_351AgXSwOwQjEJkuIon6hhh-l5lvPtU',
  'GER': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9uobBIdm0Us_gggg5UIRCBsY5m7zVujvbCnorXj_m87hDbTeghIQjKSymCWkaKJ4mR0Xdw9x7Dny3FN8c68oKkAA_PKO8wFcgeW5HoveZ9LQBdRnQA5_5xr0WHnd0l1u_VYxDTYssYyDJF8yRFhnY5vAB_3VRIcfDxz7RPEkepvrD7lw0HuS_YIs1NGhNfesmmuVhi6WqI6F_THpJDvlhIW2WQfKTJHnnyWGueqk_EOIhq1t2p2Lw9ydvAvJZwcwNoZhmch1KBjg',
  'ARG': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJmuMinoNNpyjN50ez1KFsAdp2i3FrUB7M37Fcd5VcpHg2ZlsJgeLib_RJNRavc41tk47-tUYH7TEBycNql4P2VL2m5I_z1DlHT76N-gLgJhzyFErDiDg3669haGnKUKTUet9Qoos759vNQzy3EcFhmfixlzmOkRNm9l4AWc3KgiYaV1YcgwSV5N2Ci7vlKwfpiWsARrrqJcrdZUQkV9wcQAhvkBk25noRIPQwGP85sktmRYR_dYcaLAYhLRo3rqVcYEpMYUW0-vY',
  'MEX': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9uobBIdm0Us_gggg5UIRCBsY5m7zVujvbCnorXj_m87hDbTeghIQjKSymCWkaKJ4mR0Xdw9x7Dny3FN8c68oKkAA_PKO8wFcgeW5HoveZ9LQBdRnQA5_5xr0WHnd0l1u_VYxDTYssYyDJF8yRFhnY5vAB_3VRIcfDxz7RPEkepvrD7lw0HuS_YIs1NGhNfesmmuVhi6WqI6F_THpJDvlhIW2WQfKTJHnnyWGueqk_EOIhq1t2p2Lw9ydvAvJZwcwNoZhmch1KBjg',
  'ENG': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0IGlBhA7IyrVbDDUwyQZ1_MgldD0wHQs-xKgE71oPAd5K_a1Y2mRCnyC4MPeTHH2uz6vanIX2RyYcS0MDPNUuIaSONVfhYoX8b14CGezRQXoO-b2VWoPFT0XFtJLMJf7isx6KvQjsKGz_Mas8OKmWWgzZxveUfyLghlIC3Qtfa_iXd4uw5PNIntrY5gGDvLd48N9M0wKPWWzxOdl9TeBEz6V2igqdhp4iKbRC8RYacMIpmIWwNGT8s9RpVg_c0-gFojoDeLzGpSU',
  'ESP': 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7vNzeE8RsyKo8Fr3rL2PkL4AstJSLPk5MWkhnbl3_vaFgGY2W7ZdBkDFcG60VaUClxdeO7VlkAG7sW3Oeudi9UnoTjtfhV8suOhFHG0MJ8yQu7wpgSePrLv_RwXoCMzLm2JhHrAjVzRyCHIMxNP82eKEZVzXuGp71_CM6_7utJO38M1Nq2jr_gpR1Y6-J78ySQ1I7HNZ4jS4z7gqLZ-QjQuTjA8aQx1XpI7XPXcjw0Ka0mzLgp6Hcd845_Wbtr_t1XHE0zasSwZo',
  'USA': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop',
  'CAN': 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop'
};

const TEAM_CODE_MAP = {
  'México': 'MEX',
  'África do Sul': 'RSA',
  'República da Coreia': 'KOR',
  'República Tcheca': 'CZE',
  'Canadá': 'CAN',
  'Bósnia e Herzegovina': 'BIH',
  'Estados Unidos': 'USA',
  'Paraguai': 'PAR',
  'Catar': 'QAT',
  'Suíça': 'SUI',
  'Brasil': 'BRA',
  'Marrocos': 'MAR',
  'Haiti': 'HAI',
  'Escócia': 'SCO',
  'Austrália': 'AUS',
  'Turquia': 'TUR',
  'Alemanha': 'GER',
  'Curaçau': 'CUW',
  'Holanda': 'NED',
  'Japão': 'JPN',
  'Costa do Marfim': 'CIV',
  'Equador': 'ECU',
  'Suécia': 'SWE',
  'Tunísia': 'TUN',
  'Espanha': 'ESP',
  'Cabo Verde': 'CPV',
  'Bélgica': 'BEL',
  'Egito': 'EGY',
  'Arábia Saudita': 'KSA',
  'Uruguai': 'URU',
  'Irã': 'IRN',
  'Nova Zelândia': 'NZL',
  'França': 'FRA',
  'Senegal': 'SEN',
  'Iraque': 'IRQ',
  'Noruega': 'NOR',
  'Argentina': 'ARG',
  'Argélia': 'ALG',
  'Áustria': 'AUT',
  'Jordânia': 'JOR',
  'Portugal': 'POR',
  'República Democrática do Congo': 'COD',
  'Inglaterra': 'ENG',
  'Croácia': 'CRO',
  'Gana': 'GHA',
  'Panamá': 'PAN',
  'Uzbequistão': 'UZB',
  'Colômbia': 'COL'
};

function getFlagImage(teamName) {
  const code = TEAM_CODE_MAP[teamName];
  if (FLAG_IMAGE_MAP[code]) {
    return FLAG_IMAGE_MAP[code];
  }
  return 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop';
}

const matches = [];
const teamsMap = new Map();
let matchIdCounter = 1;

// 1. Parse Group Stage (1ª, 2ª, 3ª Rodadas) - exactly 72 matches total
const groupMatchesRegex = /\| (\d{2}\/\d{2}) \| ([^|]+) \| ([A-L]) \| ([^|]+) /g;
let match;
while ((match = groupMatchesRegex.exec(mdContent)) !== null) {
  const date = match[1];
  const time = match[2].trim().replace('*', '');
  const groupLetter = match[3];
  
  // The match[4] confrontation is like "México x África do Sul 1"
  const confrontationParts = match[4].split(/\s+x\s+/);
  const teamA = cleanName(confrontationParts[0]);
  const teamB = cleanName(confrontationParts[1]);

  const groupLabel = `Grupo ${groupLetter}`;
  
  // Track unique teams for our COPA_2026_TEAMS array
  [teamA, teamB].forEach(t => {
    if (!teamsMap.has(t)) {
      teamsMap.set(t, {
        code: TEAM_CODE_MAP[t] || t.substring(0,3).toUpperCase(),
        name: t,
        flag: FLAG_MAP[t] || '🏳️',
        group: groupLabel
      });
    }
  });

  matches.push({
    id: `m${matchIdCounter++}`,
    group: `GRUPO ${groupLetter} • FASE DE GRUPOS`,
    dateText: `${date}/2026, ${time.replace('h', ':')}`,
    teamA: TEAM_CODE_MAP[teamA] || teamA,
    teamB: TEAM_CODE_MAP[teamB] || teamB,
    teamAFlag: getFlagImage(teamA),
    teamBFlag: getFlagImage(teamB),
    status: 'scheduled',
    scoreA: null,
    scoreB: null,
    startedAt: `2026-06-${date.split('/')[0]}T${time.replace('h', ':')}:00.000Z`
  });
}

// 2. Parse Knockout matches (32 matches) - total 104 matches
// We use our refined regex that matches dates with double escaped asterisks, times, game numbers, pairings, venues, etc.
const knockoutRegex = /\*\s+(\d{2}\/\d{2}(?:\\\*\\\*|\\\*)?)\s*(?:\\-)?\s*([0-9a-zA-Z\s\\*:\u00C0-\u00FF\u0100-\u017F\\*]+?)\s*(?:\\-)?\s*(32-avos|Oitavas|Quartas|Semifinal|Disputa|Final|Semifinais)[^\n:]+Jogo\s+(\d+):\s*([^\n\\]+)(?:\\-)?\s*([^\n\r]+)/g;

let koMatch;
while ((koMatch = knockoutRegex.exec(mdContent)) !== null) {
  const date = koMatch[1].replace(/\\\*\\\*/g, '').replace(/\\\*/g, '').trim();
  let time = koMatch[2].replace(/\\/g, '').trim();
  const stage = koMatch[3].trim();
  const gameNumber = koMatch[4].trim();
  const pairing = koMatch[5].replace(/\\/g, '').trim();
  const venue = koMatch[6].replace(/\\/g, '').trim().replace(/\s+\d+$/, ''); // clean footnotes like "Los Angeles 7" -> "Los Angeles"

  const teams = pairing.split(/\s+x\s+/);
  const teamA = cleanName(teams[0]);
  const teamB = cleanName(teams[1]);

  let groupLabel = stage.toUpperCase();
  if (groupLabel.includes('32-AVOS')) {
    groupLabel = '16-AVOS DE FINAL'; // The user requests 16-avos
  } else if (groupLabel.includes('OITAVAS')) {
    groupLabel = 'OITAVAS DE FINAL';
  } else if (groupLabel.includes('QUARTAS')) {
    groupLabel = 'QUARTAS DE FINAL';
  } else if (groupLabel.includes('SEMIFINAL') || groupLabel.includes('SEMIFINAIS')) {
    groupLabel = 'SEMIFINAL';
  } else if (groupLabel.includes('DISPUTA')) {
    groupLabel = 'DISPUTA DE 3º LUGAR';
  } else if (groupLabel.includes('FINAL')) {
    groupLabel = 'FINAL';
  }

  // Parse time
  if (time.includes('Horário a definir')) {
    time = 'A Definir';
  } else {
    time = time.replace('h', ':').replace('*', '');
  }

  matches.push({
    id: `m${gameNumber}`,
    group: groupLabel,
    dateText: `${date}/2026, ${time} (${venue})`,
    teamA: teamA,
    teamB: teamB,
    teamAFlag: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop',
    teamBFlag: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=150&auto=format&fit=crop',
    status: 'scheduled',
    scoreA: null,
    scoreB: null,
    startedAt: `2026-${date.split('/')[1]}-${date.split('/')[0]}T12:00:00.000Z`
  });
}

// 3. Sort matches by id so it matches chronologically or numerically (m1 to m104)
matches.sort((a, b) => {
  const numA = parseInt(a.id.replace('m', ''));
  const numB = parseInt(b.id.replace('m', ''));
  return numA - numB;
});

// 4. Output matches into mockData.ts
const mockDataPath = path.join(__dirname, '../src/data/mockData.ts');
let content = fs.readFileSync(mockDataPath, 'utf8');

const matchesRegex = /export const INITIAL_MATCHES: Match\[\] = \[[\s\S]*?\];/;
const newMatchesStr = `export const INITIAL_MATCHES: Match[] = ${JSON.stringify(matches, null, 2)};`;
content = content.replace(matchesRegex, newMatchesStr);
fs.writeFileSync(mockDataPath, content);

// 5. Output teams into teams.ts
const teamsArray = Array.from(teamsMap.values());
const teamsPath = path.join(__dirname, '../src/data/teams.ts');
let teamsContent = fs.readFileSync(teamsPath, 'utf8');

const teamsRegex = /export const COPA_2026_TEAMS: Team\[\] = \[[\s\S]*?\];/;
const newTeamsStr = `export const COPA_2026_TEAMS: Team[] = ${JSON.stringify(teamsArray, null, 2)};`;
teamsContent = teamsContent.replace(teamsRegex, newTeamsStr);
fs.writeFileSync(teamsPath, teamsContent);

console.log(`Successfully parsed and loaded ${matches.length} matches and ${teamsArray.length} teams from official calendar!`);
