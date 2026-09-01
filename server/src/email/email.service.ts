import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

export interface AtletaVoucherInfo {
  inscricaoId: string;
  nomeAtleta: string;
  cpfAtleta?: string | null;
  modalidade: string;
  categoria: string;
  tamanhoCamisa?: string | null;
  numeroPeito?: string | null;
  valor: string;
}

export interface EnviarConfirmacaoBatchParams {
  emailComprador: string;
  nomeComprador: string;
  nomeEvento: string;
  dataEvento: string;
  localEvento: string;
  cidadeEstado: string;
  valorTotal: string;
  atletas: AtletaVoucherInfo[];
}

export interface EnviarVerificacaoEmailParams {
  email: string;
  nome: string;
  token: string;
}

export interface EnviarRecuperacaoSenhaParams {
  email: string;
  nome: string;
  token: string;
}

export interface EnviarMensagemContatoParams {
  nome: string;
  email: string;
  assunto?: string;
  mensagem: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.inicializarTransporter();
  }

  private async inicializarTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP configurado com sucesso (${host}:${port})`);
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log(`SMTP Ethereal criado para preview real de e-mails (${testAccount.user})`);
      } catch (e) {
        this.logger.log('Não foi possível inicializar o transporter Ethereal.');
      }
    }
  }

  private async enviarMail(destinatario: string, assunto: string, html: string, replyTo?: string) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const fromResend = this.configService.get<string>('SMTP_FROM', 'Seu Percurso <onboarding@resend.dev>');
        const res = await resend.emails.send({
          from: fromResend,
          to: destinatario,
          subject: assunto,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        this.logger.log(`[RESEND ENVIADO DIRETO COM SUCESSO!] Para: ${destinatario} | ID: ${res.data?.id}`);
        return { enviado: true, resendId: res.data?.id };
      } catch (err) {
        this.logger.error(`Erro ao enviar e-mail via Resend API:`, err);
      }
    }

    const from = this.configService.get<string>('SMTP_FROM', 'Seu Percurso Inscrições <nao-responda@seupercurso.com.br>');

    if (!this.transporter) {
      await this.inicializarTransporter();
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: destinatario,
          subject: assunto,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.log(`[E-MAIL REAL ENVIADO VIA ETHEREAL!] Visualizar E-mail Completo: ${previewUrl}`);
        } else {
          this.logger.log(`[SMTP ENVIADO] Para: ${destinatario} | Assunto: ${assunto}`);
        }
        return { enviado: true, previewUrl: previewUrl || undefined };
      } catch (err) {
        this.logger.error(`Erro ao enviar e-mail via SMTP para ${destinatario}:`, err);
      }
    }

    this.logger.log(`[E-MAIL SIMULADO] Para: ${destinatario} | Assunto: ${assunto}`);
    return { enviado: true, mock: true };
  }

  private getAppUrl(): string {
    const defaultUrl = process.env.NODE_ENV === 'production' ? 'https://seupercurso.esp.br' : 'http://localhost:3001';
    return this.configService.get<string>('CLIENT_URL', defaultUrl) || defaultUrl;
  }

  /**
   * Layout HTML padrão no estilo Seu Percurso (Laranja / Branco / Clean)
   */
  private renderBaseTemplate(options: {
    tituloHeader: string;
    subtituloHeader: string;
    conteudoHtml: string;
  }): string {
    const anoAtual = new Date().getFullYear();
    const appUrl = this.getAppUrl();

    const logoUrl = 'https://i.imgur.com/rMu2lvw.png';
    const logoHtml = `<img src="${logoUrl}" alt="Seu Percurso" style="height: 56px; max-width: 240px; object-fit: contain; margin: 0 auto 10px; display: block;" />`;

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.tituloHeader}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; line-height: 1.6; }
          .wrapper { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
          .header { background-color: #ffffff; padding: 32px 24px 20px; text-align: center; border-bottom: 3px solid #f97316; }
          .header h1 { margin: 10px 0 0; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
          .header p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 700; }
          .body { padding: 32px 24px; }
          .badge-success { display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
          .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 20px 0; }
          .btn-primary { display: inline-block; background-color: #f97316; color: #ffffff !important; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; padding: 14px 32px; border-radius: 14px; text-decoration: none; shadow: 0 4px 12px rgba(249, 115, 22, 0.3); }
          .btn-primary:hover { background-color: #ea580c; }
          .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
          .footer a { color: #f97316; text-decoration: none; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <a href="${appUrl}" style="text-decoration: none; display: block;">
              ${logoHtml}
            </a>
            <h1>${options.tituloHeader}</h1>
            <p>${options.subtituloHeader}</p>
          </div>
          <div class="body">
            ${options.conteudoHtml}
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px;"><strong>Seu Percurso — Gestão de Eventos Esportivos</strong></p>
            <p style="margin: 0;">Dúvidas? Entre em contato pelo nosso e-mail <a href="mailto:suporte@seupercurso.com.br">suporte@seupercurso.com.br</a></p>
            <p style="margin: 12px 0 0; font-size: 11px; color: #94a3b8;">&copy; ${anoAtual} Seu Percurso. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 1. E-mail de Verificação de Conta após Cadastro
   */
  async enviarEmailVerificacao(params: EnviarVerificacaoEmailParams) {
    const html = this.montarHtmlVerificacao(params);
    return this.enviarMail(params.email, 'Confirme seu E-mail — Seu Percurso', html);
  }

  private montarHtmlVerificacao(params: EnviarVerificacaoEmailParams): string {
    const appUrl = this.getAppUrl();
    const linkVerificacao = `${appUrl}/verificar-email?token=${encodeURIComponent(params.token)}`;

    const conteudoHtml = `
      <div style="display: inline-flex; align-items: center; background-color: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; font-size: 12px; font-weight: 800; padding: 6px 16px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Falta só um passo
      </div>
      <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 0;">Olá, ${params.nome}!</p>
      <p style="color: #475569;">Obrigado por se cadastrar no <strong>Seu Percurso</strong>! Para garantir a segurança da sua conta e poder se inscrever em provas e corridas, confirme seu endereço de e-mail.</p>

      <div class="card">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; display: flex; align-items: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          POR QUE CONFIRMAR
        </div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">✓ Protege sua conta contra acessos indevidos</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;">✓ Libera inscrições em eventos e emissão de voucher</div>
        <div style="font-size: 13px; color: #475569;">✓ Garante que avisos sobre suas inscrições cheguem certinho</div>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${linkVerificacao}" class="btn-primary" style="display:inline-block;background-color:#f97316;color:#ffffff;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;padding:14px 32px;border-radius:14px;text-decoration:none;">Confirmar Meu E-mail</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Ou copie e cole este link no seu navegador:<br><a href="${linkVerificacao}" style="color: #f97316; word-break: break-all;">${linkVerificacao}</a></p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Este link é válido por 24 horas. Se você não realizou este cadastro, pode ignorar este e-mail.</p>
    `;

    return this.renderBaseTemplate({
      tituloHeader: 'Confirme seu E-mail',
      subtituloHeader: 'Validação de conta no Seu Percurso',
      conteudoHtml,
    });
  }

  /**
   * 2. E-mail de Recuperação de Senha
   */
  async enviarEmailRecuperacaoSenha(params: EnviarRecuperacaoSenhaParams) {
    const html = this.montarHtmlRecuperacaoSenha(params);
    return this.enviarMail(params.email, 'Recuperação de Senha — Seu Percurso', html);
  }

  private montarHtmlRecuperacaoSenha(params: EnviarRecuperacaoSenhaParams): string {
    const appUrl = this.getAppUrl();
    const linkRedefinicao = `${appUrl}/redefinir-senha?token=${encodeURIComponent(params.token)}`;

    const conteudoHtml = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Olá, ${params.nome}!</p>
      <p style="color: #475569;">Recebemos uma solicitação de redefinição de senha para a sua conta no <strong>Seu Percurso</strong>.</p>
      <p style="color: #475569;">Clique no botão abaixo para criar uma nova senha com segurança:</p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${linkRedefinicao}" class="btn-primary" style="display:inline-block;background-color:#f97316;color:#ffffff;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;padding:14px 32px;border-radius:14px;text-decoration:none;">Redefinir Minha Senha</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center;">Link direto:<br><a href="${linkRedefinicao}" style="color: #f97316; word-break: break-all;">${linkRedefinicao}</a></p>
      <p style="font-size: 12px; color: #ef4444; font-weight: 700; margin-top: 24px;">⚠️ Este link expira em 1 hora. Se você não solicitou a troca de senha, sua conta continua segura e você pode ignorar esta mensagem.</p>
    `;

    return this.renderBaseTemplate({
      tituloHeader: 'Recuperação de Senha',
      subtituloHeader: 'Solicitação de redefinição de acesso',
      conteudoHtml,
    });
  }

  /**
   * Gera o HTML de um e-mail sem enviar — usado pela rota de preview em
   * desenvolvimento, já que testar visual por entrega real depende de
   * provedor/spam e não é confiável pra isso.
   */
  gerarPreview(tipo: 'verificacao' | 'recuperacao-senha'): string {
    if (tipo === 'recuperacao-senha') {
      return this.montarHtmlRecuperacaoSenha({
        email: 'atleta@exemplo.com',
        nome: 'Alan',
        token: 'preview-token',
      });
    }
    return this.montarHtmlVerificacao({
      email: 'atleta@exemplo.com',
      nome: 'Alan',
      token: 'preview-token',
    });
  }

  /**
   * Mensagem enviada pelo formulário "Fale conosco" do site do atleta
   */
  async enviarMensagemContato(params: EnviarMensagemContatoParams) {
    const destinatario = this.configService.get<string>('CONTATO_EMAIL', 'suporte@seupercurso.com.br');
    const nome = this.escapeHtml(params.nome);
    const email = this.escapeHtml(params.email);
    const assunto = this.escapeHtml(params.assunto?.trim() || 'Nova mensagem pelo site');
    const mensagem = this.escapeHtml(params.mensagem);

    const conteudoHtml = `
      <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Nova mensagem recebida pelo "Fale conosco"</p>
      <div class="card">
        <p style="margin: 0 0 8px;"><strong>Nome:</strong> ${nome}</p>
        <p style="margin: 0 0 8px;"><strong>E-mail:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Assunto:</strong> ${assunto}</p>
      </div>
      <p style="color: #475569; white-space: pre-wrap;">${mensagem}</p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Responda diretamente este e-mail para falar com ${nome}.</p>
    `;

    const html = this.renderBaseTemplate({
      tituloHeader: 'Fale Conosco',
      subtituloHeader: 'Mensagem recebida pelo site',
      conteudoHtml,
    });

    return this.enviarMail(destinatario, `[Fale Conosco] ${assunto}`, html, params.email);
  }

  private escapeHtml(valor: string): string {
    return valor
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 3. Confirmação de Inscrição Única ou em Lote (Com QR Codes Individuais por Atleta)
   */
  async enviarConfirmacaoInscricaoBatch(params: EnviarConfirmacaoBatchParams) {
    const appUrl = this.getAppUrl();

    const atletasHtml = params.atletas
      .map(
        (atleta, index) => `
        <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 20px; padding: 24px; margin-bottom: 28px; box-shadow: 0 4px 14px rgba(0,0,0,0.04);">
          
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px;">
            <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block;">PARTICIPANTE #${index + 1}</span>
            <h3 style="margin: 2px 0 0; font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${atleta.nomeAtleta}</h3>
            ${atleta.numeroPeito ? `<span style="background-color: #0f172a; color: #ffffff; font-family: monospace; font-weight: 900; font-size: 13px; padding: 3px 10px; border-radius: 8px; display: inline-block; margin-top: 6px;">PEITO #${atleta.numeroPeito}</span>` : ''}
          </div>

          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Percurso / Modalidade:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 800; text-align: right;">${atleta.modalidade}</td>
            </tr>
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Categoria:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 800; text-align: right;">${atleta.categoria}</td>
            </tr>
            ${atleta.tamanhoCamisa ? `
            <tr style="border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Tamanho de Camiseta:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 800; text-align: right;">${atleta.tamanhoCamisa}</td>
            </tr>` : ''}
            ${atleta.cpfAtleta ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">CPF do Atleta:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 800; text-align: right;">${atleta.cpfAtleta}</td>
            </tr>` : ''}
          </table>

          <!-- QR Code Individual do Atleta para Retirada de Kit / Chip -->
          <div style="background-color: #fffaf0; border: 2px dashed #f97316; border-radius: 18px; padding: 20px; text-align: center; margin-top: 16px;">
            <p style="margin: 0 0 8px; font-size: 11px; font-weight: 900; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              VOUCHER DE RETIRADA DE KIT & CHIP
            </p>
            <div style="background-color: #0f172a; color: #ffffff; padding: 6px 16px; border-radius: 10px; display: inline-block; margin-bottom: 14px;">
              <span style="font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">ATLETA: ${atleta.nomeAtleta}</span>
            </div>

            <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(atleta.inscricaoId)}" alt="QR Code ${atleta.nomeAtleta}" style="width: 180px; height: 180px; margin: 0 auto; display: block; border-radius: 12px; border: 4px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" />

            <p style="margin: 14px 0 0; font-size: 12px; font-weight: 700; color: #475569;">
              Apresente este QR Code no local do evento para retirar o kit e chip de cronometragem de <strong style="color: #0f172a; text-transform: uppercase;">${atleta.nomeAtleta}</strong>.
            </p>
          </div>
        </div>
      `,
      )
      .join('');

    const conteudoHtml = `
      <div style="display: inline-flex; align-items: center; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 800; padding: 6px 16px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Inscrição Confirmada
      </div>
      <p style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 0;">Parabéns, ${params.nomeComprador}!</p>
      <p style="color: #475569;">Sua inscrição no evento <strong>${params.nomeEvento}</strong> foi confirmada e processada com sucesso!</p>
      
      <div class="card">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; display: flex; align-items: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          DADOS DO EVENTO
        </div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Evento:</strong> ${params.nomeEvento}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Data:</strong> ${params.dataEvento}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 6px;"><strong>Local:</strong> ${params.localEvento} — ${params.cidadeEstado}</div>
        <div style="font-size: 13px; color: #475569;"><strong>Valor Total Pago:</strong> R$ ${params.valorTotal}</div>
      </div>

      <h3 style="font-size: 16px; font-weight: 900; color: #0f172a; margin: 28px 0 16px; display: flex; align-items: center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 21v-2a4 4 0 0 1 3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><circle cx="19" cy="11" r="2"/></svg>
        PARTICIPANTES DA COMPRA (${params.atletas.length})
      </h3>

      ${atletasHtml}

      <div style="text-align: center; margin-top: 32px;">
        <a href="${appUrl}/minhas-inscricoes" class="btn-primary" style="display:inline-block;background-color:#f97316;color:#ffffff;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;padding:14px 32px;border-radius:14px;text-decoration:none;">Ver Inscrições no Perfil</a>
      </div>
    `;

    const html = this.renderBaseTemplate({
      tituloHeader: params.nomeEvento,
      subtituloHeader: 'Voucher Oficial de Inscrição e Retirada de Kit',
      conteudoHtml,
    });

    return this.enviarMail(
      params.emailComprador,
      `Confirmação de Inscrição — ${params.nomeEvento}`,
      html,
    );
  }

  /**
   * Confirmação de Inscrição Única (Retrocompatível)
   */
  async enviarConfirmacaoInscricao(params: {
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
  }) {
    return this.enviarConfirmacaoInscricaoBatch({
      emailComprador: params.emailAtleta,
      nomeComprador: params.nomeAtleta,
      nomeEvento: params.nomeEvento,
      dataEvento: params.dataEvento,
      localEvento: params.localEvento,
      cidadeEstado: params.cidadeEstado,
      valorTotal: params.valorTotal,
      atletas: [
        {
          inscricaoId: params.inscricaoId,
          nomeAtleta: params.nomeAtleta,
          modalidade: params.modalidade,
          categoria: params.categoria,
          tamanhoCamisa: params.tamanhoCamisa,
          valor: params.valorTotal,
        },
      ],
    });
  }
}
