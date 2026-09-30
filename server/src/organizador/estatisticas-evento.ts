import { calcularIdade } from '../common/calcular-idade';

export type GeneroEstatistica = 'MASCULINO' | 'FEMININO' | 'OUTRO' | 'NAO_INFORMADO';

/** Uma inscricao ja resolvida: genero e nascimento do atleta, nao do comprador. */
export interface InscricaoEstatistica {
  genero: GeneroEstatistica;
  dataNascimento: Date | null;
  modalidadeId: string;
  modalidadeNome: string;
  pcd: boolean;
  descontoIdoso: boolean;
  descontoPcd: boolean;
  servidorPublico: boolean;
  funcionario: boolean;
  cupom: boolean;
  /** Endereco da conta que comprou: o sistema nao guarda a cidade de cada atleta. */
  cidade: string | null;
  estado: string | null;
}

const FAIXAS_ETARIAS = [
  { faixa: 'Até 19', min: 0, max: 19 },
  { faixa: '20 a 29', min: 20, max: 29 },
  { faixa: '30 a 39', min: 30, max: 39 },
  { faixa: '40 a 49', min: 40, max: 49 },
  { faixa: '50 a 59', min: 50, max: 59 },
  { faixa: '60 a 69', min: 60, max: 69 },
  { faixa: '70 ou mais', min: 70, max: Infinity },
];

const LIMITE_CIDADES = 10;

function contadorGenero() {
  return { MASCULINO: 0, FEMININO: 0, OUTRO: 0, NAO_INFORMADO: 0 };
}

/** Normaliza para agrupar "iguatu" e "Iguatu " na mesma cidade. */
function chaveCidade(cidade: string, estado: string) {
  return `${cidade.trim().toLocaleLowerCase('pt-BR')}|${estado.trim().toUpperCase()}`;
}

export function montarEstatisticasEvento(
  inscricoes: InscricaoEstatistica[],
  dataProva: Date,
) {
  const genero = contadorGenero();
  const faixas = FAIXAS_ETARIAS.map((f) => ({ faixa: f.faixa, total: 0, ...contadorGenero() }));
  const modalidades = new Map<string, { id: string; nome: string; total: number } & ReturnType<typeof contadorGenero>>();
  const cidades = new Map<string, { cidade: string; estado: string; total: number }>();
  const estados = new Map<string, number>();
  const publicos = {
    idosos: 0,
    descontoIdoso: 0,
    pcd: 0,
    descontoPcd: 0,
    servidorPublico: 0,
    funcionario: 0,
    cupom: 0,
  };

  let somaIdades = 0;
  let comIdade = 0;
  let maisNovo: number | null = null;
  let maisVelho: number | null = null;
  let semIdade = 0;
  let semEndereco = 0;

  for (const inscricao of inscricoes) {
    genero[inscricao.genero]++;

    let modalidade = modalidades.get(inscricao.modalidadeId);
    if (!modalidade) {
      modalidade = { id: inscricao.modalidadeId, nome: inscricao.modalidadeNome, total: 0, ...contadorGenero() };
      modalidades.set(inscricao.modalidadeId, modalidade);
    }
    modalidade.total++;
    modalidade[inscricao.genero]++;

    if (inscricao.dataNascimento) {
      const idade = calcularIdade(inscricao.dataNascimento, dataProva);
      somaIdades += idade;
      comIdade++;
      maisNovo = maisNovo === null ? idade : Math.min(maisNovo, idade);
      maisVelho = maisVelho === null ? idade : Math.max(maisVelho, idade);
      if (idade >= 60) publicos.idosos++;

      const indice = FAIXAS_ETARIAS.findIndex((f) => idade >= f.min && idade <= f.max);
      const faixa = faixas[indice === -1 ? 0 : indice];
      faixa.total++;
      faixa[inscricao.genero]++;
    } else {
      semIdade++;
    }

    if (inscricao.pcd) publicos.pcd++;
    if (inscricao.descontoIdoso) publicos.descontoIdoso++;
    if (inscricao.descontoPcd) publicos.descontoPcd++;
    if (inscricao.servidorPublico) publicos.servidorPublico++;
    if (inscricao.funcionario) publicos.funcionario++;
    if (inscricao.cupom) publicos.cupom++;

    const cidade = inscricao.cidade?.trim();
    const estado = inscricao.estado?.trim().toUpperCase();
    if (cidade && estado) {
      const chave = chaveCidade(cidade, estado);
      const atual = cidades.get(chave);
      if (atual) atual.total++;
      else cidades.set(chave, { cidade, estado, total: 1 });
      estados.set(estado, (estados.get(estado) ?? 0) + 1);
    } else {
      semEndereco++;
    }
  }

  const cidadesOrdenadas = [...cidades.values()].sort(
    (a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, 'pt-BR'),
  );
  const outrasCidades = cidadesOrdenadas
    .slice(LIMITE_CIDADES)
    .reduce((soma, c) => soma + c.total, 0);

  return {
    total: inscricoes.length,
    genero,
    modalidades: [...modalidades.values()].sort((a, b) => b.total - a.total),
    idade: {
      faixas,
      media: comIdade > 0 ? Math.round(somaIdades / comIdade) : null,
      maisNovo,
      maisVelho,
      semIdade,
    },
    publicos,
    origem: {
      cidades: cidadesOrdenadas.slice(0, LIMITE_CIDADES),
      outrasCidades,
      totalCidades: cidadesOrdenadas.length,
      estados: [...estados.entries()]
        .map(([estado, total]) => ({ estado, total }))
        .sort((a, b) => b.total - a.total),
      semEndereco,
    },
  };
}
