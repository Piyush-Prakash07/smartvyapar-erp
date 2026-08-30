import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreSubpartDto } from './dto/create-store-subpart.dto';
import { StoreSubpart } from '@prisma/client';

@Injectable()
export class StoreSubpartsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string): Promise<StoreSubpart[]> {
    return this.prisma.storeSubpart.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string): Promise<StoreSubpart> {
    const subpart = await this.prisma.storeSubpart.findFirst({
      where: { id, companyId },
    });
    if (!subpart) {
      throw new NotFoundException(`Store subpart/buyer not found`);
    }
    return subpart;
  }

  async create(
    companyId: string,
    dto: CreateStoreSubpartDto,
  ): Promise<StoreSubpart> {
    const nameLower = dto.name.trim();

    const existing = await this.prisma.storeSubpart.findUnique({
      where: {
        companyId_name: {
          companyId,
          name: nameLower,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Store subpart/buyer with name "${dto.name}" already exists.`,
      );
    }

    if (dto.isDefault) {
      await this.prisma.storeSubpart.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.storeSubpart.create({
      data: {
        companyId,
        name: nameLower,
        code: dto.code?.trim() || null,
        gstin: dto.gstin?.trim() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        state: dto.state?.trim() || null,
        stateCode: dto.stateCode?.trim() || null,
        isDefault: dto.isDefault || false,
      },
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: CreateStoreSubpartDto,
  ): Promise<StoreSubpart> {
    const subpart = await this.findOne(companyId, id);

    const nameLower = dto.name.trim();
    if (nameLower.toLowerCase() !== subpart.name.toLowerCase()) {
      const duplicate = await this.prisma.storeSubpart.findUnique({
        where: {
          companyId_name: {
            companyId,
            name: nameLower,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Store subpart/buyer with name "${dto.name}" already exists.`,
        );
      }
    }

    if (dto.isDefault) {
      await this.prisma.storeSubpart.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.storeSubpart.update({
      where: { id },
      data: {
        name: nameLower,
        code: dto.code !== undefined ? dto.code?.trim() || null : undefined,
        gstin: dto.gstin !== undefined ? dto.gstin?.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        address:
          dto.address !== undefined ? dto.address?.trim() || null : undefined,
        state: dto.state !== undefined ? dto.state?.trim() || null : undefined,
        stateCode:
          dto.stateCode !== undefined
            ? dto.stateCode?.trim() || null
            : undefined,
        isDefault: dto.isDefault !== undefined ? dto.isDefault : undefined,
      },
    });
  }

  async remove(
    companyId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.findOne(companyId, id);

    await this.prisma.storeSubpart.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Store subpart/buyer removed successfully',
    };
  }
}
