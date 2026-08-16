import { Module } from '@nestjs/common';
import { OrganizadorController } from './organizador.controller';
import { OrganizadorService } from './organizador.service';

@Module({
  controllers: [OrganizadorController],
  providers: [OrganizadorService],
  exports: [OrganizadorService],
})
export class OrganizadorModule {}
