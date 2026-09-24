import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ValidarServidorDto {
  @IsUUID('all', { message: 'Evento inválido.' })
  eventoId: string;

  @IsString()
  @IsNotEmpty({ message: 'O CPF do servidor é obrigatório.' })
  cpf: string;

  @IsString()
  @IsNotEmpty({ message: 'A matrícula do servidor é obrigatória.' })
  matricula: string;
}
