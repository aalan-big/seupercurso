import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const NOME_EVENTO = 'Corrida de Verão SeuPercurso';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cliente = await prisma.cliente.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!cliente) {
    throw new Error(
      'Nenhum Cliente encontrado no banco. Crie uma conta e complete o perfil (PF ou PJ) via /teste/auth antes de rodar o seed.',
    );
  }

  const organizador = await prisma.organizador.upsert({
    where: { clienteId: cliente.id },
    update: {},
    create: {
      clienteId: cliente.id,
      status: 'APROVADO',
      comissaoPercentual: 10,
    },
  });
  console.log(
    `Organizador pronto (clienteId=${cliente.id}, organizadorId=${organizador.id})`,
  );

  const eventoExistente = await prisma.evento.findFirst({
    where: { organizadorId: organizador.id, nome: NOME_EVENTO },
  });
  if (eventoExistente) {
    console.log(
      `Evento "${NOME_EVENTO}" já existe (id=${eventoExistente.id}). Nada a fazer.`,
    );
    return;
  }

  const agora = new Date();
  const inicioVenda = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fimVenda = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dataEvento = new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000);

  const evento = await prisma.evento.create({
    data: {
      organizadorId: organizador.id,
      nome: NOME_EVENTO,
      descricao: 'Evento de exemplo criado pelo seed para desenvolvimento.',
      dataInicio: dataEvento,
      dataFim: dataEvento,
      local: 'Parque Ibirapuera',
      cidade: 'São Paulo',
      estado: 'SP',
      capacidade: 500,
      status: 'PUBLICADO',
      modalidades: {
        create: [
          {
            nome: '5km',
            distanciaKm: 5,
            categorias: {
              create: [
                { nome: 'Geral Masculino', genero: 'MASCULINO' },
                { nome: 'Geral Feminino', genero: 'FEMININO' },
              ],
            },
          },
          {
            nome: '10km',
            distanciaKm: 10,
            categorias: {
              create: [
                { nome: 'Geral Masculino', genero: 'MASCULINO' },
                { nome: 'Geral Feminino', genero: 'FEMININO' },
              ],
            },
          },
        ],
      },
    },
    include: { modalidades: true },
  });

  const [modalidade5km, modalidade10km] = evento.modalidades;

  await prisma.lote.create({
    data: {
      eventoId: evento.id,
      nome: '1º Lote',
      quantidade: 200,
      inicioVenda,
      fimVenda,
      precos: {
        create: [
          { modalidadeId: modalidade5km.id, valor: 60 },
          { modalidadeId: modalidade10km.id, valor: 90 },
        ],
      },
    },
  });

  console.log(
    `Evento "${evento.nome}" (id=${evento.id}) criado com 2 modalidades, 4 categorias e 1 lote ativo.`,
  );
}

main()
  .catch((error) => {
    console.error('Erro ao rodar o seed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
