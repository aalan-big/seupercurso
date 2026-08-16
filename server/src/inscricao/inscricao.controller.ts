import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { InscricaoService } from './inscricao.service';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';

@UseGuards(JwtAuthGuard)
@Controller('inscricoes')
export class InscricaoController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInscricaoDto,
  ) {
    return this.inscricaoService.create(user.userId, dto);
  }

  @Get('me')
  findMinhas(@CurrentUser() user: AuthenticatedUser) {
    return this.inscricaoService.findMinhas(user.userId);
  }

  @Patch(':id/cancelar')
  cancelar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inscricaoService.cancelar(user.userId, id);
  }
}
