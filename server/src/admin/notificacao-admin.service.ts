import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface NotificacaoComissaoEvent {
  id: string;
  valorTaxa: number;
  valorTotal: number;
  criadoEm: string;
}

@Injectable()
export class NotificacaoAdminService {
  private readonly notificacoesSubject = new Subject<NotificacaoComissaoEvent>();
  private readonly historicoNotificacoes: NotificacaoComissaoEvent[] = [];

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
  }

  getStream() {
    return this.notificacoesSubject.asObservable();
  }

  getHistorico() {
    return this.historicoNotificacoes;
  }
}
