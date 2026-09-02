import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('CriptoCredencial');
const ALGORITMO = 'aes-256-gcm';
const PREFIXO = 'v1';

let chaveCache: Buffer | null = null;

/**
 * A API key da subconta dá acesso ao dinheiro do organizador, então não pode
 * ficar em texto puro no banco. Usa CREDENTIALS_SECRET quando existir; sem ele,
 * deriva do JWT_SECRET para não impedir o boot, avisando no log.
 */
function obterChave(): Buffer {
  if (chaveCache) return chaveCache;

  const segredo = process.env.CREDENTIALS_SECRET || process.env.JWT_SECRET;

  if (!segredo) {
    throw new Error(
      'CREDENTIALS_SECRET (ou JWT_SECRET) é obrigatório para cifrar credenciais do gateway.',
    );
  }

  if (!process.env.CREDENTIALS_SECRET) {
    logger.warn(
      'CREDENTIALS_SECRET não configurada: derivando a chave do JWT_SECRET. ' +
        'Defina um segredo dedicado — trocar o JWT_SECRET tornaria as chaves de subconta ilegíveis.',
    );
  }

  chaveCache = scryptSync(segredo, 'seupercurso.credencial', 32);
  return chaveCache;
}

export function cifrarCredencial(valor: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, obterChave(), iv);
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIXO,
    iv.toString('base64'),
    tag.toString('base64'),
    cifrado.toString('base64'),
  ].join(':');
}

/** Devolve null quando o valor não abre — chave trocada ou registro corrompido. */
export function decifrarCredencial(valor?: string | null): string | null {
  if (!valor) return null;

  const partes = valor.split(':');
  if (partes.length !== 4 || partes[0] !== PREFIXO) {
    logger.error('Credencial em formato inesperado; ignorando.');
    return null;
  }

  try {
    const [, ivB64, tagB64, dadosB64] = partes;
    const decipher = createDecipheriv(
      ALGORITMO,
      obterChave(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(dadosB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    logger.error(`Falha ao decifrar credencial do gateway: ${err}`);
    return null;
  }
}
