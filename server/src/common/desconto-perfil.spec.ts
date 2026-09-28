import { resolverDescontoPerfil } from './desconto-perfil';

const base = {
  aplicaDescontoIdoso: false,
  percentualDescontoIdoso: null,
  aplicaDescontoPcd: false,
  percentualDescontoPcd: null,
  dataInicio: new Date('2026-12-01'),
};
const idoso = { dataNascimento: new Date('1950-01-01'), pcd: false };
const jovemPcd = { dataNascimento: new Date('1990-01-01'), pcd: true };
const idosoPcd = { dataNascimento: new Date('1950-01-01'), pcd: true };

describe('resolverDescontoPerfil', () => {
  it('sem desconto ligado no evento nao da nada', () => {
    expect(resolverDescontoPerfil(base, idosoPcd)).toBeNull();
  });

  it('PCD com o desconto PCD ligado', () => {
    const ev = { ...base, aplicaDescontoPcd: true, percentualDescontoPcd: '50' };
    expect(resolverDescontoPerfil(ev, jovemPcd)).toEqual({ tipo: 'PCD', percentual: 50 });
    expect(resolverDescontoPerfil(ev, { ...jovemPcd, pcd: false })).toBeNull();
  });

  it('idoso continua como antes', () => {
    const ev = { ...base, aplicaDescontoIdoso: true, percentualDescontoIdoso: 50 };
    expect(resolverDescontoPerfil(ev, idoso)).toEqual({ tipo: 'IDOSO', percentual: 50 });
  });

  it('idoso e PCD nao acumulam: vale o maior', () => {
    const ev = {
      ...base,
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: 30,
      aplicaDescontoPcd: true,
      percentualDescontoPcd: 50,
    };
    expect(resolverDescontoPerfil(ev, idosoPcd)).toEqual({ tipo: 'PCD', percentual: 50 });
  });

  it('no empate vale o do idoso', () => {
    const ev = {
      ...base,
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: 50,
      aplicaDescontoPcd: true,
      percentualDescontoPcd: 50,
    };
    expect(resolverDescontoPerfil(ev, idosoPcd)).toEqual({ tipo: 'IDOSO', percentual: 50 });
  });

  it('PCD ligado sem percentual nao da desconto', () => {
    const ev = { ...base, aplicaDescontoPcd: true, percentualDescontoPcd: null };
    expect(resolverDescontoPerfil(ev, jovemPcd)).toBeNull();
  });
});
