import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventoService } from './evento.service';

@Controller('eventos')
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  @Get()
  findPublicados() {
    return this.eventoService.findPublicados();
  }

  @Get(':id/validar-cupom')
  validarCupom(@Param('id') id: string, @Query('codigo') codigo: string) {
    return this.eventoService.validarCupom(id, codigo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventoService.findOneDetalhado(id);
  }
}
