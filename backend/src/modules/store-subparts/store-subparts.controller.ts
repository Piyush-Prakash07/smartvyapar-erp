import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StoreSubpartsService } from './store-subparts.service';
import { CreateStoreSubpartDto } from './dto/create-store-subpart.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('store-subparts')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class StoreSubpartsController {
  constructor(private readonly storeSubpartsService: StoreSubpartsService) {}

  @Get()
  async findAll(@CurrentCompanyId() companyId: string) {
    return this.storeSubpartsService.findAll(companyId);
  }

  @Get(':id')
  async findOne(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
  ) {
    return this.storeSubpartsService.findOne(companyId, id);
  }

  @Post()
  async create(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateStoreSubpartDto,
  ) {
    return this.storeSubpartsService.create(companyId, dto);
  }

  @Put(':id')
  async update(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateStoreSubpartDto,
  ) {
    return this.storeSubpartsService.update(companyId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.storeSubpartsService.remove(companyId, id);
  }
}
