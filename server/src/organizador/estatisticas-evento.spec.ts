import {
  montarEstatisticasEvento,
  type InscricaoEstatistica,
} from './estatisticas-evento';

const DATA_PROVA = new Date('2026-11-15T12:00:00Z');

function inscricao(dados: Partial<InscricaoEstatistica> = {}): InscricaoEstatistica {
  return {
    genero: 'MASCULINO',
    dataNascimento: new Date('1990-05-10'),
    modalidadeId: 'm5',
    modalidadeNome: '5 km',
    pcd: false,
    descontoIdoso: false,
    descontoPcd: false,
    servidorPublico: false,
    funcionario: false,
    cupom: false,
    cidade: 'Iguatu',
    estado: 'CE',
    ...dados,
  };
}

describe('montarEstatisticasEvento', () => {
  it('conta genero no total e por modalidade', () => {
    const r = montarEstatisticasEvento(
      [
        inscricao(),
        inscricao({ genero: 'FEMININO' }),
        inscricao({ genero: 'FEMININO', modalidadeId: 'm10', modalidadeNome: '10 km' }),
      ],
      DATA_PROVA,
    );

    expect(r.total).toBe(3);
    expect(r.genero).toEqual({ MASCULINO: 1, FEMININO: 2, OUTRO: 0, NAO_INFORMADO: 0 });
    expect(r.modalidades[0]).toMatchObject({ nome: '5 km', total: 2, MASCULINO: 1, FEMININO: 1 });
    expect(r.modalidades[1]).toMatchObject({ nome: '10 km', total: 1, FEMININO: 1 });
  });

  it('usa a idade no dia da prova para as faixas e conta 60+ como idoso', () => {
    const r = montarEstatisticasEvento(
      [
        // Faz 60 depois da prova: ainda corre com 59.
        inscricao({ dataNascimento: new Date('1966-11-20') }),
        // Fez 60 antes da prova.
        inscricao({ dataNascimento: new Date('1966-11-10') }),
        inscricao({ dataNascimento: new Date('2010-01-01') }),
        inscricao({ dataNascimento: null }),
      ],
      DATA_PROVA,
    );

    const faixa = (nome: string) => r.idade.faixas.find((f) => f.faixa === nome)!.total;
    expect(faixa('50 a 59')).toBe(1);
    expect(faixa('60 a 69')).toBe(1);
    expect(faixa('Até 19')).toBe(1);
    expect(r.publicos.idosos).toBe(1);
    expect(r.idade.semIdade).toBe(1);
    expect(r.idade.maisNovo).toBe(16);
    expect(r.idade.maisVelho).toBe(60);
  });

  it('junta a mesma cidade escrita de jeitos diferentes e agrupa por estado', () => {
    const r = montarEstatisticasEvento(
      [
        inscricao({ cidade: 'Iguatu', estado: 'CE' }),
        inscricao({ cidade: ' iguatu ', estado: 'ce' }),
        inscricao({ cidade: 'Fortaleza', estado: 'CE' }),
        inscricao({ cidade: 'Recife', estado: 'PE' }),
        inscricao({ cidade: null, estado: null }),
      ],
      DATA_PROVA,
    );

    expect(r.origem.cidades[0]).toEqual({ cidade: 'Iguatu', estado: 'CE', total: 2 });
    expect(r.origem.totalCidades).toBe(3);
    expect(r.origem.estados).toEqual([
      { estado: 'CE', total: 3 },
      { estado: 'PE', total: 1 },
    ]);
    expect(r.origem.semEndereco).toBe(1);
  });

  it('mostra as 10 maiores cidades e soma o resto em outras', () => {
    const lista = Array.from({ length: 12 }, (_, i) =>
      inscricao({ cidade: `Cidade ${String(i).padStart(2, '0')}`, estado: 'CE' }),
    );
    const r = montarEstatisticasEvento(lista, DATA_PROVA);

    expect(r.origem.cidades).toHaveLength(10);
    expect(r.origem.outrasCidades).toBe(2);
  });

  it('conta os publicos com desconto', () => {
    const r = montarEstatisticasEvento(
      [
        inscricao({ descontoIdoso: true }),
        inscricao({ pcd: true, descontoPcd: true }),
        inscricao({ servidorPublico: true, cupom: true }),
        inscricao({ funcionario: true }),
      ],
      DATA_PROVA,
    );

    expect(r.publicos).toMatchObject({
      descontoIdoso: 1,
      pcd: 1,
      descontoPcd: 1,
      servidorPublico: 1,
      funcionario: 1,
      cupom: 1,
    });
  });

  it('evento sem inscricao nao quebra', () => {
    const r = montarEstatisticasEvento([], DATA_PROVA);
    expect(r.total).toBe(0);
    expect(r.idade.media).toBeNull();
    expect(r.origem.cidades).toEqual([]);
  });
});
