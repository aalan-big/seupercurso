import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const eventos = await prisma.evento.findMany({
    include: { organizador: { include: { cliente: { include: { usuario: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  for (const e of eventos) {
    console.log(
      `${e.id} | "${e.nome}" | status=${e.status} | organizador=${e.organizador.cliente.usuario.email}`,
    );
  }
}

main().finally(() => prisma.$disconnect());
