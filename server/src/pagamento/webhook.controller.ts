import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento, StatusSolicitacaoArte } from '../generated/prisma/enums';

import { EmailService } from '../email/email.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';

@Controller('pagamento/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly notificacaoAdminService: NotificacaoAdminService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(
    @Headers('asaas-access-token') tokenRecebido: string,
    @Body() body: any,
  ) {
    const webhookSecret = this.configService.get<string>('ASAAS_WEBHOOK_SECRET');

    // Validação de segurança: verifica se o token enviado pelo Asaas bate com o .env
    if (webhookSecret && tokenRecebido !== webhookSecret) {
      this.logger.warn(`Tentativa de acesso não autorizado no Webhook com token: ${tokenRecebido}`);
      throw new UnauthorizedException('Token de segurança do webhook inválido.');
    }

    this.logger.log(`Webhook Asaas recebido: ${body.event}`);


    const event = body.event;
    const payment = body.payment;

    if (!payment) return { received: true };

    const referenciaExterna: string | undefined = payment.externalReference;
    const asaasPaymentId = payment.id;

    // Cobranças de "Solicitação de Arte" usam externalReference no formato "arte:<id>"
    // e não têm nenhuma relação com Inscricao — tratadas à parte, sem entrar na
    // lógica de confirmação de inscrição abaixo.
    if (referenciaExterna?.startsWith('arte:')) {
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        const solicitacaoArteId = referenciaExterna.slice('arte:'.length);
        this.logger.log(`Aprovando pagamento de Solicitação de Arte ${solicitacaoArteId} via Webhook Asaas (${asaasPaymentId})`);
        await this.prisma.solicitacaoArte.updateMany({
          where: { id: solicitacaoArteId, status: StatusSolicitacaoArte.PENDENTE_PAGAMENTO },
          data: {
            status: StatusSolicitacaoArte.PAGO,
            dataPagamento: new Date(),
            asaasPaymentId,
          },
        });
      }
      return { received: true };
    }

    const inscricaoId = referenciaExterna;

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      this.logger.log(`Aprovando inscrição ${inscricaoId} via Webhook Asaas (${asaasPaymentId})`);

      const inscricao = await this.prisma.$transaction(async (tx) => {
        // 1. Atualiza ou cria registro de Pagamento com status APROVADO
        const pagamentoExistente = await tx.pagamento.findFirst({
          where: {
            OR: [
              { asaasPaymentId: asaasPaymentId },
              { inscricaoId: inscricaoId },
            ],
          },
        });

        if (pagamentoExistente) {
          await tx.pagamento.update({
            where: { id: pagamentoExistente.id },
            data: {
              status: StatusPagamento.APROVADO,
              dataPagamento: new Date(),
              asaasPaymentId: asaasPaymentId,
            },
          });
        }

        // 2. Confirma a Inscrição do Atleta
        return tx.inscricao.update({
          where: { id: inscricaoId },
          data: { status: StatusInscricao.CONFIRMADA },
          include: {
            cliente: { include: { pf: true, pj: true, usuario: true } },
            categoria: {
              include: {
                modalidade: {
                  include: { evento: true },
                },
              },
            },
          },
        });
      });

      // 3. Dispara e-mail de confirmação de inscrição para o atleta
      if (inscricao) {
        const nomeAtleta =
          inscricao.cliente.pf?.nomeCompleto ||
          inscricao.cliente.pj?.razaoSocial ||
          'Atleta Esportivo';
        const emailAtleta = inscricao.cliente.usuario.email;
        const evento = inscricao.categoria.modalidade.evento;

        await this.emailService.enviarConfirmacaoInscricao({
          emailAtleta,
          nomeAtleta,
          nomeEvento: evento.nome,
          dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
          localEvento: evento.local,
          cidadeEstado: `${evento.cidade}/${evento.estado}`,
          modalidade: inscricao.categoria.modalidade.nome,
          categoria: inscricao.categoria.nome,
          tamanhoCamisa: inscricao.tamanhoCamisa,
          inscricaoId: inscricao.id,
          valorTotal: Number(payment.value || 0).toFixed(2),
        });
      }

      // 4. Dispara notificação em tempo real da comissão para o Painel Admin (Web Push / SSE)
      const valorTotalNum = Number(payment.value || 0);
      const comissaoPlataforma = valorTotalNum * 0.10;
      if (comissaoPlataforma > 0) {
        this.notificacaoAdminService.notificarComissao(comissaoPlataforma, valorTotalNum);
      }
    }

    return { received: true };
  }
}
