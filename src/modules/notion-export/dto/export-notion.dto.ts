import { IsNotEmpty, IsString, IsOptional, MaxLength, Matches, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportNotionDto {
  @ApiProperty({
    description: 'ID de MongoDB de la documentación a exportar',
    example: '66faef1234567890abcdef01',
  })
  @IsMongoId({ message: 'documentationId debe ser un ObjectId de MongoDB válido' })
  @IsNotEmpty({ message: 'documentationId es obligatorio' })
  documentationId: string;

  @ApiProperty({
    description: 'UUID de la página padre en Notion (con o sin guiones)',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString({ message: 'targetPageId debe ser una cadena de texto' })
  @Matches(
    /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/,
    { message: 'targetPageId debe ser un UUID válido de Notion' },
  )
  @IsNotEmpty({ message: 'targetPageId es obligatorio' })
  targetPageId: string;

  @ApiPropertyOptional({
    description: 'Título personalizado para la página en Notion (máx. 200 caracteres)',
    example: 'Arquitectura y Documentación Técnica',
  })
  @IsOptional()
  @IsString({ message: 'title debe ser una cadena de texto' })
  @MaxLength(200, { message: 'El título no puede exceder 200 caracteres' })
  title?: string;
}
