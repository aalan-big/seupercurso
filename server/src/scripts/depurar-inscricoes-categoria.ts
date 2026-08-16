import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const CATEGORIA_ID = process.argv[2];

if (!CATEGORIA_ID) {
  console.error('Uso: node depurar-inscricoes-categoria.js <categoriaId>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const categoria = await prisma.categoria.findUnique({
    where: { id: CATEGORIA_ID },
    include: { modalidade: { include: { evento: true } } },
  });
  console.log('Categoria:', JSON.stringify(categoria, null, 2));

  const inscricoes = await prisma.inscricao.findMany({
    where: { categoriaId: CATEGORIA_ID },
    include: { cliente: { include: { pf: true, usuario: true } } },
  });

  for (const i of inscricoes) {
    console.log(
      `Inscrição ${i.id} | status=${i.status} | atleta=${i.cliente.usuario.email} | nome=${i.cliente.pf?.nomeCompleto} | nascimento=${i.cliente.pf?.dataNascimento?.toISOString()} | genero=${i.cliente.pf?.genero} | pcd=${i.cliente.pf?.pcd}`,
    );
  }

  if (inscricoes.length === 0) console.log('Nenhuma inscrição encontrada pra essa categoria.');
}

main().finally(() => prisma.$disconnect());
