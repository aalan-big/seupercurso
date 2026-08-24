import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Limpando o banco de dados completamente...');

  // Deletar em ordem respeitando as constraints de chave estrangeira
  await prisma.auditLog.deleteMany({});
  await prisma.resultado.deleteMany({});
  await prisma.certificado.deleteMany({});
  await prisma.pagamento.deleteMany({});
  await prisma.inscricao.deleteMany({});
  await prisma.cupom.deleteMany({});
  await prisma.loteModalidadePreco.deleteMany({});
  await prisma.lote.deleteMany({});
  await prisma.categoria.deleteMany({});
  await prisma.modalidade.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.patrocinador.deleteMany({});
  await prisma.evento.deleteMany({});
  await prisma.organizador.deleteMany({});
  await prisma.endereco.deleteMany({});
  await prisma.clientePj.deleteMany({});
  await prisma.clientePf.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.usuario.deleteMany({});
  await prisma.admin.deleteMany({});

  console.log('✅ Banco de dados limpo com sucesso!');

  console.log('👤 Criando usuário Admin (bigtec07@gmail.com)...');
  const passwordHash = await bcrypt.hash('teste1234', 12);

  // 1. Criar conta no Admin (para painel Admin)
  const admin = await prisma.admin.create({
    data: {
      email: 'bigtec07@gmail.com',
      passwordHash,
      nome: 'Administrador',
    },
  });

  // 2. Criar conta no Usuario + Cliente + PF + Organizador (para login no Client e Organizer)
  const usuario = await prisma.usuario.create({
    data: {
      email: 'bigtec07@gmail.com',
      passwordHash,
      emailVerificado: true,
      cliente: {
        create: {
          pf: {
            create: {
              nomeCompleto: 'Administrador Bigtec',
              cpf: '000.000.000-00',
              dataNascimento: new Date('1990-01-01'),
              genero: 'MASCULINO',
              celular: '(88) 99999-9999',
            },
          },
          organizador: {
            create: {
              status: 'APROVADO',
              comissaoPercentual: 10.0,
            },
          },
        },
      },
    },
  });

  console.log('🚀 Sucesso! Conta Admin e Organizador criada:');
  console.log('📧 E-mail: bigtec07@gmail.com');
  console.log('🔑 Senha: teste1234');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar o banco:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
