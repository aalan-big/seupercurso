import { IsNotEmpty, IsUUID } from 'class-validator';

export class TrocarCategoriaDto {
  @IsUUID('4', { message: 'ID da nova categoria inválido.' })
  @IsNotEmpty({ message: 'Informe a nova categoria.' })
  novaCategoriaId: string;
}
