import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateStoreSubpartDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
