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
  app.enableCors({
    origin: true,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

}
bootstrap();
