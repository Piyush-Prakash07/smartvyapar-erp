import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { Item } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/types';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<Item>> {
    const isAll = query?.all === true;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.prisma.item.count({
      where: { companyId },
    });

    const data = await this.prisma.item.findMany({
      where: { companyId },
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

  async create(companyId: string, dto: CreateItemDto): Promise<Item> {
    const nameLower = dto.name.trim();

    // Check duplicate name inside same company context
    const existing = await this.prisma.item.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: nameLower,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Item with name "${dto.name}" already exists in this company.`,
      );
    }

    return this.prisma.item.create({
      data: {
        companyId,
        name: nameLower,
        rate: dto.rate,
        cost: dto.cost !== undefined ? dto.cost : 0,
        mrp: dto.mrp !== undefined ? dto.mrp : 0,
        hsn: dto.hsn !== undefined ? dto.hsn : '21069099',
        unit: dto.unit !== undefined ? dto.unit : 'PCS',
        description: dto.description || null,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: CreateItemDto,
  ): Promise<Item> {
    const item = await this.prisma.item.findFirst({
      where: { id, companyId },
    });

    if (!item) {
      throw new NotFoundException(`Item not found`);
    }

    const nameLower = dto.name.trim();

    // Check duplicate name if name is being changed
    if (nameLower.toLowerCase() !== item.name.toLowerCase()) {
      const existing = await this.prisma.item.findUnique({
        where: {
          companyId_name: {
            companyId,
            name: nameLower,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Another item with name "${dto.name}" already exists.`,
        );
      }
    }

    return this.prisma.item.update({
      where: { id },
      data: {
        name: nameLower,
        rate: dto.rate,
        cost: dto.cost !== undefined ? dto.cost : item.cost,
        mrp: dto.mrp !== undefined ? dto.mrp : item.mrp,
        hsn: dto.hsn !== undefined ? dto.hsn : item.hsn,
        unit: dto.unit !== undefined ? dto.unit : item.unit,
        description:
          dto.description !== undefined ? dto.description : item.description,
      },
    });
  }

  async remove(companyId: string, id: string): Promise<Item> {
    const item = await this.prisma.item.findFirst({
      where: { id, companyId },
    });

    if (!item) {
      throw new NotFoundException(`Item not found`);
    }

    return this.prisma.item.delete({
      where: { id },
    });
  }
}
