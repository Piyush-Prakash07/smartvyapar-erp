import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @CurrentCompanyId() companyId: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.invoicesService.findAll(companyId, query);
  }

  @Post()
  async create(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(companyId, dto);
  }

  @Patch(':id/payment')
  async updatePayment(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('paidAmount') paidAmount: number,
    @Body('payments') payments?: { amount: number; date: string }[],
  ) {
    return this.invoicesService.updatePayment(
      companyId,
      id,
      paidAmount,
      payments,
    );
  }

  @Patch(':id/logistics')
  async updateLogistics(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('logisticsData') logisticsData: string,
  ) {
    return this.invoicesService.updateLogistics(companyId, id, logisticsData);
  }

  @Delete(':id')
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.invoicesService.remove(companyId, id);
  }
}
