const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Hub.la product IDs -> internal IDs
const PRODUTO_MAP = {
  'ub0ADR7NHF2qMTlfSLZD': 'oracao-principal',
  '9SVuEA2HskOIfgduwuvJ': 'oracao-principal',
  'uKsOfZWAq2xqtG407usi': 'oracao-principal',
  '6OfCF2ytlbwtFKUz9IAO': 'oracao-principal',
  'YyLmnUj3VN8JvzBljSqe': 'oracao-principal',
  'YkICksWbnACgVoC0udNw': 'oracao-principal',
  'nRNrvGs8TO5Uc2w3FVUI': 'oracao-principal',
};

const PRODUTO_NOME = {
  'oracao-principal': 'Oração Sagrada do Arcanjo Rafael',
};

async function enviarEmailAcesso(email, nomeCliente, produtoId) {
  if (!process.env.BREVO_API_KEY) return;
  const nomeProduto = PRODUTO_NOME[produtoId] || 'Oração Sagrada do Arcanjo Rafael';
  const nomeExibido = nomeCliente ? nomeCliente.split(' ')[0] : 'amigo(a)';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a2e;color:#ffffff;padding:40px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#d4af37;font-size:28px;margin:0;">Seu acesso esta liberado!</h1>
      </div>
      <p style="font-size:16px;line-height:1.6;">Ola, <strong>${nomeExibido}</strong>!</p>
      <p style="font-size:16px;line-height:1.6;">Seu acesso a <strong style="color:#d4af37;">${nomeProduto}</strong> foi liberado com sucesso.</p>
      <p style="font-size:16px;line-height:1.6;">Para acessar, clique no botao abaixo e entre com o seu e-mail de compra:</p>
      <div style="text-align:center;margin:30px 0;">
        <a href="https://jornadaluzconscienciaplena.site/login/" style="background:#d4af37;color:#0a0a2e;padding:15px 35px;border-radius:8px;text-decoration:none;font-size:18px;font-weight:bold;">
          Acessar agora
        </a>
      </div>
      <div style="background:#1a1a4e;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#aaa;">Seu e-mail de acesso:</p>
        <p style="margin:5px 0 0;font-size:16px;color:#d4af37;font-weight:bold;">${email}</p>
      </div>
      <p style="font-size:14px;color:#aaa;line-height:1.6;">Se tiver qualquer duvida, responda este e-mail que te ajudamos.</p>
      <p style="font-size:14px;color:#aaa;">Que o Arcanjo Rafael ilumine seu caminho!</p>
    </div>
  `;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Arcanjo Rafael', email: 'suportepadrelucaslima@gmail.com' },
        to: [{ email, name: nomeCliente || email }],
        subject: `Seu acesso a ${nomeProduto} esta liberado!`,
        htmlContent: html,
      }),
    });
    if (!res.ok) console.error(`Brevo erro ${res.status}: ${await res.text()}`);
    else console.log(`Email enviado para ${email}`);
  } catch (err) {
    console.error('Erro Brevo:', err.message);
  }
}

async function registrarAcesso(email, produtoId) {
  await supabase
    .from('compradores')
    .upsert({ email, produto_id: produtoId, ativo: true }, { onConflict: 'email,produto_id' });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const tipo = body?.type || body?.event_type || '';
  const evento = body?.event || body?.data || {};

  // Aceitar apenas pagamentos aprovados
  const tiposValidos = ['invoice.payment_succeeded', 'purchase.approved', 'PURCHASE_APPROVED'];
  if (tipo && !tiposValidos.includes(tipo)) {
    return res.status(200).json({ ok: true, ignorado: true, tipo });
  }

  // Email - Hub.la v2
  const email =
    evento?.invoice?.payer?.email ||
    evento?.customer?.email ||
    evento?.payer?.email ||
    body?.customer?.email ||
    body?.email ||
    null;

  // Produto - Hub.la v2
  const produtoHubla =
    evento?.product?.id ||
    evento?.offer?.id ||
    body?.product?.id ||
    null;

  if (!email) {
    console.error('Webhook sem email:', JSON.stringify(body));
    return res.status(400).json({ erro: 'Email nao encontrado no webhook' });
  }

  const emailNorm = email.toLowerCase().trim();
  const nomeCliente = evento?.invoice?.payer?.name || evento?.customer?.name || '';
  const produtoId = (produtoHubla && PRODUTO_MAP[produtoHubla]) ? PRODUTO_MAP[produtoHubla] : 'oracao-principal';

  try {
    await registrarAcesso(emailNorm, produtoId);
    console.log(`Acesso liberado: ${emailNorm} -> ${produtoId}`);
    await enviarEmailAcesso(emailNorm, nomeCliente, produtoId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro:', err.message);
    return res.status(500).json({ erro: 'Erro interno' });
  }
};
