import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const EMAIL = process.argv[2];
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: EMAIL },
    include: { cliente: { include: { pf: true, enderecos: true } } },
  });
  console.log(JSON.stringify(usuario, null, 2));
}

main().finally(() => prisma.$disconnect());
