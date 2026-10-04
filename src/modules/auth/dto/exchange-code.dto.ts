import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCodeDto {
  @IsString({ message: 'El código de autorización debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código de autorización no puede estar vacío' })
  code: string;
}
