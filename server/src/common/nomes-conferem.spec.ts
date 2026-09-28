import { nomesConferem } from './nomes-conferem';

describe('nomesConferem', () => {
  it('ignora acento, maiuscula e particulas', () => {
    expect(nomesConferem('Jose Uchoa de Lima', 'JOSÉ UCHÔA LIMA')).toBe(true);
  });

  it('aceita sobrenome a mais ou a menos no cadastro', () => {
    expect(nomesConferem('Jose Uchoa de Lima', 'José Uchôa de Lima Filho')).toBe(true);
    expect(nomesConferem('Maria Neuda Fernandes da Silva', 'Maria Silva')).toBe(true);
  });

  it('recusa primeiro nome diferente', () => {
    expect(nomesConferem('Jose Uchoa de Lima', 'Joao Uchoa de Lima')).toBe(false);
  });

  it('recusa quando nenhum sobrenome bate', () => {
    expect(nomesConferem('Jose Uchoa de Lima', 'Jose Pereira Santos')).toBe(false);
  });

  it('recusa nome vazio', () => {
    expect(nomesConferem('', 'Jose Lima')).toBe(false);
    expect(nomesConferem('Jose Lima', '   ')).toBe(false);
  });
});
