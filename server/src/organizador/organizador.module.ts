import { Module } from '@nestjs/common';
import { OrganizadorController } from './organizador.controller';
import { OrganizadorService } from './organizador.service';
import { PagamentoModule } from '../pagamento/pagamento.module';

@Module({
  imports: [PagamentoModule],
  controllers: [OrganizadorController],
  providers: [OrganizadorService],
  exports: [OrganizadorService],
})
export class OrganizadorModule {}
