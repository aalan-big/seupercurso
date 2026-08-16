import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';

const EMAIL = process.argv[2];
const SENHA = process.argv[3];
const NOME = process.argv[4];

if (!EMAIL || !SENHA || !NOME) {
  console.error('Uso: node dist/scripts/criar-admin.js <email> <senha> <nome>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existente = await prisma.admin.findUnique({ where: { email: EMAIL } });
  if (existente) {
    console.log(`Já existe um admin com o e-mail ${EMAIL}.`);
    return;
  }

  const passwordHash = await bcrypt.hash(SENHA, 12);

  await prisma.admin.create({
    data: { email: EMAIL, passwordHash, nome: NOME },
  });

  console.log(`Admin ${NOME} <${EMAIL}> criado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
