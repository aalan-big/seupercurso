export type SituacaoVendas = 'ABERTAS' | 'EM_BREVE' | 'ENCERRADAS';

interface JanelaLote {
  inicioVenda: Date | string;
  fimVenda: Date | string;
}

/**
 * Situacao das vendas pelas janelas dos lotes, para o site avisar "vendas
 * abrem em..." em vez de deixar montar o carrinho e recusar no fim.
 *
 * Na duvida responde ABERTAS (o comportamento de antes): so diz EM_BREVE ou
 * ENCERRADAS quando nenhum lote esta dentro da janela, porque ai nenhuma compra
 * passaria no servidor de qualquer jeito. Lote vigente mas esgotado continua
 * ABERTAS — quem avisa isso e a validacao da compra.
 */
export function calcularSituacaoVendas(
  lotes: JanelaLote[] | null | undefined,
  agora: Date = new Date(),
): { situacaoVendas: SituacaoVendas; vendasAbremEm: Date | null } {
  const janelas = (lotes || [])
    .map((l) => ({ inicio: new Date(l.inicioVenda), fim: new Date(l.fimVenda) }))
    .filter((j) => !isNaN(j.inicio.getTime()) && !isNaN(j.fim.getTime()));

  if (janelas.length === 0) return { situacaoVendas: 'ABERTAS', vendasAbremEm: null };

  if (janelas.some((j) => j.inicio <= agora && j.fim >= agora)) {
    return { situacaoVendas: 'ABERTAS', vendasAbremEm: null };
  }

  const futuras = janelas
    .filter((j) => j.inicio > agora)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  if (futuras.length > 0) {
    return { situacaoVendas: 'EM_BREVE', vendasAbremEm: futuras[0].inicio };
  }

  return { situacaoVendas: 'ENCERRADAS', vendasAbremEm: null };
}
