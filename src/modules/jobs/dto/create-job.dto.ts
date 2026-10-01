import { IsString, IsUrl, Matches } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsUrl()
  @Matches(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/, {
    message:
      'Must be a valid GitHub repository URL: https://github.com/owner/repo',
  })
  repoUrl: string;
}
