import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { OrganizadorService } from './organizador.service';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { CreateModalidadeDto } from './dto/create-modalidade.dto';
import { UpdateModalidadeDto } from './dto/update-modalidade.dto';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { DefinirPrecoDto } from './dto/definir-preco.dto';
import { CreateCupomDto } from './dto/create-cupom.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { RedefinirSenhaStaffDto } from './dto/redefinir-senha-staff.dto';

@UseGuards(JwtAuthGuard)
@Controller('organizadores/me')
export class OrganizadorController {
  constructor(private readonly organizadorService: OrganizadorService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  solicitarCadastro(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.solicitarCadastro(user.userId);
  }

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.getMe(user.userId);
  }

  @Get('dashboard')
  obterDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.obterDashboard(user.userId);
  }

  @Get('financeiro')
  obterFinanceiro(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.obterFinanceiro(user.userId);
  }

  /** URL de autorizacao; o organizador conclui no site do Mercado Pago. */
  @Get('mercadopago/conexao')
  obterUrlConexaoMercadoPago(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.obterUrlConexaoMercadoPago(user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mercadopago/conexao')
  conectarMercadoPago(
    @CurrentUser() user: AuthenticatedUser,
    @Body('code') code: string,
    @Body('state') state: string,
  ) {
    return this.organizadorService.conectarMercadoPago(user.userId, code, state);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('mercadopago/conexao')
  desconectarMercadoPago(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.desconectarMercadoPago(user.userId);
  }

  @Get('staff')
  listarStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.listarStaff(user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('staff')
  criarStaff(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffDto) {
    return this.organizadorService.criarStaff(user.userId, dto);
  }

  @Patch('staff/:id')
  atualizarStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.organizadorService.atualizarStaff(user.userId, id, dto);
  }

  @Patch('staff/:id/senha')
  redefinirSenhaStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('novaSenha') novaSenha: string,
  ) {
    return this.organizadorService.redefinirSenhaStaff(user.userId, id, novaSenha);
  }

  @Delete('staff/:id')
  removerStaff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizadorService.removerStaff(user.userId, id);
  }

  @Patch('foto-rosto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dest = './uploads/documentos';
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          callback(null, dest);
        },
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `selfie-${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('Envie uma imagem para a foto do rosto.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadFotoRosto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de foto enviado.');
    }
    return this.organizadorService.atualizarFotoRosto(
      user.userId,
      `/uploads/documentos/${file.filename}`,
    );
  }

  @Patch('documento-identidade')
  @UseInterceptors(
    FileInterceptor('documento', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dest = './uploads/documentos';
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
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
          callback(
            new BadRequestException('Envie uma imagem ou um PDF.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )

  uploadDocumentoIdentidade(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.organizadorService.atualizarDocumentoIdentidade(
      user.userId,
      `/uploads/documentos/${file.filename}`,
    );
  }

  @Get('eventos')
  listarMeusEventos(@CurrentUser() user: AuthenticatedUser) {
    return this.organizadorService.listarMeusEventos(user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos')
  criarEvento(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventoDto,
  ) {
    return this.organizadorService.criarEvento(user.userId, dto);
  }

  @Get('eventos/:id')
  buscarMeuEvento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.organizadorService.buscarMeuEvento(user.userId, id);
  }

  @Get('eventos/:eventoId/kits')
  obterKits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
  ) {
    return this.organizadorService.obterKits(user.userId, eventoId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('eventos/:eventoId/gerar-numeracao-peito')
  gerarNumeracaoPeito(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Body('numeroInicial') numeroInicial?: number,
  ) {
    return this.organizadorService.gerarNumeracaoPeito(
      user.userId,
      eventoId,
      numeroInicial ? Number(numeroInicial) : 101,
    );
  }

  @Patch('eventos/:id')
  atualizarEvento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventoDto,
  ) {
    return this.organizadorService.atualizarEvento(user.userId, id, dto);
  }

  @Patch('eventos/:id/banner')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: './uploads/eventos',
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Envie um arquivo de imagem.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadBanner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.organizadorService.atualizarMidiaEvento(
      user.userId,
      id,
      'bannerUrl',
      `/uploads/eventos/${file.filename}`,
    );
  }

  @Patch('eventos/:eventoId/modalidades/:modalidadeId/mapa-percurso')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: './uploads/eventos',
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
          callback(new BadRequestException('Envie uma imagem ou um PDF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadMapaPercurso(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.organizadorService.atualizarMidiaModalidade(
      user.userId,
      eventoId,
      modalidadeId,
      `/uploads/eventos/${file.filename}`,
    );
  }

  @Patch('eventos/:id/regulamento')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: './uploads/eventos',
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          callback(new BadRequestException('Envie um arquivo PDF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadRegulamento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.organizadorService.atualizarMidiaEvento(
      user.userId,
      id,
      'regulamentoUrl',
      `/uploads/eventos/${file.filename}`,
    );
  }

  @Get('eventos/:eventoId/resultados')
  listarResultados(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
  ) {
    return this.organizadorService.listarResultados(user.userId, eventoId);
  }

  @Post('eventos/:eventoId/resultados/importar')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  importarResultados(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.organizadorService.importarResultados(
      user.userId,
      eventoId,
      file.buffer.toString('utf-8'),
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/certificados/gerar')
  gerarCertificados(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
  ) {
    return this.organizadorService.gerarCertificados(user.userId, eventoId);
  }

  @Get('eventos/:eventoId/checkin')
  buscarParaCheckin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Query('busca') busca?: string,
  ) {
    return this.organizadorService.buscarParaCheckin(user.userId, eventoId, busca);
  }

  @Post('eventos/:eventoId/checkin/:inscricaoId')
  confirmarEntregaKit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('inscricaoId') inscricaoId: string,
  ) {
    return this.organizadorService.confirmarEntregaKit(
      user.userId,
      eventoId,
      inscricaoId,
    );
  }

  @Delete('eventos/:eventoId/checkin/:inscricaoId')
  desfazerEntregaKit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('inscricaoId') inscricaoId: string,
  ) {
    return this.organizadorService.desfazerEntregaKit(
      user.userId,
      eventoId,
      inscricaoId,
    );
  }

  @Get('inscritos')
  listarInscritos(
    @CurrentUser() user: AuthenticatedUser,
    @Query('eventoId') eventoId?: string,
    @Query('status') status?: string,
    @Query('busca') busca?: string,
  ) {
    return this.organizadorService.listarInscritos(user.userId, {
      eventoId,
      status,
      busca,
    });
  }

  @Patch('inscritos/:id')
  atualizarInscricao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { numeroPeito?: string; tamanhoCamisa?: string; categoriaId?: string; status?: any },
  ) {
    return this.organizadorService.atualizarInscricao(user.userId, id, dto);
  }

  @Get('inscritos/exportar')
  async exportarInscritos(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('eventoId') eventoId?: string,
    @Query('status') status?: string,
    @Query('busca') busca?: string,
    @Query('formato') formato?: string,
  ) {
    const filtros = { eventoId, status, busca };

    if (formato === 'pdf') {
      const buffer = await this.organizadorService.exportarInscritosPdf(
        user.userId,
        filtros,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="lista-de-largada.pdf"',
      );
      res.send(buffer);
      return;
    }

    const buffer = await this.organizadorService.exportarInscritosXlsx(
      user.userId,
      filtros,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inscritos.xlsx"',
    );
    res.send(buffer);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/modalidades')
  criarModalidade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Body() dto: CreateModalidadeDto,
  ) {
    return this.organizadorService.criarModalidade(user.userId, eventoId, dto);
  }

  @Patch('eventos/:eventoId/modalidades/:modalidadeId')
  atualizarModalidade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
    @Body() dto: UpdateModalidadeDto,
  ) {
    return this.organizadorService.atualizarModalidade(
      user.userId,
      eventoId,
      modalidadeId,
      dto,
    );
  }

  @Delete('eventos/:eventoId/modalidades/:modalidadeId')
  removerModalidade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
  ) {
    return this.organizadorService.removerModalidade(
      user.userId,
      eventoId,
      modalidadeId,
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/modalidades/:modalidadeId/categorias')
  criarCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
    @Body() dto: CreateCategoriaDto,
  ) {
    return this.organizadorService.criarCategoria(
      user.userId,
      eventoId,
      modalidadeId,
      dto,
    );
  }

  @Patch('eventos/:eventoId/modalidades/:modalidadeId/categorias/:categoriaId')
  atualizarCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
    @Param('categoriaId') categoriaId: string,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.organizadorService.atualizarCategoria(
      user.userId,
      eventoId,
      modalidadeId,
      categoriaId,
      dto,
    );
  }

  @Delete('eventos/:eventoId/modalidades/:modalidadeId/categorias/:categoriaId')
  removerCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('modalidadeId') modalidadeId: string,
    @Param('categoriaId') categoriaId: string,
  ) {
    return this.organizadorService.removerCategoria(
      user.userId,
      eventoId,
      modalidadeId,
      categoriaId,
    );
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/lotes')
  criarLote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Body() dto: CreateLoteDto,
  ) {
    return this.organizadorService.criarLote(user.userId, eventoId, dto);
  }

  @Patch('eventos/:eventoId/lotes/:loteId')
  atualizarLote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('loteId') loteId: string,
    @Body() dto: UpdateLoteDto,
  ) {
    return this.organizadorService.atualizarLote(
      user.userId,
      eventoId,
      loteId,
      dto,
    );
  }

  @Delete('eventos/:eventoId/lotes/:loteId')
  removerLote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('loteId') loteId: string,
  ) {
    return this.organizadorService.removerLote(user.userId, eventoId, loteId);
  }

  @Put('eventos/:eventoId/lotes/:loteId/precos/:modalidadeId')
  definirPreco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('loteId') loteId: string,
    @Param('modalidadeId') modalidadeId: string,
    @Body() dto: DefinirPrecoDto,
  ) {
    return this.organizadorService.definirPreco(
      user.userId,
      eventoId,
      loteId,
      modalidadeId,
      dto,
    );
  }

  @Get('eventos/:eventoId/cupons')
  listarCupons(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
  ) {
    return this.organizadorService.listarCupons(user.userId, eventoId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('eventos/:eventoId/cupons')
  criarCupom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Body() dto: CreateCupomDto,
  ) {
    return this.organizadorService.criarCupom(user.userId, eventoId, dto);
  }

  @Delete('eventos/:eventoId/cupons/:cupomId')
  removerCupom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventoId') eventoId: string,
    @Param('cupomId') cupomId: string,
  ) {
    return this.organizadorService.removerCupom(user.userId, eventoId, cupomId);
  }
}
