import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CotacaoCronometragemService } from './cotacao-cronometragem.service';
import { SolicitarCotacaoDto } from './dto/solicitar-cotacao.dto';
import { MotivoCotacaoDto } from './dto/motivo-cotacao.dto';

const PASTA_COMPROVANTES = './uploads/cronometragem';
const EXTENSOES_COMPROVANTE = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

@UseGuards(JwtAuthGuard)
@Controller('organizadores/me')
export class CotacaoCronometragemController {
  constructor(private readonly service: CotacaoCronometragemService) {}

  @Get('cotacoes-cronometragem')
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listarMinhas(user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/cotacoes-cronometragem')
  solicitar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId', ParseUUIDPipe) eventoId: string,
    @Body() dto: SolicitarCotacaoDto,
  ) {
    return this.service.solicitar(user.userId, eventoId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/aceitar')
  aceitar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.aceitar(user.userId, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/recusar')
  recusar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MotivoCotacaoDto,
  ) {
    return this.service.recusar(user.userId, id, dto.motivo);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/cancelar')
  cancelar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MotivoCotacaoDto,
  ) {
    return this.service.cancelarPeloOrganizador(user.userId, id, dto.motivo);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/comprovante')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          if (!existsSync(PASTA_COMPROVANTES)) {
            mkdirSync(PASTA_COMPROVANTES, { recursive: true });
          }
          callback(null, PASTA_COMPROVANTES);
        },
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `comprovante-${sufixo}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        const ok = EXTENSOES_COMPROVANTE.includes(extname(file.originalname).toLowerCase());
        callback(
          ok ? null : new BadRequestException('Envie o comprovante em PDF, JPG, PNG ou WEBP.'),
          ok,
        );
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  enviarComprovante(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum comprovante enviado.');
    }
    return this.service.enviarComprovante(
      user.userId,
      id,
      `/uploads/cronometragem/${file.filename}`,
    );
  }
}
