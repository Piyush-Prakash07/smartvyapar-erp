import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CompaniesService } from '../companies/companies.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    private companiesService: CompaniesService,
  ) {}

  private setRefreshTokenCookie(res: express.Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: false, // Set to true in production if SSL is active
      sameSite: 'lax',
      path: '/api/v1/auth/refresh', // restricted to token refresh route only
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    delete (result as { refreshToken?: string }).refreshToken;
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);

    delete (result as { refreshToken?: string }).refreshToken;
    return result;
  }

  @Post('refresh')
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh session cookie detected');
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const user = req.user as { id: string } | undefined;
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    await this.authService.logout(user.id);
    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: express.Request) {
    const user = req.user as
      | { id: string; email: string; fullName: string; status: string }
      | undefined;
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    const companies = await this.companiesService.findUserCompanies(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
      },
      companies,
    };
  }
}
