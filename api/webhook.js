const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PRODUTO_MAP = {
  '110945': 'novena-principal',
  '112172': 'poder-dos-arcanjos',
  '111372': '30-oracoes-sao-francisco',
  '111371': 'musicas-dos-anjos-premium',
  '112375': 'grimorio-dos-arcanjos',
};

const PRODUTO_NOME = {
  'novena-principal': 'Novena de Nossa Senhora Desatadora de Nós',
  'poder-dos-arcanjos': 'Poder dos 4 Arcanjos',
  '30-oracoes-sao-francisco': '30 Orações de São Francisco',
  'musicas-dos-anjos-premium': 'Músicas dos Anjos Premium',
  'grimorio-dos-arcanjos': 'Grimório dos Arcanjos',
};

async function enviarEmailAcesso(email, nomeCliente, produtoId) {
  if (!process.env.BREVO_API_KEY) return;
  const nomeProduto = PRODUTO_NOME[produtoId] || 'seu produto';
  const nomeExibido = nomeCliente ? nomeCliente.split(' ')[0] : 'amigo(a)';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a2e;color:#ffffff;padding:40px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#d4af37;font-size:28px;margin:0;">✨ Seu acesso está liberado!</h1>
      </div>
      <p style="font-size:16px;line-height:1.6;">Olá, <strong>${nomeExibido}</strong>!</p>
      <p style="font-size:16px;line-height:1.6;">Seu acesso ao <strong style="color:#d4af37;">${nomeProduto}</strong> foi liberado com sucesso.</p>
      <p style="font-size:16px;line-height:1.6;">Para acessar, clique no botão abaixo e entre com o seu e-mail de compra:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://conexaoprosperidade.site/login/" style="background:#d4af37;color:#0a0a2e;padding:15px 35px;border-radius:8px;text-decoration:none;font-size:18px;font-weight:bold;">
          Acessar agora →
        </a>
      </div>
      <div style="background:#1a1a4e;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#aaa;">Seu e-mail de acesso:</p>
        <p style="margin:5px 0 0;font-size:16px;color:#d4af37;font-weight:bold;">${email}</p>
      </div>
      <p style="font-size:14px;color:#aaa;line-height:1.6;">Se tiver qualquer dúvida, responda este e-mail que te ajudamos.</p>
      <p style="font-size:14px;color:#aaa;">Que Nossa Senhora Desatadora de Nós abençoe você! 🙏</p>
    </div>
  `;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Novena de Nossa Senhora', email: 'suportepadrelucaslima@gmail.com' },
        to: [{ email, name: nomeCliente || email }],
        subject: `✨ Seu acesso ao ${nomeProduto} está liberado!`,
        htmlContent: html,
      }),
    });
  } catch (err) {
    console.error('Erro ao enviar email Brevo:', err.message);
  }
}

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
  const nomeCliente = body?.customer?.name || body?.buyer?.name || '';
  const produtoId = produtoTicto ? (PRODUTO_MAP[produtoTicto] || produtoTicto) : 'all';

  try {
    await registrarAcesso(emailNorm, produtoId);
    console.log(`Acesso liberado: ${emailNorm} → ${produtoId}`);
    await enviarEmailAcesso(emailNorm, nomeCliente, produtoId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar acesso:', err.message);
    return res.status(500).json({ erro: 'Erro interno' });
  }
};
