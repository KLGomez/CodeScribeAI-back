import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExportNotionDto {
  @ApiProperty({
    description: 'Contenido técnico en formato Markdown a exportar a Notion',
    example: '# Arquitectura del Sistema\n\nEste documento describe la arquitectura...',
  })
  @IsString({ message: 'El campo markdown debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo markdown no puede estar vacío' })
  markdown: string;

  @ApiProperty({
    description: 'Título de la nueva página que se creará en Notion',
    example: 'CodeScribe - Documentación de Arquitectura',
  })
  @IsString({ message: 'El campo title debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo title no puede estar vacío' })
  title: string;

  @ApiProperty({
    description: 'ID o UUID de la página padre en Notion donde se anidará el documento',
    example: 'a1b2c3d4e5f678901234567890abcdef',
  })
  @IsString({ message: 'El campo targetPageId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo targetPageId no puede estar vacío' })
  targetPageId: string;

  @ApiProperty({
    description: 'Token de acceso seguro de la integración u OAuth de Notion',
    example: 'secret_abc123xyz456...',
  })
  @IsString({ message: 'El campo notionAccessToken debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo notionAccessToken no puede estar vacío' })
  notionAccessToken: string;
}
