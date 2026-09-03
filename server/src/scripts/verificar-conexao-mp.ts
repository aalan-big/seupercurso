import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Diagnostica o erro "You cannot use application_fee with this payment".
 *
 * O Mercado Pago recusa a comissao quando quem recebe e a propria conta dona da
 * aplicacao: ninguem cobra comissao de si mesmo. Como o token do organizador e
 * cifrado no banco, o unico jeito de comparar e pelo mpUserId.
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
  console.log(`Conta da aplicacao: id=${idPlataforma} nickname=${conta.nickname} email=${conta.email}`);

  const organizadores = await prisma.organizador.findMany({
    select: {
      id: true,
      mpUserId: true,
      mpConectadoEm: true,
      comissaoPercentual: true,
      cliente: { select: { usuario: { select: { email: true } } } },
      eventos: { select: { nome: true, status: true } },
    },
  });

  console.log(`\nOrganizadores (${organizadores.length}):`);

  for (const o of organizadores) {
    const email = o.cliente.usuario.email;
    const eventos = o.eventos.map((e) => `"${e.nome}" (${e.status})`).join(', ') || 'nenhum evento';

    if (!o.mpUserId) {
      console.log(`  [SEM CONEXAO] ${email} — nao conectou o Mercado Pago | ${eventos}`);
      continue;
    }

    const mesmaConta = o.mpUserId === idPlataforma;
    const marca = mesmaConta ? '[MESMA CONTA DA APLICACAO]' : '[OK]';

    console.log(
      `  ${marca} ${email} | mpUserId=${o.mpUserId} | comissao=${o.comissaoPercentual}% | ${eventos}`,
    );

    if (mesmaConta) {
      console.log(
        '      ^ e este que causa o "You cannot use application_fee with this payment".',
      );
    }
  }
}

main().finally(() => prisma.$disconnect());
