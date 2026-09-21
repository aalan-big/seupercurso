import { Module } from '@nestjs/common';
import { OrganizadorController } from './organizador.controller';
import { OrganizadorService } from './organizador.service';
import { ServidorPublicoService } from './servidor-publico.service';
import { ServidorPublicoParserService } from './servidor-publico-parser.service';
import { PagamentoModule } from '../pagamento/pagamento.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PagamentoModule, EmailModule],
  controllers: [OrganizadorController],
  providers: [
    OrganizadorService,
    ServidorPublicoService,
    ServidorPublicoParserService,
  ],
  exports: [OrganizadorService, ServidorPublicoService],
})
export class OrganizadorModule {}
