import { IsString, IsUrl, Matches } from 'class-validator';

export class AnalyzeRepoDto {
  @IsString()
  @IsUrl()
  @Matches(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/, {
    message:
      'Ingresa una URL válida de GitHub: https://github.com/owner/repositorio',
  })
  repoUrl: string;
}
