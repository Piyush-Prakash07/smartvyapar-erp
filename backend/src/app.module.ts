import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AuthModule } from './modules/auth/auth.module';
import { ItemsModule } from './modules/items/items.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { MahajansModule } from './modules/mahajans/mahajans.module';
import { PurchaseInvoicesModule } from './modules/purchase-invoices/purchase-invoices.module';
import { DaybookModule } from './modules/daybook/daybook.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StockModule } from './modules/stock/stock.module';
import { StoreSubpartsModule } from './modules/store-subparts/store-subparts.module';
import { MailModule } from './modules/mail/mail.module';
import { SmsModule } from './modules/sms/sms.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    MailModule,
    SmsModule,
    UsersModule,
    CompaniesModule,
    AuthModule,
    ItemsModule,
    CustomersModule,
    InvoicesModule,
    MahajansModule,
    PurchaseInvoicesModule,
    DaybookModule,
    PaymentsModule,
    StockModule,
    StoreSubpartsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
