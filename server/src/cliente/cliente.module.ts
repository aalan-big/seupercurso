import { Module } from '@nestjs/common';
import { ClienteController } from './cliente.controller';
import { ClienteService } from './cliente.service';
import { AlteracaoDocumentoService } from './alteracao-documento.service';

@Module({
  controllers: [ClienteController],
  providers: [ClienteService, AlteracaoDocumentoService],
  exports: [AlteracaoDocumentoService],
})
export class ClienteModule {}
