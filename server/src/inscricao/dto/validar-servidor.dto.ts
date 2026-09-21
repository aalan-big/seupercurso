import { IsNotEmpty, IsString } from 'class-validator';

export class ValidarServidorDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID do evento é obrigatório.' })
  eventoId: string;

  @IsString()
  @IsNotEmpty({ message: 'O CPF do servidor é obrigatório.' })
  cpf: string;

  @IsString()
  @IsNotEmpty({ message: 'A matrícula do servidor é obrigatória.' })
  matricula: string;
}
