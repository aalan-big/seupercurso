import { IsEmail, IsNotEmpty } from 'class-validator';

export class TransferirInscricaoDto {
  @IsEmail({}, { message: 'Informe um e-mail válido para o novo atleta.' })
  @IsNotEmpty({ message: 'O e-mail do destinatário é obrigatório.' })
  emailDestino: string;
}
