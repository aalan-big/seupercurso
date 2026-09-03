require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Diagnostica o erro "You cannot use application_fee with this payment".
 *
 * O Mercado Pago recusa a comissao quando quem recebe e a propria conta dona da
 * aplicacao: ninguem cobra comissao de si mesmo. Como o mpAccessToken fica
 * cifrado no banco, o mpUserId e a unica comparacao possivel.
 */
async function main() {
  const token = (process.env.MP_ACCESS_TOKEN || '').trim();

  if (!token) {
    console.log('MP_ACCESS_TOKEN ausente no .env — as cobrancas nem sairiam.');
    return;
  }

  console.log(
    `Credencial da plataforma: ${token.startsWith('TEST-') ? 'TESTE' : 'PRODUCAO'}\n`,
  );

  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.log(`Falha ao consultar a conta da plataforma: HTTP ${res.status}`);
    console.log(await res.text());
    return;
  }

  const conta = await res.json();
  const idPlataforma = String(conta.id);
  console.log(
    `Conta da aplicacao: id=${idPlataforma} nickname=${conta.nickname} email=${conta.email}`,
  );

  const { rows } = await pool.query(`
    SELECT o.id,
           o."mpUserId",
           o."comissaoPercentual",
           u.email,
           COALESCE(
             string_agg(e.nome || ' (' || e.status || ')', ', '),
             'nenhum evento'
           ) AS eventos
      FROM "Organizador" o
      JOIN "Cliente" c ON c.id = o."clienteId"
      JOIN "Usuario" u ON u.id = c."usuarioId"
      LEFT JOIN "Evento" e ON e."organizadorId" = o.id
     GROUP BY o.id, o."mpUserId", o."comissaoPercentual", u.email
     ORDER BY u.email
  `);

  console.log(`\nOrganizadores (${rows.length}):`);

  for (const o of rows) {
    if (!o.mpUserId) {
      console.log(`  [SEM CONEXAO] ${o.email} — nao conectou o Mercado Pago | ${o.eventos}`);
      continue;
    }

    const mesmaConta = String(o.mpUserId) === idPlataforma;

    console.log(
      `  ${mesmaConta ? '[MESMA CONTA DA APLICACAO]' : '[OK]'} ${o.email} | mpUserId=${o.mpUserId} | comissao=${o.comissaoPercentual}% | ${o.eventos}`,
    );

    if (mesmaConta) {
      console.log(
        '      ^ e este que causa o "You cannot use application_fee with this payment".',
      );
    }
  }
}

main()
  .catch((e) => console.error('Falha no diagnostico:', e))
  .finally(() => pool.end());
