const FUSO_BRASILIA = 'America/Sao_Paulo';

/** "01/10/2026 às 10:00" no horario de Brasilia, para mensagens ao atleta. */
export function formatarDataHoraBrasilia(data: Date): string {
  const dia = data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSO_BRASILIA,
  });
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO_BRASILIA,
  });
  return `${dia} às ${hora}`;
}
