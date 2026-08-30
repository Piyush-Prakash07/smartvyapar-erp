import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('daily')
  async getDailyPayments(
    @CurrentCompanyId() companyId: string,
    @Query('date') date?: string,
  ) {
    return this.paymentsService.getDailyPayments(companyId, date);
  }
}
