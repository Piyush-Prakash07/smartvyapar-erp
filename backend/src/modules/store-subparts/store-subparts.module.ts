import { Module } from '@nestjs/common';
import { StoreSubpartsService } from './store-subparts.service';
import { StoreSubpartsController } from './store-subparts.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StoreSubpartsController],
  providers: [StoreSubpartsService],
  exports: [StoreSubpartsService],
})
export class StoreSubpartsModule {}
