import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DaybookService } from './daybook.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('daybook')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class DaybookController {
  constructor(private readonly daybookService: DaybookService) {}

  @Get()
  async getDaybook(
    @CurrentCompanyId() companyId: string,
    @Query('date') date?: string,
  ) {
    return this.daybookService.getDaybookData(companyId, date);
  }
}
