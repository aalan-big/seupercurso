import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento } from '../generated/prisma/enums';

import { EmailService } from '../email/email.service';

@Controller('pagamento/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(@Body() body: any) {
    this.logger.log(`Webhook Asaas recebido: ${body.event}`);

    const event = body.event;
    const payment = body.payment;

    if (!payment) return { received: true };

    const inscricaoId = payment.externalReference;
    const asaasPaymentId = payment.id;

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
    }

    return { received: true };
  }
}
