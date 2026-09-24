import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CriarUsuarioAdminDto } from './criar-usuario.dto';

async function errosDe(dados: Record<string, unknown>) {
  const dto = plainToInstance(CriarUsuarioAdminDto, dados);
  const erros = await validate(dto);
  return erros.map((e) => e.property);
}

describe('CriarUsuarioAdminDto', () => {
  const valido = {
    nomeCompleto: 'Atleta Teste',
    email: 'atleta@exemplo.com',
    cpf: '52998224725',
    dataNascimento: '1990-05-10',
    genero: 'FEMININO',
  };

  it('aceita cadastro completo', async () => {
    expect(await errosDe(valido)).toEqual([]);
  });

  it('exige data de nascimento (antes virava 01/01/2000)', async () => {
    const { dataNascimento, ...semData } = valido;
    expect(await errosDe(semData)).toContain('dataNascimento');
  });

  it('exige genero (antes virava OUTRO)', async () => {
    const { genero, ...semGenero } = valido;
    expect(await errosDe(semGenero)).toContain('genero');
  });

  it('recusa CPF com digitos verificadores errados', async () => {
    expect(await errosDe({ ...valido, cpf: '11111111111' })).toContain('cpf');
    expect(await errosDe({ ...valido, cpf: '52998224700' })).toContain('cpf');
  });
});
