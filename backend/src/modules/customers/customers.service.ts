import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/types';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<Customer>> {
    const isAll = query?.all === true;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.prisma.customer.count({
      where: { companyId },
    });

    const data = await this.prisma.customer.findMany({
      where: { companyId },
      include: {
        invoices: {
          include: {
            payments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      ...(isAll ? {} : { skip, take: limit }),
    });

    return {
      data,
      pagination: {
        page: isAll ? 1 : page,
        limit: isAll ? total : limit,
        total,
        totalPages: isAll ? 1 : Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(companyId: string, id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
      include: {
        invoices: {
          include: {
            payments: true,
          },
          orderBy: { invoiceDate: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer not found`);
    }

    return customer;
  }

  async create(companyId: string, dto: CreateCustomerDto): Promise<Customer> {
    const nameTrimmed = dto.name.trim();

    // Check duplicate name inside same company context
    const existing = await this.prisma.customer.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: nameTrimmed,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Customer with name "${dto.name}" already exists.`,
      );
    }

    return this.prisma.customer.create({
      data: {
        companyId,
        name: nameTrimmed,
        gstin: dto.gstin?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        state: dto.state?.trim() || null,
        stateCode: dto.stateCode?.trim() || null,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: CreateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer not found`);
    }

    const nameTrimmed = dto.name.trim();

    // Check duplicate name if name is being changed
    if (nameTrimmed.toLowerCase() !== customer.name.toLowerCase()) {
      const existing = await this.prisma.customer.findUnique({
        where: {
          companyId_name: {
            companyId,
            name: nameTrimmed,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Another customer with name "${dto.name}" already exists.`,
        );
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        name: nameTrimmed,
        gstin: dto.gstin?.trim() || null,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        state: dto.state?.trim() || null,
        stateCode: dto.stateCode?.trim() || null,
      },
    });
  }

  async remove(companyId: string, id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer not found`);
    }

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
