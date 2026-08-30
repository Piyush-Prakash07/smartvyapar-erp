import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Company, Role } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({
      where: { id },
    });
  }

  async findUserCompanies(
    userId: string,
  ): Promise<(Company & { role: Role })[]> {
    const mappings = await this.prisma.companyUser.findMany({
      where: { userId },
      include: { company: true },
    });
    return mappings.map((m) => ({
      ...m.company,
      role: m.role,
    }));
  }

  async isUserInCompany(userId: string, companyId: string): Promise<boolean> {
    const mapping = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });
    return !!mapping;
  }

  async createCompanyForUser(
    userId: string,
    companyName: string,
    email?: string,
    phone?: string,
  ): Promise<Company & { role: Role }> {
    const company = await this.prisma.company.create({
      data: {
        name: companyName.trim(),
        email: email ? email.toLowerCase().trim() : null,
        phone: phone ? phone.trim() : null,
      },
    });

    await this.prisma.companyUser.create({
      data: {
        companyId: company.id,
        userId,
        role: Role.OWNER,
      },
    });

    return {
      ...company,
      role: Role.OWNER,
    };
  }
}
