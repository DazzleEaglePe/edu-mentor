import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RubricScoreItemDto {
  @IsString()
  criterionId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  comment?: string;
}

export class EvaluateSubmissionDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsString()
  @MinLength(10)
  @MaxLength(4_000)
  feedback!: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RubricScoreItemDto)
  rubricScores!: RubricScoreItemDto[];

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
