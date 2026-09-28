import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ValidarFuncionarioDto {
  @IsUUID('all', { message: 'Evento inválido.' })
  eventoId: string;

  @IsString()
  @IsNotEmpty({ message: 'O número do contrato/crachá é obrigatório.' })
  matricula: string;

  // Atleta do carrinho: o nome e conferido com o da lista da empresa.
  @IsString()
  @IsNotEmpty({ message: 'O nome do atleta é obrigatório.' })
  nome: string;

  @IsString()
  @IsNotEmpty({ message: 'O CPF do atleta é obrigatório.' })
  cpf: string;
}
