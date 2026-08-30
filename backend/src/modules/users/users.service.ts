import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    const cleanedPhone = phone.replace(/\s+/g, '');
    return this.prisma.user.findUnique({
      where: { phone: cleanedPhone },
    });
  }

  async findByIdentifier(
    identifier: string,
    type: 'PHONE' | 'EMAIL',
  ): Promise<User | null> {
    if (type === 'PHONE') {
      return this.findByPhone(identifier);
    }
    return this.findByEmail(identifier);
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    const formattedData = {
      ...data,
      email: data.email ? data.email.toLowerCase() : undefined,
      phone: data.phone ? data.phone.replace(/\s+/g, '') : undefined,
    };
    return this.prisma.user.create({ data: formattedData });
  }

  async updateRefreshToken(
    userId: string,
    refreshTokenHash: string | null,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
