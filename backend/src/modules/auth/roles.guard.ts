import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from './company.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const rawCompanyId = request.headers['x-company-id'];
    const companyId = Array.isArray(rawCompanyId)
      ? rawCompanyId[0]
      : rawCompanyId;
    if (!companyId) {
      throw new ForbiddenException(
        'Company context (x-company-id header) is required to evaluate permissions',
      );
    }

    // Query CompanyUser mapping to locate user role details for this tenant
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

    return requiredRoles.includes(mapping.role);
  }
}
