import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import * as webpush from 'web-push';
import * as fs from 'fs';
import * as path from 'path';

export interface NotificacaoComissaoEvent {
  id: string;
  valorTaxa: number;
  valorTotal: number;
  criadoEm: string;
}

@Injectable()
export class NotificacaoAdminService implements OnModuleInit {
  private readonly logger = new Logger(NotificacaoAdminService.name);
  private readonly notificacoesSubject = new Subject<NotificacaoComissaoEvent>();
  private readonly historicoNotificacoes: NotificacaoComissaoEvent[] = [];
  private subscriptions: webpush.PushSubscription[] = [];
  private readonly subsFilePath = path.resolve(process.cwd(), 'push-subscriptions.json');

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const vapidPublic = this.configService.get<string>(
      'VAPID_PUBLIC_KEY',
      'BI0FGnKinEvhcu3hOUuz6O3GZVQZC4WqLtEX7JWXd7boHvbo4QUR2ZJc28VYny_1QPcqIQWmnCmiwOK2XU6xQss',
    );
    const vapidPrivate = this.configService.get<string>(
      'VAPID_PRIVATE_KEY',
      'DeaG5OeaYY1NFTW5vI1OtjO41BKgYY0nL61jY4veT3c',
    );
    const vapidSubject = this.configService.get<string>(
      'VAPID_SUBJECT',
      'mailto:suporte@seupercurso.esp.br',
    );

    try {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      this.carregarSubscriptions();
      this.logger.log('Web Push VAPID configurado com sucesso para o Admin.');
    } catch (e: any) {
      this.logger.error('Erro ao configurar VAPID:', e);
    }
  }

  getPublicKey(): string {
    return this.configService.get<string>(
      'VAPID_PUBLIC_KEY',
      'BI0FGnKinEvhcu3hOUuz6O3GZVQZC4WqLtEX7JWXd7boHvbo4QUR2ZJc28VYny_1QPcqIQWmnCmiwOK2XU6xQss',
    );
  }

  salvarSubscription(sub: webpush.PushSubscription) {
    if (!sub || !sub.endpoint) return;
    const existe = this.subscriptions.find((s) => s.endpoint === sub.endpoint);
    if (!existe) {
      this.subscriptions.push(sub);
      this.persistirSubscriptions();
      this.logger.log(`Nova inscrição Push registrada no Admin. Total ativas: ${this.subscriptions.length}`);
    }
  }

  removerSubscription(endpoint: string) {
    this.subscriptions = this.subscriptions.filter((s) => s.endpoint !== endpoint);
    this.persistirSubscriptions();
  }

  private carregarSubscriptions() {
    try {
      if (fs.existsSync(this.subsFilePath)) {
        const raw = fs.readFileSync(this.subsFilePath, 'utf8');
        this.subscriptions = JSON.parse(raw);
      }
    } catch (e) {
      this.subscriptions = [];
    }
  }

  private persistirSubscriptions() {
    try {
      fs.writeFileSync(this.subsFilePath, JSON.stringify(this.subscriptions, null, 2), 'utf8');
    } catch (e) {
      this.logger.error('Erro ao persistir subscriptions:', e);
    }
  }

  async enviarPushParaTodos(payload: { title: string; body: string; icon?: string; url?: string }) {
    if (this.subscriptions.length === 0) return;

    const payloadString = JSON.stringify({
      title: payload.title || 'Seu Percurso',
      body: payload.body,
      icon: payload.icon || '/icone_notificacao.jpg',
      badge: '/icone_notificacao.jpg',
      data: { url: payload.url || '/' },
    });

    const envios = this.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payloadString, {
          TTL: 86400,
          urgency: 'high',
        });
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          this.removerSubscription(sub.endpoint);
        } else {
          this.logger.warn(`Falha ao entregar push para dispositivo: ${err.message}`);
        }
      }
    });

    await Promise.all(envios);
  }

  notificarComissao(valorTaxa: number, valorTotal: number) {
    const evento: NotificacaoComissaoEvent = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      valorTaxa,
      valorTotal,
      criadoEm: new Date().toISOString(),
    };

    this.historicoNotificacoes.unshift(evento);
    if (this.historicoNotificacoes.length > 50) {
      this.historicoNotificacoes.pop();
    }

    this.notificacoesSubject.next(evento);

    const valorFormatado = valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    this.enviarPushParaTodos({
      title: 'Seu Percurso',
      body: `Nova comissão recebida: ${valorFormatado}`,
      icon: '/icone_notificacao.jpg',
      url: '/financeiro',
    }).catch(() => null);
  }

  getStream() {
    return this.notificacoesSubject.asObservable();
  }

  getHistorico() {
    return this.historicoNotificacoes;
  }
}
