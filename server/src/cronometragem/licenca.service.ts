import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrivateKey, KeyObject, sign } from 'crypto';

/** Sem internet, o Mark entra por no máximo 30 dias desde o último login online. */
const DIAS_OFFLINE = 30;

export interface DadosLicenca {
  contaId: string;
  email: string;
  papel: 'admin' | 'operador';
  plano: string;
  assinaturaAte: Date;
  maquinaId: string;
}

/**
 * Licença do SeuPercurso Mark: comprovante assinado (Ed25519) que o programa desktop
 * confere com a chave pública embutida nele. Sem ela o programa não entra, e quem
 * editar o banco do notebook ou apontar para um "site falso" não consegue forjá-la.
 *
 * A chave privada vem de LICENCA_CHAVE_PRIVADA (opcional na subida da API: sem ela
 * só o login do Mark responde 503; inscrições e pagamentos seguem normais).
 * Aceita PEM (PKCS#8, com "\n" escapados) ou o DER PKCS#8 em base64 numa linha só.
 */
@Injectable()
export class LicencaService {
  private readonly logger = new Logger(LicencaService.name);
  private chave: KeyObject | null | undefined;

  constructor(private readonly config: ConfigService) {}

  private chavePrivada(): KeyObject | null {
    if (this.chave !== undefined) return this.chave;
    const valor = this.config.get<string>('LICENCA_CHAVE_PRIVADA')?.trim();
    this.chave = null;
    if (!valor) {
      this.logger.warn(
        'LICENCA_CHAVE_PRIVADA não configurada: o login do Mark fica indisponível.',
      );
      return null;
    }
    try {
      const chave = valor.includes('BEGIN')
        ? createPrivateKey(valor.replace(/\\n/g, '\n'))
        : createPrivateKey({
            key: Buffer.from(valor, 'base64'),
            format: 'der',
            type: 'pkcs8',
          });
      if (chave.asymmetricKeyType !== 'ed25519') {
        throw new Error(
          `tipo de chave ${chave.asymmetricKeyType}, esperado ed25519`,
        );
      }
      this.chave = chave;
    } catch (erro) {
      this.logger.error(
        `LICENCA_CHAVE_PRIVADA inválida: ${(erro as Error).message}`,
      );
    }
    return this.chave;
  }

  /** Para checar antes de registrar o notebook: sem chave, nada é gravado. */
  garantirDisponivel(): void {
    if (!this.chavePrivada()) {
      throw new ServiceUnavailableException(
        'O login do SeuPercurso Mark está temporariamente indisponível (licença não configurada no servidor). Avise o suporte.',
      );
    }
  }

  emitir(dados: DadosLicenca, agora = new Date()): string {
    this.garantirDisponivel();
    const offlineAte = new Date(
      Math.min(
        agora.getTime() + DIAS_OFFLINE * 24 * 3600 * 1000,
        dados.assinaturaAte.getTime(),
      ),
    );
    const carga = Buffer.from(
      JSON.stringify({
        v: 1,
        conta_id: dados.contaId,
        email: dados.email.trim().toLowerCase(),
        papel: dados.papel,
        plano: dados.plano,
        assinatura_ate: dados.assinaturaAte.toISOString(),
        maquina_id: dados.maquinaId,
        emitida_em: agora.toISOString(),
        offline_ate: offlineAte.toISOString(),
      }),
    ).toString('base64url');
    // Assina o texto base64url (não o JSON): o programa confere exatamente esses bytes.
    const assinatura = sign(null, Buffer.from(carga), this.chavePrivada()!);
    return `${carga}.${assinatura.toString('base64url')}`;
  }
}
