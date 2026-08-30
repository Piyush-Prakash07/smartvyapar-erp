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
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('purchase-invoices')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class PurchaseInvoicesController {
  constructor(
    private readonly purchaseInvoicesService: PurchaseInvoicesService,
  ) {}

  @Get()
  async findAll(
    @CurrentCompanyId() companyId: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.purchaseInvoicesService.findAll(companyId, query);
  }

  @Post()
  async create(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchaseInvoicesService.create(companyId, dto);
  }

  @Patch(':id/payment')
  async updatePayment(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body('paidAmount') paidAmount: number,
    @Body('payments') payments?: { amount: number; date: string }[],
  ) {
    return this.purchaseInvoicesService.updatePayment(
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
    return this.purchaseInvoicesService.updateLogistics(
      companyId,
      id,
      logisticsData,
    );
  }

  @Delete(':id')
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.purchaseInvoicesService.remove(companyId, id);
  }
}
