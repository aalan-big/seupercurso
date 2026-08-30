import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { ContatoController } from './contato.controller';
import { ContatoService } from './contato.service';

@Module({
  imports: [EmailModule],
  controllers: [ContatoController],
  providers: [ContatoService],
})
export class ContatoModule {}
