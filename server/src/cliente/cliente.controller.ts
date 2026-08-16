import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { ClienteService } from './cliente.service';
import { CreateClientePfDto } from './dto/create-cliente-pf.dto';
import { CreateClientePjDto } from './dto/create-cliente-pj.dto';
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { UpdateClientePfDto } from './dto/update-cliente-pf.dto';
import { UpdateClientePjDto } from './dto/update-cliente-pj.dto';

@UseGuards(JwtAuthGuard)
@Controller('clientes/me')
export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.clienteService.getMe(user.userId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('pessoa-fisica')
  createPessoaFisica(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientePfDto,
  ) {
    return this.clienteService.createPessoaFisica(user.userId, dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('pessoa-juridica')
  createPessoaJuridica(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientePjDto,
  ) {
    return this.clienteService.createPessoaJuridica(user.userId, dto);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('endereco')
  createEndereco(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnderecoDto,
  ) {
    return this.clienteService.createEndereco(user.userId, dto);
  }

  @Patch('pessoa-fisica')
  updatePessoaFisica(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientePfDto,
  ) {
    return this.clienteService.updatePessoaFisica(user.userId, dto);
  }

  @Patch('pessoa-juridica')
  updatePessoaJuridica(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientePjDto,
  ) {
    return this.clienteService.updatePessoaJuridica(user.userId, dto);
  }

  @Patch('endereco')
  updateEndereco(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnderecoDto,
  ) {
    return this.clienteService.updateEndereco(user.userId, dto);
  }

  @Patch('foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: './uploads/perfil',
        filename: (_req, file, callback) => {
          const sufixo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `${sufixo}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('Envie um arquivo de imagem.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadFoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.clienteService.atualizarFoto(
      user.userId,
      `/uploads/perfil/${file.filename}`,
    );
  }

  @Patch('documento-pcd')
  @UseInterceptors(
    FileInterceptor('documento', {
      storage: diskStorage({
        destination: './uploads/documentos',
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
  uploadDocumentoPcd(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.clienteService.atualizarDocumentoPcd(
      user.userId,
      `/uploads/documentos/${file.filename}`,
    );
  }
}
