import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const notifService = app.get(NotificacaoAdminService);

  console.log('🚀 Disparando notificação de teste de comissão (R$ 15,00)...');
  notifService.notificarComissao(15.00, 150.00);

  console.log('✅ Notificação enviada para o canal de tempo real com sucesso!');
  await app.close();
}

bootstrap();
