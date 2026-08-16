import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PagamentoService } from './pagamento.service';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';

@UseGuards(JwtAuthGuard)
@Controller('pagamentos')
export class PagamentoController {
  constructor(private readonly pagamentoService: PagamentoService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePagamentoDto,
  ) {
    return this.pagamentoService.create(user.userId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/simular-aprovacao')
  simularAprovacao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pagamentoService.simularAprovacao(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/simular-recusa')
  simularRecusa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pagamentoService.simularRecusa(user.userId, id);
  }
}
