import { Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { CreateContatoDto } from './dto/create-contato.dto';

@Injectable()
export class ContatoService {
  constructor(private readonly emailService: EmailService) {}

  async enviar(dto: CreateContatoDto) {
    await this.emailService.enviarMensagemContato(dto);
    return { sucesso: true, mensagem: 'Mensagem enviada com sucesso! Em breve entraremos em contato.' };
  }
}
