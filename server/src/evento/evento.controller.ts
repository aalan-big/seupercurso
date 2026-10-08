import { Controller, Get, NotFoundException, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  /**
   * Moldura "Eu vou" do evento. Sai por aqui (e não por /uploads) porque o site monta
   * a arte num canvas e precisa dos cabeçalhos de CORS, que o estático não manda.
   */
  @Get(':id/moldura-eu-vou')
  async molduraEuVou(@Param('id') id: string, @Res() res: Response) {
    const arquivo = await this.eventoService.arquivoMolduraEuVou(id);
    res.sendFile(
      arquivo,
      { headers: { 'Cache-Control': 'public, max-age=300' } },
      (erro) => {
        if (erro && !res.headersSent) {
          res.status(404).json(new NotFoundException('Moldura não encontrada.').getResponse());
        }
      },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventoService.findOneDetalhado(id);
  }
}
