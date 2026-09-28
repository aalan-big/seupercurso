import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const EMAIL = process.argv[2];
const NOME_EMPRESA = process.argv[3] || 'SeuPercurso Cronometragem';
const PAPEL = ((process.argv[4] || 'ADMIN').toUpperCase()) as 'ADMIN' | 'OPERADOR';

if (!EMAIL) {
  console.error(
    'Uso: npx ts-node src/scripts/vincular-cronometradora.ts <email> [nome_empresa] [papel]',
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: EMAIL },
  });

  if (!usuario) {
    console.error(`Usuário com e-mail "${EMAIL}" não foi encontrado no banco.`);
    return;
  }

  let crono = await prisma.cronometradora.findFirst({
    where: { nome: NOME_EMPRESA },
  });

  if (!crono) {
    const validaAte = new Date();
    validaAte.setFullYear(validaAte.getFullYear() + 1);

    crono = await prisma.cronometradora.create({
      data: {
        nome: NOME_EMPRESA,
        plano: 'Cronometragem anual',
        assinaturaValidaAte: validaAte,
        status: 'ATIVA',
      },
    });
    console.log(
      `Cronometradora criada: "${crono.nome}" (Válida até: ${crono.assinaturaValidaAte.toISOString()})`,
    );
  }

  await prisma.usuarioCronometragem.upsert({
    where: { usuarioId: usuario.id },
    create: {
      usuarioId: usuario.id,
      cronometradoraId: crono.id,
      papel: PAPEL,
      ativo: true,
    },
    update: {
      cronometradoraId: crono.id,
      papel: PAPEL,
      ativo: true,
    },
  });

  console.log(
    `Sucesso! Usuário "${EMAIL}" vinculado à "${crono.nome}" como papel ${PAPEL}.`,
  );
}

main().finally(() => prisma.$disconnect());
