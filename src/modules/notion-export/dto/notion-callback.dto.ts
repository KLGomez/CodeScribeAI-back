import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotionCallbackDto {
  @ApiProperty({
    description: 'Código de autorización devuelto por Notion OAuth',
    example: 'c64a789b-1234-5678-90ab-cdef12345678',
  })
  @IsString({ message: 'El código de autorización debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código de autorización no puede estar vacío' })
  code: string;

  @ApiProperty({
    description: 'Token JWT de estado firmado para validar la sesión y prevenir CSRF',
  })
  @IsString({ message: 'El parámetro state debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El parámetro state no puede estar vacío' })
  state: string;
}
