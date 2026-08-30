import { Module } from '@nestjs/common';
import { MahajansService } from './mahajans.service';
import { MahajansController } from './mahajans.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MahajansController],
  providers: [MahajansService],
  exports: [MahajansService],
})
export class MahajansModule {}
