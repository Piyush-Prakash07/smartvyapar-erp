import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('stock')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('daily')
  async getDailyStock(
    @CurrentCompanyId() companyId: string,
    @Query('date') date?: string,
    @Query('subpartId') subpartId?: string,
  ) {
    return this.stockService.getDailyStock(companyId, date, subpartId);
  }

  @Post('adjust')
  async adjustStock(
    @CurrentCompanyId() companyId: string,
    @Body()
    dto: {
      itemId: string;
      date: string;
      quantity: number;
      note?: string;
      subpartId?: string;
    },
  ) {
    return this.stockService.adjustStock(companyId, dto);
  }

  @Post('item')
  async createItemAndStock(
    @CurrentCompanyId() companyId: string,
    @Body()
    dto: {
      name: string;
      rate: number;
      cost: number;
      hsn: string;
      unit: string;
      description?: string;
      date: string;
      initialStock: number;
    },
  ) {
    return this.stockService.createItemAndStock(companyId, dto);
  }
}
