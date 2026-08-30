import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMahajanDto } from './dto/create-mahajan.dto';
import { Mahajan } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/types';

@Injectable()
export class MahajansService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<Mahajan>> {
    const isAll = query?.all === true;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.prisma.mahajan.count({
      where: { companyId },
    });

    const data = await this.prisma.mahajan.findMany({
      where: { companyId },
      include: {
        purchaseInvoices: {
          include: {
            buyerSubpart: true,
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

  async findOne(companyId: string, id: string): Promise<Mahajan> {
    const mahajan = await this.prisma.mahajan.findFirst({
      where: { id, companyId },
      include: {
        purchaseInvoices: {
          include: {
            buyerSubpart: true,
            payments: true,
          },
          orderBy: { invoiceDate: 'desc' },
        },
      },
    });

    if (!mahajan) {
      throw new NotFoundException(`Mahajan not found`);
    }

    return mahajan;
  }

  async create(companyId: string, dto: CreateMahajanDto): Promise<Mahajan> {
    const nameTrimmed = dto.name.trim();

    // Check duplicate name inside same company context
    const existing = await this.prisma.mahajan.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: nameTrimmed,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Mahajan with name "${dto.name}" already exists.`,
      );
    }

    return this.prisma.mahajan.create({
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
    dto: CreateMahajanDto,
  ): Promise<Mahajan> {
    const mahajan = await this.prisma.mahajan.findFirst({
      where: { id, companyId },
    });

    if (!mahajan) {
      throw new NotFoundException(`Mahajan not found`);
    }

    const nameTrimmed = dto.name.trim();

    // Check duplicate name if name is being changed
    if (nameTrimmed.toLowerCase() !== mahajan.name.toLowerCase()) {
      const existing = await this.prisma.mahajan.findUnique({
        where: {
          companyId_name: {
            companyId,
            name: nameTrimmed,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Another Mahajan with name "${dto.name}" already exists.`,
        );
      }
    }

    return this.prisma.mahajan.update({
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

  async remove(companyId: string, id: string): Promise<Mahajan> {
    const mahajan = await this.prisma.mahajan.findFirst({
      where: { id, companyId },
    });

    if (!mahajan) {
      throw new NotFoundException(`Mahajan not found`);
    }

    return this.prisma.mahajan.delete({
      where: { id },
    });
  }
}
