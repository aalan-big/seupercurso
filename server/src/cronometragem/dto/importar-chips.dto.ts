import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemChipDto {
  @IsInt({ message: 'O número de peito deve ser um número inteiro.' })
  numeroPeito: number;

  @IsString({ message: 'A tag EPC deve ser uma string.' })
  @IsNotEmpty({ message: 'A tag EPC não pode estar vazia.' })
  tagEpc: string;
}

export class ImportarChipsDto {
  @IsOptional()
  @IsString()
  csvContent?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemChipDto)
  chips?: ItemChipDto[];

  @IsOptional()
  @IsBoolean()
  substituir?: boolean;
}
