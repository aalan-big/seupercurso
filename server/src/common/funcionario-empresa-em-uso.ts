import { StatusInscricao } from '../generated/prisma/enums';

// Mesma regra do servidor publico, mas em arquivo proprio: o desconto de
// funcionario e um recurso separado e nao deve mudar junto com a isencao.
// Inscricao cancelada ou expirada devolve a matricula.
export const STATUS_QUE_LIBERAM_FUNCIONARIO: StatusInscricao[] = [
  StatusInscricao.CANCELADA,
  StatusInscricao.EXPIRADA,
];

/** Filtro Prisma de FuncionarioEmpresa preso a uma inscricao ainda valida. */
export const FILTRO_FUNCIONARIO_EM_USO = {
  inscricao: { is: { status: { notIn: STATUS_QUE_LIBERAM_FUNCIONARIO } } },
};

/** Filtro Prisma de FuncionarioEmpresa que pode receber uma inscricao nova. */
export const FILTRO_FUNCIONARIO_LIVRE = {
  OR: [
    { inscricaoId: null },
    { inscricao: { is: { status: { in: STATUS_QUE_LIBERAM_FUNCIONARIO } } } },
  ],
};

export function funcionarioEstaEmUso(funcionario: {
  inscricao?: { status: StatusInscricao } | null;
}): boolean {
  return (
    !!funcionario.inscricao &&
    !STATUS_QUE_LIBERAM_FUNCIONARIO.includes(funcionario.inscricao.status)
  );
}
