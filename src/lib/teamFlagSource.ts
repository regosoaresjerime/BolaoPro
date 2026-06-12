const FIFA_TO_FLAG_SOURCE_CODE: Record<string, string> = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  USA: 'us',
  PAR: 'py',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  NED: 'nl',
  JPN: 'jp',
  CIV: 'ci',
  ECU: 'ec',
  SWE: 'se',
  TUN: 'tn',
  ESP: 'es',
  CPV: 'cv',
  BEL: 'be',
  EGY: 'eg',
  KSA: 'sa',
  URU: 'uy',
  IRN: 'ir',
  NZL: 'nz',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa',
  UZB: 'uz',
  COL: 'co'
};

export function getOfficialTeamFlagUrl(teamCode?: string | null) {
  const normalizedCode = (teamCode || '').trim().toUpperCase();
  const flagSourceCode = FIFA_TO_FLAG_SOURCE_CODE[normalizedCode];

  if (!flagSourceCode) return null;
  return `https://flagcdn.com/w160/${flagSourceCode}.png`;
}
