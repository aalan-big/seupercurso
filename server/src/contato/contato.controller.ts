import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ContatoService } from './contato.service';
import { CreateContatoDto } from './dto/create-contato.dto';

@Controller('contato')
export class ContatoController {
  constructor(private readonly contatoService: ContatoService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  enviar(@Body() dto: CreateContatoDto) {
    return this.contatoService.enviar(dto);
  }
}
