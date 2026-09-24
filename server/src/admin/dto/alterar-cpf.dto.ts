import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class AlterarCpfDto {
  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsCPF({ message: 'CPF inválido. Confira os números digitados.' })
  cpf: string;
}
