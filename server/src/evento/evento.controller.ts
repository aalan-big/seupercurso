import { Controller, Get, Param } from '@nestjs/common';
import { EventoService } from './evento.service';

@Controller('eventos')
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  @Get()
  findPublicados() {
    return this.eventoService.findPublicados();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventoService.findOneDetalhado(id);
  }
}
