import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ArteService } from './arte.service';
import { SolicitarArteDto } from './dto/solicitar-arte.dto';

@UseGuards(JwtAuthGuard)
@Controller('organizadores/me')
export class ArteController {
  constructor(private readonly arteService: ArteService) {}

  @Get('arte/preco')
  obterPreco() {
    return this.arteService.obterPreco();
  }

  @Get('solicitacoes-arte')
  listarMinhas(@CurrentUser() user: AuthenticatedUser) {
    return this.arteService.listarMinhas(user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:id/solicitar-arte')
  solicitar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
    @Body() dto: SolicitarArteDto,
  ) {
    return this.arteService.solicitar(user.userId, eventoId, dto.observacoes);
  }
}
