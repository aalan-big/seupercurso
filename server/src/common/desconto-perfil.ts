import { calcularIdade } from './calcular-idade';

export interface EventoDescontoPerfil {
  aplicaDescontoIdoso: boolean;
  percentualDescontoIdoso: unknown;
  aplicaDescontoPcd: boolean;
  percentualDescontoPcd: unknown;
  dataInicio: Date;
}

export interface DescontoPerfil {
  tipo: 'IDOSO' | 'PCD';
  percentual: number;
}

/**
 * Desconto de perfil do atleta: idoso (60+ na data da prova) ou PCD. Os dois
 * nao acumulam: vale o maior, e no empate o do idoso (a regra que ja existia).
 * Usada no preco da tela, na criacao da inscricao e no pagamento, para os tres
 * decidirem igual — e para saber qual documento exigir.
 */
export function resolverDescontoPerfil(
  evento: EventoDescontoPerfil,
  atleta: { dataNascimento?: Date | null; pcd?: boolean },
): DescontoPerfil | null {
  const percentualIdoso = evento.aplicaDescontoIdoso
    ? Number(evento.percentualDescontoIdoso ?? 0)
    : 0;
  const percentualPcd = evento.aplicaDescontoPcd
    ? Number(evento.percentualDescontoPcd ?? 0)
    : 0;

  const idoso =
    percentualIdoso > 0 &&
    !!atleta.dataNascimento &&
    calcularIdade(atleta.dataNascimento, evento.dataInicio) >= 60;
  const pcd = percentualPcd > 0 && !!atleta.pcd;

  if (idoso && (!pcd || percentualIdoso >= percentualPcd)) {
    return { tipo: 'IDOSO', percentual: percentualIdoso };
  }
  if (pcd) {
    return { tipo: 'PCD', percentual: percentualPcd };
  }
  return null;
}
