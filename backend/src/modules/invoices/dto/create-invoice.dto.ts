import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  invoiceNo: string;

  @IsString()
  @IsNotEmpty()
  invoiceDate: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  totalGst: number;

  @IsBoolean()
  isInterstate: boolean;

  @IsNumber()
  @IsOptional()
  paidAmount?: number;

  @IsString()
  @IsNotEmpty()
  logisticsData: string;

  @IsString()
  @IsNotEmpty()
  itemsData: string;
}
