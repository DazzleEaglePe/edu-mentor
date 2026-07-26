import { IsInt, Min } from 'class-validator';

export class VersionedRequestDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
