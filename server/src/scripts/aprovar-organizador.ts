import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { StatusOrganizador } from '../generated/prisma/enums';

const EMAIL = process.argv[2];

if (!EMAIL) {
  console.error('Uso: ts-node aprovar-organizador.ts <email>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: EMAIL },
    include: { cliente: { include: { organizador: true } } },
  });

  if (!usuario?.cliente?.organizador) {
    console.log(`Nenhuma solicitação de organizador encontrada para ${EMAIL}.`);
    return;
  }

  await prisma.organizador.update({
    where: { id: usuario.cliente.organizador.id },
    data: { status: StatusOrganizador.APROVADO },
  });

  console.log(`Organizador de ${EMAIL} aprovado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
