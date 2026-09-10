// Diagnostico pontual: mostra a comissao realmente retida em cada pagamento.
// Nao altera nada — so le. Rodar de dentro de server/:  node conferir-comissoes.js
require('dotenv/config');
const { PrismaClient } = require(__dirname + '/dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const brl = (v) => (v === null || v === undefined ? '     -' : Number(v).toFixed(2).padStart(6));

(async () => {
  const pagamentos = await prisma.pagamento.findMany({
    where: { status: 'APROVADO' },
    select: {
      dataPagamento: true, gateway: true, metodo: true,
      valor: true, taxaGateway: true, valorLiquido: true, comissaoPlataforma: true,
    },
    orderBy: { dataPagamento: 'asc' },
  });

  console.log('\nDATA        GATEWAY       METODO   VALOR  TARIFA LIQUIDO COMISSAO');
  console.log('-'.repeat(66));
  let somaComissao = 0, somaValor = 0;
  for (const p of pagamentos) {
    const data = p.dataPagamento ? p.dataPagamento.toISOString().slice(0, 10) : '     -    ';
    console.log(
      data + '  ' + String(p.gateway || '-').padEnd(12) + '  ' +
      String(p.metodo || '-').padEnd(7) + ' ' + brl(p.valor) + ' ' +
      brl(p.taxaGateway) + ' ' + brl(p.valorLiquido) + '  ' + brl(p.comissaoPlataforma)
    );
    somaValor += Number(p.valor || 0);
    somaComissao += Number(p.comissaoPlataforma || 0);
  }
  console.log('-'.repeat(66));
  console.log('TOTAL bruto R$ ' + somaValor.toFixed(2) +
              '   |   comissao gravada R$ ' + somaComissao.toFixed(2));
  console.log('\n(comissao "-" = linha sem o dado; o painel calcula na hora para ela)\n');
  await prisma.$disconnect();
})().catch(async (e) => { console.error('ERRO:', e.message); await prisma.$disconnect(); process.exit(1); });
