import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventoService } from './evento.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

@Controller('eventos')
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  @Get()
  findPublicados() {
    return this.eventoService.findPublicados();
  }

  // Login opcional: com ele, as tentativas pendentes do proprio comprador nao
  // contam no limite do cupom (igual ao que a compra faz).
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/validar-cupom')
  validarCupom(
    @Param('id') id: string,
    @Query('codigo') codigo: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ) {
    return this.eventoService.validarCupom(id, codigo, user?.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventoService.findOneDetalhado(id);
  }
}
