import { StatusInscricao } from '../generated/prisma/enums';

// Uma inscricao cancelada ou expirada devolve a isencao do servidor. Antes a
// marca de "utilizado" era permanente: um pedido misto que nunca foi pago
// queimava a gratuidade do servidor e a vaga do limite do evento para sempre.
export const STATUS_QUE_LIBERAM_SERVIDOR: StatusInscricao[] = [
  StatusInscricao.CANCELADA,
  StatusInscricao.EXPIRADA,
];

/** Filtro Prisma de ServidorPublico preso a uma inscricao ainda valida. */
export const FILTRO_SERVIDOR_EM_USO = {
  inscricao: { is: { status: { notIn: STATUS_QUE_LIBERAM_SERVIDOR } } },
};

/** Filtro Prisma de ServidorPublico que pode receber uma inscricao nova. */
export const FILTRO_SERVIDOR_LIVRE = {
  OR: [
    { inscricaoId: null },
    { inscricao: { is: { status: { in: STATUS_QUE_LIBERAM_SERVIDOR } } } },
  ],
};

export function servidorEstaEmUso(servidor: {
  inscricao?: { status: StatusInscricao } | null;
}): boolean {
  return (
    !!servidor.inscricao &&
    !STATUS_QUE_LIBERAM_SERVIDOR.includes(servidor.inscricao.status)
  );
}
