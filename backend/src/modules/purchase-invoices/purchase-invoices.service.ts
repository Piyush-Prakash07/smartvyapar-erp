import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { PurchaseInvoice } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/types';
import {
  safeParseItemsData,
  safeParseLogisticsData,
  safeParsePayments,
} from '../../common/utils/json-parser';

@Injectable()
export class PurchaseInvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResult<PurchaseInvoice>> {
    const isAll = query?.all === true;
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const total = await this.prisma.purchaseInvoice.count({
      where: { companyId },
    });

    const data = await this.prisma.purchaseInvoice.findMany({
      where: { companyId },
      include: { mahajan: true, buyerSubpart: true, payments: true },
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

  async create(
    companyId: string,
    dto: CreatePurchaseInvoiceDto,
  ): Promise<PurchaseInvoice> {
    let finalMahajanId = dto.mahajanId || null;
    let finalBuyerSubpartId = dto.buyerSubpartId || null;

    // Match or auto-create store subpart / buyer if given
    const logistics = safeParseLogisticsData(dto.logisticsData);
    if (!finalBuyerSubpartId) {
      if (logistics.buyerSubpartId) {
        finalBuyerSubpartId = logistics.buyerSubpartId;
      } else if (logistics.buyerName && logistics.buyerName.trim()) {
        const buyerNameTrimmed = logistics.buyerName.trim();
        let matchedSubpart = await this.prisma.storeSubpart.findFirst({
          where: {
            companyId,
            name: {
              equals: buyerNameTrimmed,
              mode: 'insensitive',
            },
          },
        });
        if (!matchedSubpart) {
          matchedSubpart = await this.prisma.storeSubpart.create({
            data: {
              companyId,
              name: buyerNameTrimmed,
              gstin: logistics.buyerGSTIN?.trim() || null,
              phone: logistics.buyerPhone?.trim() || null,
              address: logistics.buyerAddress?.trim() || null,
              state: logistics.buyerState?.trim() || null,
              stateCode: logistics.buyerStateCode?.trim() || null,
            },
          });
        }
        finalBuyerSubpartId = matchedSubpart.id;
      }
    }

    // Match manually typed supplier (seller) name as fallback, OR create new Mahajan profile
    if (!finalMahajanId) {
      const sellerName = logistics.sellerName;
      if (sellerName && sellerName.trim()) {
        const nameTrimmed = sellerName.trim();

        // 1. Try to find existing Mahajan
        let matchedMahajan = await this.prisma.mahajan.findFirst({
          where: {
            companyId,
            name: {
              equals: nameTrimmed,
              mode: 'insensitive',
            },
          },
        });

        // 2. If not found, automatically create Mahajan profile!
        if (!matchedMahajan) {
          matchedMahajan = await this.prisma.mahajan.create({
            data: {
              companyId,
              name: nameTrimmed,
              gstin: logistics.sellerGSTIN?.trim() || null,
              phone: logistics.sellerPhone?.trim() || null,
              email: logistics.sellerEmail?.trim() || null,
              address: logistics.sellerAddress?.trim() || null,
              state: logistics.sellerState?.trim() || null,
              stateCode: logistics.sellerStateCode?.trim() || null,
            },
          });
        }
        finalMahajanId = matchedMahajan.id;
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

    return this.prisma.purchaseInvoice.create({
      data: {
        companyId,
        mahajanId: finalMahajanId,
        buyerSubpartId: finalBuyerSubpartId,
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
      include: { mahajan: true, buyerSubpart: true, payments: true },
    });
  }

  async updatePayment(
    companyId: string,
    id: string,
    paidAmount: number,
    payments?: unknown[],
  ): Promise<PurchaseInvoice> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
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

    return this.prisma.purchaseInvoice.update({
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
      include: { mahajan: true, payments: true },
    });
  }

  async updateLogistics(
    companyId: string,
    id: string,
    logisticsData: string,
  ): Promise<PurchaseInvoice> {
    const existing = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new NotFoundException('Purchase invoice not found');
    }
    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { logisticsData },
      include: { mahajan: true, payments: true },
    });
  }

  async remove(companyId: string, id: string): Promise<PurchaseInvoice> {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found`);
    }

    return this.prisma.purchaseInvoice.delete({
      where: { id },
    });
  }
}
