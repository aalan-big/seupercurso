import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const LOTE_ID = process.argv[2];

if (!LOTE_ID) {
  console.error('Uso: node abrir-lote-agora.js <loteId>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const inicioVenda = new Date();
  inicioVenda.setUTCDate(inicioVenda.getUTCDate() - 1);

  const lote = await prisma.lote.update({
    where: { id: LOTE_ID },
    data: { inicioVenda },
  });

  console.log(`Lote "${lote.nome}" agora com início de venda em ${lote.inicioVenda.toISOString()}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
