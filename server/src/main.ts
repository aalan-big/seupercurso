import 'dotenv/config';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const pastaUploads = join(process.cwd(), 'uploads', 'perfil');
  if (!existsSync(pastaUploads)) {
    mkdirSync(pastaUploads, { recursive: true });
  }

  const pastaUploadsEventos = join(process.cwd(), 'uploads', 'eventos');
  if (!existsSync(pastaUploadsEventos)) {
    mkdirSync(pastaUploadsEventos, { recursive: true });
  }

  const pastaUploadsDocumentos = join(process.cwd(), 'uploads', 'documentos');
  if (!existsSync(pastaUploadsDocumentos)) {
    mkdirSync(pastaUploadsDocumentos, { recursive: true });
  }

  const pastaUploadsArte = join(process.cwd(), 'uploads', 'arte');
  if (!existsSync(pastaUploadsArte)) {
    mkdirSync(pastaUploadsArte, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Origens explicitas: `origin: true` refletia qualquer site que chamasse a API
  // com as credenciais do usuario logado.
  const origensPermitidas = [
    process.env.CLIENT_URL,
    process.env.ORGANIZER_URL,
    process.env.ADMIN_URL,
    ...(process.env.NODE_ENV !== 'production'
      ? [
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
        ]
      : []),
  ].filter((url): url is string => !!url);

  app.enableCors({
    origin: (origin, callback) => {
      // Requisicoes sem Origin (curl, apps nativos, webhook do gateway) seguem valendo.
      if (!origin || origensPermitidas.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  });

  // Necessario para que @Ip() devolva o IP real do comprador atras do Nginx —
  // o antifraude do gateway rejeita cobrancas com o IP do proxy.
  app.set('trust proxy', 1);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

}
bootstrap();
