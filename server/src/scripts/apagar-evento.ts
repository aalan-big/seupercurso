import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const EVENTO_ID = process.argv[2];

if (!EVENTO_ID) {
  console.error('Uso: node apagar-evento.js <eventoId>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.loteModalidadePreco.deleteMany({
      where: { modalidade: { eventoId: EVENTO_ID } },
    });
    await tx.categoria.deleteMany({
      where: { modalidade: { eventoId: EVENTO_ID } },
    });
    await tx.modalidade.deleteMany({ where: { eventoId: EVENTO_ID } });
    await tx.lote.deleteMany({ where: { eventoId: EVENTO_ID } });
    await tx.patrocinador.deleteMany({ where: { eventoId: EVENTO_ID } });
    await tx.staff.deleteMany({ where: { eventoId: EVENTO_ID } });
    await tx.evento.delete({ where: { id: EVENTO_ID } });
  });

  console.log(`Evento ${EVENTO_ID} removido.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
