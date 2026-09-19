import { Module } from '@nestjs/common';
import { OrganizadorController } from './organizador.controller';
import { OrganizadorService } from './organizador.service';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PagamentoModule, EmailModule],
  controllers: [OrganizadorController],
  providers: [OrganizadorService],
  exports: [OrganizadorService],
})
export class OrganizadorModule {}
