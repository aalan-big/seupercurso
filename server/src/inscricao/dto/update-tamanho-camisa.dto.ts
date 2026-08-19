import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTamanhoCamisaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tamanho da camisa.' })
  tamanhoCamisa: string;
}
