import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailService } from '../email/email.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  console.log('🚀 Disparando e-mail de teste para bigteste881@gmail.com e aalanallvesgt@gmail.com...');

  const res = await emailService.enviarConfirmacaoInscricaoBatch({
    emailComprador: 'bigteste881@gmail.com',
    nomeComprador: 'Alan Alves de Amorim',
    nomeEvento: 'Grande Corrida BigTec 2026',
    dataEvento: '15/10/2026 às 06:00',
    localEvento: 'Parque da Cidade',
    cidadeEstado: 'Iguatu/CE',
    valorTotal: '150.00',
    atletas: [
      {
        inscricaoId: 'INS-2026-001-MICHEL',
        nomeAtleta: 'Michel da Silva',
        cpfAtleta: '825.057.240-83',
        modalidade: 'Corrida 10KM',
        categoria: 'Geral Masculino',
        tamanhoCamisa: 'M',
        numeroPeito: '3',
        valor: '75.00',
      },
      {
        inscricaoId: 'INS-2026-002-ALAN',
        nomeAtleta: 'Alan Alves de Amorim',
        cpfAtleta: '064.665.563-95',
        modalidade: 'Corrida 10KM',
        categoria: 'Geral Masculino',
        tamanhoCamisa: 'GG',
        numeroPeito: '1',
        valor: '75.00',
      },
    ],
  });

  console.log('✅ Resultado do Disparo:', res);
  await app.close();
}

bootstrap();
