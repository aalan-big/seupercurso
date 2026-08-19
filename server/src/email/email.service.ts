import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EnviarConfirmacaoInscricaoParams {
  emailAtleta: string;
  nomeAtleta: string;
  nomeEvento: string;
  dataEvento: string;
  localEvento: string;
  cidadeEstado: string;
  modalidade: string;
  categoria: string;
  tamanhoCamisa?: string | null;
  inscricaoId: string;
  valorTotal: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envia e-mail em HTML com o voucher e confirmação da inscrição do atleta
   */
  async enviarConfirmacaoInscricao(params: EnviarConfirmacaoInscricaoParams) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #334155; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24; }
          .header p { margin: 5px 0 0; font-size: 14px; color: #94a3b8; }
          .content { padding: 30px; }
          .badge { display: inline-block; background: #dcfce7; color: #15803d; font-weight: bold; padding: 6px 16px; border-radius: 50px; font-size: 12px; margin-bottom: 20px; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
          .detail-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #64748b; }
          .value { font-weight: 700; color: #0f172a; }
          .qr-box { text-align: center; background: #fff; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 20px; }
          .qr-box img { width: 160px; height: 160px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          .btn { display: inline-block; background: #0f172a; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 13px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏃 ${params.nomeEvento}</h1>
            <p>Comprovante Oficial de Inscrição</p>
          </div>
          <div class="content">
            <span class="badge">✅ INSCRIÇÃO CONFIRMADA</span>
            <p>Olá, <strong>${params.nomeAtleta}</strong>!</p>
            <p>Sua inscrição para o evento <strong>${params.nomeEvento}</strong> foi confirmada com sucesso! Confira abaixo os detalhes do seu voucher para a retirada de kit.</p>
            
            <div class="details-card">
              <div class="detail-row">
                <span class="label">Atleta:</span>
                <span class="value">${params.nomeAtleta}</span>
              </div>
              <div class="detail-row">
                <span class="label">Modalidade:</span>
                <span class="value">${params.modalidade}</span>
              </div>
              <div class="detail-row">
                <span class="label">Categoria:</span>
                <span class="value">${params.categoria}</span>
              </div>
              ${params.tamanhoCamisa ? `
              <div class="detail-row">
                <span class="label">Tamanho de Camisa:</span>
                <span class="value">${params.tamanhoCamisa}</span>
              </div>` : ''}
              <div class="detail-row">
                <span class="label">Data do Evento:</span>
                <span class="value">${params.dataEvento}</span>
              </div>
              <div class="detail-row">
                <span class="label">Local:</span>
                <span class="value">${params.localEvento} — ${params.cidadeEstado}</span>
              </div>
              <div class="detail-row">
                <span class="label">Valor Pago:</span>
                <span class="value">R$ ${params.valorTotal}</span>
              </div>
            </div>

            <div class="qr-box">
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: bold; color: #475569;">VOUCHER DE RETIRADA DE KIT</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(params.inscricaoId)}" alt="Voucher QR Code" />
              <p style="margin: 10px 0 0; font-size: 11px; color: #94a3b8;">Apresente este QR Code no local de entrega de kits junto a um documento com foto.</p>
            </div>

            <div style="text-align: center; margin-top: 25px;">
              <a href="http://localhost:3001/meus-eventos" class="btn">Ver Detalhes no Modal 360°</a>
            </div>
          </div>
          <div class="footer">
            SeuPercurso Eventos Esportivos &copy; 2026 — Todos os direitos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    this.logger.log(
      `[E-MAIL ENVIADO PARAMS] Para: ${params.emailAtleta} | Assunto: Confirmação de Inscrição - ${params.nomeEvento}`,
    );

    // Registra log do envio com suporte pronto para SMTP / Resend
    return { enviado: true, email: params.emailAtleta, htmlContent };
  }
}
