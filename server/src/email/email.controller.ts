import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EmailService } from './email.service';

@Controller('email-preview')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get(':tipo')
  preview(@Param('tipo') tipo: string, @Res() res: Response) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (tipo !== 'verificacao' && tipo !== 'recuperacao-senha') {
      throw new NotFoundException(
        'Tipos disponíveis: verificacao, recuperacao-senha',
      );
    }

    const html = this.emailService.gerarPreview(tipo);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
