import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/types';
import {
  safeParseItemsData,
  safeParseLogisticsData,
  safeParsePayments,
} from '../../common/utils/json-parser';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<Invoice>> {
    const isAll = query?.all === true;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.prisma.invoice.count({
      where: { companyId },
    });

    const data = await this.prisma.invoice.findMany({
      where: { companyId },
      include: { customer: true, payments: true },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      ...(isAll ? {} : { skip, take: limit }),
    });

    return {
      data,
      pagination: {
        page: isAll ? 1 : page,
        limit: isAll ? total : limit,
        total,
        totalPages: isAll ? 1 : Math.ceil(total / limit) || 1,
      },
    };
  }

  async create(companyId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    let finalCustomerId = dto.customerId || null;

    // Match manually typed customer name as fallback, OR create new customer profile
    if (!finalCustomerId) {
      const logistics = safeParseLogisticsData(dto.logisticsData);
      const buyerName = logistics.buyerName;
      if (buyerName && buyerName.trim()) {
        const nameTrimmed = buyerName.trim();

        // 1. Try to find existing customer
        let matchedCustomer = await this.prisma.customer.findFirst({
          where: {
            companyId,
            name: {
              equals: nameTrimmed,
              mode: 'insensitive',
            },
          },
        });

        // 2. If not found, automatically create customer profile!
        if (!matchedCustomer) {
          matchedCustomer = await this.prisma.customer.create({
            data: {
              companyId,
              name: nameTrimmed,
              gstin: logistics.buyerGSTIN?.trim() || null,
              phone: logistics.buyerPhone?.trim() || null,
              email: logistics.buyerEmail?.trim() || null,
              address: logistics.buyerAddress?.trim() || null,
              state: logistics.buyerState?.trim() || null,
              stateCode: logistics.buyerStateCode?.trim() || null,
            },
          });
        }
        finalCustomerId = matchedCustomer.id;
      }
    }

    // Parse and auto-create catalog items if they do not exist
    const itemsList = safeParseItemsData(dto.itemsData);
    for (const item of itemsList) {
      if (item && item.name && item.name.trim()) {
        const nameTrimmed = item.name.trim();
        const existingItem = await this.prisma.item.findFirst({
          where: {
            companyId,
            name: {
              equals: nameTrimmed,
              mode: 'insensitive',
            },
          },
        });

        if (!existingItem) {
          await this.prisma.item.create({
            data: {
              companyId,
              name: nameTrimmed,
              rate: Number(item.rate) || 0,
              hsn: item.hsn?.trim() || '21069099',
              unit: item.unit?.trim() || 'PCS',
              description: 'Auto-created from invoice',
            },
          });
        }
      }
    }

    const paidAmt = dto.paidAmount ?? 0;

    return this.prisma.invoice.create({
      data: {
        companyId,
        customerId: finalCustomerId,
        invoiceNo: dto.invoiceNo.trim(),
        invoiceDate: new Date(dto.invoiceDate),
        totalAmount: dto.totalAmount,
        paidAmount: paidAmt,
        subtotal: dto.subtotal,
        totalGst: dto.totalGst,
        isInterstate: dto.isInterstate,
        logisticsData: dto.logisticsData,
        itemsData: dto.itemsData,
        payments:
          paidAmt > 0
            ? {
                create: {
                  amount: paidAmt,
                  date: new Date(dto.invoiceDate),
                  paymentMethod: 'CASH',
                  paymentStatus: 'COMPLETED',
                },
              }
            : undefined,
      },
      include: { customer: true, payments: true },
    });
  }

  async updatePayment(
    companyId: string,
    id: string,
    paidAmount: number,
    payments?: unknown[],
  ): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found`);
    }

    let calculatedPaidAmount = paidAmount;
    const parsedPayments =
      payments !== undefined ? safeParsePayments(payments) : undefined;

    if (parsedPayments !== undefined) {
      // Calculate confirmed total paid from COMPLETED or CLEARED payments
      calculatedPaidAmount = parsedPayments
        .filter(
          (p) =>
            !p.paymentStatus ||
            p.paymentStatus === 'COMPLETED' ||
            p.paymentStatus === 'CLEARED',
        )
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: calculatedPaidAmount,
        ...(parsedPayments !== undefined
          ? {
              payments: {
                deleteMany: {},
                create: parsedPayments.map((p) => ({
                  amount: p.amount,
                  date: new Date(p.date),
                  paymentMethod: p.paymentMethod || 'CASH',
                  paymentStatus: p.paymentStatus || 'COMPLETED',
                  referenceNumber: p.referenceNumber || null,
                  provider: p.provider || null,
                  bankName: p.bankName || null,
                  transferType: p.transferType || null,
                  maskedAccountReference: p.maskedAccountReference || null,
                  paymentSubType: p.paymentSubType || null,
                  senderMobileMasked: p.senderMobileMasked || null,
                  receiverMobileMasked: p.receiverMobileMasked || null,
                  cardLastFour: p.cardLastFour || null,
                  cardType: p.cardType || null,
                  chequeNumber: p.chequeNumber || null,
                  chequeDate: p.chequeDate ? new Date(p.chequeDate) : null,
                  receiptNumber: p.receiptNumber || null,
                  receivedBy: p.receivedBy || null,
                  notes: p.notes || null,
                })),
              },
            }
          : {}),
      },
      include: { customer: true, payments: true },
    });
  }

  async updateLogistics(
    companyId: string,
    id: string,
    logisticsData: string,
  ): Promise<Invoice> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { logisticsData },
      include: { customer: true, payments: true },
    });
  }

  async remove(companyId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found`);
    }

    return this.prisma.invoice.delete({
      where: { id },
    });
  }
}
