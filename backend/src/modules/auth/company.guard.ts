import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedRequest {
  user?: { id: string; email?: string };
  headers: Record<string, string | string[] | undefined>;
  companyId?: string;
  companyRole?: string;
}

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User session is required');
    }

    const rawCompanyId = request.headers['x-company-id'];
    const companyId = Array.isArray(rawCompanyId)
      ? rawCompanyId[0]
      : rawCompanyId;
    if (!companyId) {
      throw new BadRequestException(
        'Company context (x-company-id header) is required',
      );
    }

    const mapping = await this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: user.id,
        },
      },
    });

    if (!mapping) {
      throw new ForbiddenException(
        'User is not associated with this company context',
      );
    }

    // Attach company context to request
    request.companyId = companyId;
    request.companyRole = mapping.role;

    return true;
  }
}
