import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { StatusOrganizador } from '../generated/prisma/enums';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organizadores = await prisma.organizador.findMany({
    where: { status: StatusOrganizador.PENDENTE },
    include: { cliente: { include: { usuario: true, pf: true, pj: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (organizadores.length === 0) {
    console.log('Nenhuma solicitação de organizador pendente.');
    return;
  }

  for (const o of organizadores) {
    console.log(
      `${o.cliente.usuario.email} — ${o.cliente.pj?.razaoSocial || o.cliente.pf?.nomeCompleto || '(sem nome)'} — solicitado em ${o.createdAt.toISOString()}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
