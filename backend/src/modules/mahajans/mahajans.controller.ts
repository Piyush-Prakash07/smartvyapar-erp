import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MahajansService } from './mahajans.service';
import { CreateMahajanDto } from './dto/create-mahajan.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { CurrentCompanyId } from '../auth/current-company-id.decorator';

@Controller('mahajans')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class MahajansController {
  constructor(private readonly mahajansService: MahajansService) {}

  @Get()
  async findAll(
    @CurrentCompanyId() companyId: string,
    @Query() query?: PaginationQueryDto,
  ) {
    return this.mahajansService.findAll(companyId, query);
  }

  @Get(':id')
  async findOne(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
  ) {
    return this.mahajansService.findOne(companyId, id);
  }

  @Post()
  async create(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateMahajanDto,
  ) {
    return this.mahajansService.create(companyId, dto);
  }

  @Put(':id')
  async update(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateMahajanDto,
  ) {
    return this.mahajansService.update(companyId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    return this.mahajansService.remove(companyId, id);
  }
}
