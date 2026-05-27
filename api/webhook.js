const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Mapeamento: ID do produto na Ticto → ID interno do sistema
// Substitua pelos IDs reais dos seus produtos na Ticto
const PRODUTO_MAP = {
  '110945': 'novena-principal',
  '112172': 'poder-dos-arcanjos',
  '111372': '30-oracoes-sao-francisco',
  '111371': 'musicas-dos-anjos-premium',
  '112375': 'grimorio-dos-arcanjos',
};

const TODOS_PRODUTOS = [
  'poder-dos-arcanjos',
  '30-oracoes-sao-francisco',
  'musicas-dos-anjos-premium',
  'grimorio-dos-arcanjos',
];

async function registrarAcesso(email, produtoId) {
  if (produtoId === 'all') {
    for (const p of TODOS_PRODUTOS) {
      await supabase
        .from('compradores')
        .upsert({ email, produto_id: p, ativo: true }, { onConflict: 'email,produto_id' });
    }
    return;
  }
  await supabase
    .from('compradores')
    .upsert({ email, produto_id: produtoId, ativo: true }, { onConflict: 'email,produto_id' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};

  // Ticto envia diferentes formatos — tentamos extrair email e produto das formas mais comuns
  const email =
    body?.customer?.email ||
    body?.buyer?.email ||
    body?.email ||
    body?.data?.customer?.email ||
    null;

  const produtoTicto =
    String(body?.item?.product_id || '') ||
    body?.product?.code ||
    body?.product?.id ||
    body?.produto ||
    body?.data?.product?.code ||
    null;

  // Ignora eventos que não são de pagamento confirmado
  const evento = body?.event || body?.status || '';
  if (evento && !['order.paid', 'payment.approved', 'approved', 'paid', 'APPROVED', 'authorized'].includes(evento)) {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  if (!email) {
    console.error('Webhook sem email:', JSON.stringify(body));
    return res.status(400).json({ erro: 'Email do comprador não encontrado no webhook' });
  }

  const emailNorm = email.toLowerCase().trim();
  const produtoId = produtoTicto ? (PRODUTO_MAP[produtoTicto] || produtoTicto) : 'all';

  try {
    await registrarAcesso(emailNorm, produtoId);
    console.log(`Acesso liberado: ${emailNorm} → ${produtoId}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar acesso:', err.message);
    return res.status(500).json({ erro: 'Erro interno' });
  }
};
