import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { ArteService } from './arte.service';
import { PrecoArteDto } from './dto/preco-arte.dto';
import { MotivoDto } from '../admin/dto/motivo.dto';

@UseGuards(AdminJwtGuard)
@Controller('admin')
export class ArteAdminController {
  constructor(private readonly arteService: ArteService) {}

  @Get('configuracoes/preco-arte')
  obterPreco() {
    return this.arteService.obterPreco();
  }

  @Put('configuracoes/preco-arte')
  atualizarPreco(@Body() dto: PrecoArteDto) {
    return this.arteService.atualizarPreco(dto.valor);
  }

  @Get('solicitacoes-arte')
  listarTodas(@Query('status') status?: string) {
    return this.arteService.listarTodas(status);
  }

  @Get('solicitacoes-arte/:id')
  buscar(@Param('id') id: string) {
    return this.arteService.buscar(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('solicitacoes-arte/:id/iniciar-producao')
  iniciarProducao(@Param('id') id: string) {
    return this.arteService.iniciarProducao(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('solicitacoes-arte/:id/cancelar')
  cancelar(@Param('id') id: string, @Body() dto: MotivoDto) {
    return this.arteService.cancelar(id, dto.motivo);
  }

  @HttpCode(HttpStatus.OK)
  @Post('solicitacoes-arte/:id/entregar')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dest = './uploads/arte';
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          callback(null, dest);
        },
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `arte-${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  entregar(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo de arte enviado.');
    }
    return this.arteService.entregar(id, `/uploads/arte/${file.filename}`);
  }
}
