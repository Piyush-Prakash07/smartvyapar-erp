import { Module } from '@nestjs/common';
import { DaybookService } from './daybook.service';
import { DaybookController } from './daybook.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DaybookController],
  providers: [DaybookService],
})
export class DaybookModule {}
