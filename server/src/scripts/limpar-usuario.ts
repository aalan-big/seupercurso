import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '../generated/prisma/client';
import { PrismaClient } from '../generated/prisma/client';

const EMAIL = process.argv[2];

if (!EMAIL) {
  console.error('Uso: ts-node limpar-usuario.ts <email>');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: EMAIL },
    include: {
      cliente: {
        include: {
          inscricoes: true,
          enderecos: true,
          pf: true,
          pj: true,
          organizador: true,
        },
      },
    },
  });

  if (!usuario) {
    console.log(`Nenhum usuário encontrado com o e-mail ${EMAIL}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const cliente = usuario.cliente;

    if (cliente) {
      for (const inscricao of cliente.inscricoes) {
        await tx.pagamento.deleteMany({ where: { inscricaoId: inscricao.id } });
        await tx.certificado.deleteMany({ where: { inscricaoId: inscricao.id } });
        await tx.resultado.deleteMany({ where: { inscricaoId: inscricao.id } });
      }
      await tx.inscricao.deleteMany({ where: { clienteId: cliente.id } });
      await tx.endereco.deleteMany({ where: { clienteId: cliente.id } });
      if (cliente.pf) await tx.clientePf.delete({ where: { clienteId: cliente.id } });
      if (cliente.pj) await tx.clientePj.delete({ where: { clienteId: cliente.id } });
      if (cliente.organizador) {
        await excluirEventosDoOrganizador(tx, cliente.organizador.id);
        await tx.organizador.delete({ where: { clienteId: cliente.id } });
      }
      await tx.cliente.delete({ where: { id: cliente.id } });
    }

    await tx.usuario.delete({ where: { id: usuario.id } });
  }, { timeout: 30000 });

  console.log(`Usuário ${EMAIL} e todos os dados relacionados foram removidos.`);
}

async function excluirEventosDoOrganizador(
  tx: Prisma.TransactionClient,
  organizadorId: string,
) {
  const eventos = await tx.evento.findMany({
    where: { organizadorId },
    select: { id: true },
  });

  for (const { id: eventoId } of eventos) {
    const modalidades = await tx.modalidade.findMany({
      where: { eventoId },
      select: { id: true },
    });
    const lotes = await tx.lote.findMany({
      where: { eventoId },
      select: { id: true },
    });

    for (const { id: modalidadeId } of modalidades) {
      await tx.loteModalidadePreco.deleteMany({ where: { modalidadeId } });
      await tx.categoria.deleteMany({ where: { modalidadeId } });
    }
    for (const { id: loteId } of lotes) {
      await tx.loteModalidadePreco.deleteMany({ where: { loteId } });
    }

    await tx.modalidade.deleteMany({ where: { eventoId } });
    await tx.lote.deleteMany({ where: { eventoId } });
    await tx.patrocinador.deleteMany({ where: { eventoId } });
    await tx.staff.deleteMany({ where: { eventoId } });
    await tx.cupom.deleteMany({ where: { eventoId } });
  }

  await tx.evento.deleteMany({ where: { organizadorId } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
