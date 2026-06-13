export interface FootballMatchScore {
  homeTeamTla: string;
  awayTeamTla: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

export async function fetchLiveScores(): Promise<FootballMatchScore[]> {
  const apiKey = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
  
  if (!apiKey) {
    throw new Error('Chave de API do football-data.org não encontrada no .env');
  }

  const response = await fetch('/api/football/v4/competitions/WC/matches', {
    headers: {
      'X-Auth-Token': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.matches || !Array.isArray(data.matches)) {
    return [];
  }

  const matches: FootballMatchScore[] = data.matches.map((m: any) => {
    return {
      homeTeamTla: m.homeTeam?.tla || '',
      awayTeamTla: m.awayTeam?.tla || '',
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      status: m.status || 'SCHEDULED'
    };
  });

  return matches;
}
