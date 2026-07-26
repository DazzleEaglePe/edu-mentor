import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsInt, Max, Min, ValidateNested } from 'class-validator';

export class TopCandidateItemDto {
  @IsInt()
  @Min(1)
  @Max(3)
  rank!: number;

  submissionId!: string;
}

export class SetTopCandidatesDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TopCandidateItemDto)
  candidates!: TopCandidateItemDto[];

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
