export interface FootballMatchScore {
  homeTeamTla: string;
  awayTeamTla: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

// Mapeamento dos status da API football-data.org:
// SCHEDULED  = jogo agendado, não iniciado
// TIMED      = jogo agendado com horário confirmado
// IN_PLAY    = jogo em andamento (ao vivo)
// PAUSED     = jogo pausado (intervalo / prorrogação pausada)
// FINISHED   = jogo encerrado com resultado oficial definitivo
// POSTPONED  = jogo adiado para outra data
// SUSPENDED  = jogo suspenso (motivo externo)
// CANCELLED  = jogo cancelado
//
// Regra de negócio: O ranking considera o placar oficial SOMENTE quando
// o status do jogo for "FINISHED". Jogos com status IN_PLAY/PAUSED exibem
// o placar parcial mas o ranking permanece com a flag "Parcial".
export function mapApiStatusToDb(apiStatus: string): 'scheduled' | 'live' | 'finished' {
  switch (apiStatus?.toUpperCase()) {
    case 'FINISHED':
      return 'finished';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'SCHEDULED':
    case 'TIMED':
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
    default:
      return 'scheduled';
  }
}

export async function fetchLiveScores(): Promise<FootballMatchScore[]> {
  // Em produção (Vercel), usa a serverless function /api/football que guarda a chave no servidor.
  // Em desenvolvimento local, o proxy do Vite roteia /api/football → https://api.football-data.org
  // com a chave injetada no header via vite.config.ts (usando VITE_FOOTBALL_DATA_API_KEY).
  const isLocal = import.meta.env.DEV;

  let response: Response;

  if (isLocal) {
    // Desenvolvimento: proxy do Vite + chave no header
    const apiKey = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;

    if (!apiKey) {
      throw new Error('Chave de API do football-data.org não encontrada no .env');
    }

    response = await fetch('/api/football/v4/competitions/WC/matches', {
      headers: {
        'X-Auth-Token': apiKey,
      },
    });
  } else {
    // Produção (Vercel): usa a serverless function — chave fica no servidor
    response = await fetch('/api/football?path=/v4/competitions/WC/matches');
  }

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
      status: m.status || 'SCHEDULED',
    };
  });

  return matches;
}
