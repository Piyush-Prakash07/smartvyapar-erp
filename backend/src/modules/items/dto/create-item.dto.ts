import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  mrp?: number;

  @IsString()
  @IsOptional()
  hsn?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
