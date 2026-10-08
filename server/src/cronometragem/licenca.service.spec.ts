import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, KeyObject, verify } from 'crypto';
import { LicencaService } from './licenca.service';

describe('LicencaService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const derBase64 = (
    privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer
  ).toString('base64');

  const dados = {
    contaId: 'u-1',
    email: ' Ana@Cronometra.com ',
    papel: 'admin' as const,
    plano: 'Cronometragem anual',
    assinaturaAte: new Date('2027-09-30T23:59:59.999-03:00'),
    maquinaId: 'a'.repeat(32),
  };

  const servico = (valor?: string) =>
    new LicencaService({
      get: jest.fn().mockReturnValue(valor),
    } as unknown as ConfigService);

  function abrir(licenca: string, chavePublica: KeyObject = publicKey) {
    const [carga, assinatura] = licenca.split('.');
    const confere = verify(
      null,
      Buffer.from(carga),
      chavePublica,
      Buffer.from(assinatura, 'base64url'),
    );
    return {
      confere,
      dados: JSON.parse(Buffer.from(carga, 'base64url').toString()) as Record<
        string,
        unknown
      >,
    };
  }

  it('assina o comprovante que o Mark confere com a chave pública', () => {
    const agora = new Date('2026-10-08T12:00:00Z');
    const { confere, dados: carga } = abrir(servico(pem).emitir(dados, agora));

    expect(confere).toBe(true);
    expect(carga).toEqual({
      v: 1,
      conta_id: 'u-1',
      email: 'ana@cronometra.com',
      papel: 'admin',
      plano: 'Cronometragem anual',
      assinatura_ate: '2027-10-01T02:59:59.999Z',
      maquina_id: 'a'.repeat(32),
      emitida_em: '2026-10-08T12:00:00.000Z',
      offline_ate: '2026-11-07T12:00:00.000Z', // 30 dias
    });
  });

  it('o acesso offline nunca passa do fim da assinatura', () => {
    const agora = new Date('2027-09-25T12:00:00Z');
    const { dados: carga } = abrir(servico(pem).emitir(dados, agora));

    expect(carga.offline_ate).toBe(dados.assinaturaAte.toISOString());
  });

  it('aceita a chave em base64 numa linha só e o PEM com \\n escapados', () => {
    const umaLinha = abrir(servico(derBase64).emitir(dados));
    const pemEscapado = abrir(servico(pem.replace(/\n/g, '\\n')).emitir(dados));

    expect(umaLinha.confere && pemEscapado.confere).toBe(true);
  });

  it('licença adulterada não confere', () => {
    const [carga, assinatura] = servico(pem).emitir(dados).split('.');
    const alterada = JSON.parse(
      Buffer.from(carga, 'base64url').toString(),
    ) as Record<string, unknown>;
    alterada.offline_ate = '2099-12-31T00:00:00.000Z';
    const novaCarga = Buffer.from(JSON.stringify(alterada)).toString(
      'base64url',
    );

    expect(abrir(`${novaCarga}.${assinatura}`).confere).toBe(false);
  });

  it('sem chave configurada (ou inválida) só o login do Mark fica indisponível', () => {
    for (const valor of [undefined, '', 'nao-e-uma-chave']) {
      const s = servico(valor);
      expect(() => s.garantirDisponivel()).toThrow(ServiceUnavailableException);
      expect(() => s.emitir(dados)).toThrow(ServiceUnavailableException);
    }
  });

  it('recusa chave que não é Ed25519', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const s = servico(rsa.export({ format: 'pem', type: 'pkcs8' }).toString());

    expect(() => s.garantirDisponivel()).toThrow(ServiceUnavailableException);
  });
});
