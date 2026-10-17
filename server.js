require('dotenv').config();
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function enviarJSON(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

// Função auxiliar para ler o corpo (body) de requisições POST
function lerBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // Trata requisições Preflight (OPTIONS) do CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // ----------------------------------------------------
    // GET /api/questions -> Retorna todas as perguntas com alternativas
    // ----------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/questions') {
      const { data, error } = await supabase.from('perguntas').select('*, alternativas(*)');
      if (error) throw error;
      return enviarJSON(res, 200, data);
    }

    // ----------------------------------------------------
    // GET /api/questions/random -> Retorna 10 perguntas aleatórias para a partida
    // ----------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/questions/random') {
      // Busca todas e embaralha no código (ou usa lógica SQL do Supabase)
      const { data, error } = await supabase.from('perguntas').select('*, alternativas(*)');
      if (error) throw error;
      
      // Embaralha aleatoriamente e pega no máximo 10
      const embaralhadas = data.sort(() => 0.5 - Math.random()).slice(0, 10);
      return enviarJSON(res, 200, embaralhadas);
    }

    // ----------------------------------------------------
    // POST /api/users -> Cadastra o usuário (nome e icone_id)
    // ----------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/users') {
      const body = await lerBody(req);
      if (!body.nome || !body.icone_id) {
        return enviarJSON(res, 400, { erro: 'Nome e icone_id são obrigatórios.' });
      }

      const { data, error } = await supabase
        .from('usuarios')
        .insert([{ nome: body.nome, icone_id: body.icone_id }])
        .select()
        .single();

      if (error) throw error;
      return enviarJSON(res, 201, data);
    }

    // ----------------------------------------------------
    // POST /api/matches -> Salva a pontuação total da partida
    // ----------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/matches') {
      const body = await lerBody(req);
      if (!body.usuario_id || body.pontuacao_total === undefined) {
        return enviarJSON(res, 400, { erro: 'usuario_id e pontuacao_total são obrigatórios.' });
      }

      const { data, error } = await supabase
        .from('partidas')
        .insert([{ usuario_id: body.usuario_id, pontuacao_total: body.pontuacao_total }])
        .select()
        .single();

      if (error) throw error;
      return enviarJSON(res, 201, data);
    }

    // ----------------------------------------------------
    // GET /api/ranking -> Retorna o ranking ordenado pelas maiores pontuações
    // ----------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/ranking') {
      const { data, error } = await supabase
        .from('partidas')
        .select(`
          id_partida,
          pontuacao_total,
          data_partida,
          usuarios (
            nome,
            icone_id
          )
        `)
        .order('pontuacao_total', { ascending: false })
        .limit(10);

      if (error) throw error;
      return enviarJSON(res, 200, data);
    }

    // ----------------------------------------------------
    // GET /api/icons -> Retorna todos os ícones cadastrados
    // ----------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/icons') {
      const { data, error } = await supabase
        .from('icons')
        .select('*')
        .order('icon_id', { ascending: true });

      if (error) throw error;
      return enviarJSON(res, 200, data);
    }

    // Rota não encontrada
    return enviarJSON(res, 404, { erro: 'Rota não encontrada.' });

  } catch (err) {
    console.error('Erro no servidor:', err.message);
    return enviarJSON(res, 500, { erro: 'Erro interno no servidor: ' + err.message });
  }
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
