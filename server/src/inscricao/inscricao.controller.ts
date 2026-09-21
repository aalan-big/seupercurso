import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { InscricaoService } from './inscricao.service';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';
import { CreateInscricaoBatchDto } from './dto/create-inscricao-batch.dto';
import { UpdateTamanhoCamisaDto } from './dto/update-tamanho-camisa.dto';
import { TrocarCategoriaDto } from './dto/trocar-categoria.dto';
import { TransferirInscricaoDto } from './dto/transferir-inscricao.dto';
import { ValidarServidorDto } from './dto/validar-servidor.dto';

@Controller('inscricoes')
export class InscricaoController {
  constructor(private readonly inscricaoService: InscricaoService) {}

  @HttpCode(HttpStatus.OK)
  @Post('validar-servidor')
  validarServidor(@Body() dto: ValidarServidorDto) {
    return this.inscricaoService.validarServidor(dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInscricaoDto,
  ) {
    return this.inscricaoService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('batch')
  createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInscricaoBatchDto,
  ) {
    return this.inscricaoService.createBatch(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMinhas(@CurrentUser() user: AuthenticatedUser) {
    return this.inscricaoService.findMinhas(user.userId);
  }

  /**
   * Recebe o documento com foto de um atleta 60+ antes da inscricao existir:
   * o carrinho e montado no navegador e so vira inscricao no batch, entao o
   * arquivo sobe antes e o caminho devolvido vai no item. Permite upload
   * anonimo na montagem do carrinho para visitantes vindos de redes sociais.
   */
  @Post('documento-idoso')
  @UseInterceptors(
    FileInterceptor('documento', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dest = join(process.cwd(), 'uploads', 'documentos');
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          callback(null, dest);
        },
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
          callback(new BadRequestException('Envie uma imagem ou um PDF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadDocumentoIdoso(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return { url: `/uploads/documentos/${file.filename}` };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancelar')
  cancelar(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.inscricaoService.cancelar(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/tamanho-camisa')
  atualizarTamanhoCamisa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTamanhoCamisaDto,
  ) {
    return this.inscricaoService.atualizarTamanhoCamisa(
      user.userId,
      id,
      dto.tamanhoCamisa,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/trocar-categoria')
  trocarCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TrocarCategoriaDto,
  ) {
    return this.inscricaoService.trocarCategoria(
      user.userId,
      id,
      dto.novaCategoriaId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transferir')
  transferirInscricao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransferirInscricaoDto,
  ) {
    return this.inscricaoService.transferirInscricao(
      user.userId,
      id,
      dto.emailDestino,
    );
  }
}
