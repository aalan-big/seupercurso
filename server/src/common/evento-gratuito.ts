import { StatusInscricao } from '../generated/prisma/enums';

/**
 * Filtro Prisma de Inscricao que ocupa uma vaga do evento gratuito. Cancelada
 * ou expirada devolve a vaga, como no servidor publico.
 */
export function filtroVagaGratuitaEmUso(eventoId: string) {
  return {
    isGratuitoEvento: true,
    status: { notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] },
    categoria: { modalidade: { eventoId } },
  };
}

export function mensagemVagasGratuitasEsgotadas(vagas: number) {
  return `As ${vagas} vagas gratuitas deste evento já foram preenchidas.`;
}
