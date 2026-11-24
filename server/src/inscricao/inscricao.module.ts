import { Module } from '@nestjs/common';
import { InscricaoController } from './inscricao.controller';
import { InscricaoService } from './inscricao.service';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule, PagamentoModule],
  controllers: [InscricaoController],
  providers: [InscricaoService],
})
export class InscricaoModule {}
