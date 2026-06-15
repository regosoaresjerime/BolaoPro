// Vercel Serverless Function — proxy para api.football-data.org
// A chave fica no servidor (variável de ambiente da Vercel), nunca exposta no frontend.

export default async function handler(req, res) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API do football-data.org não configurada no servidor.' });
  }

  // Monta o path da API externa a partir da query "path"
  // Exemplo: /api/football?path=/v4/competitions/WC/matches
  const targetPath = req.query.path || '/v4/competitions/WC/matches';

  const upstreamUrl = `https://api.football-data.org${targetPath}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'X-Auth-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    const data = await upstream.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Erro ao contatar a API de futebol.', detail: String(err) });
  }
}
