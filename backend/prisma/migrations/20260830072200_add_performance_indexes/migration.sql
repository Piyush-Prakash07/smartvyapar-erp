-- CreateIndex
CREATE INDEX "Invoice_companyId_invoiceDate_idx" ON "Invoice"("companyId", "invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_companyId_customerId_idx" ON "Invoice"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_companyId_invoiceDate_idx" ON "PurchaseInvoice"("companyId", "invoiceDate");

-- CreateIndex
CREATE INDEX "PurchaseInvoice_companyId_mahajanId_idx" ON "PurchaseInvoice"("companyId", "mahajanId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_purchaseInvoiceId_idx" ON "Payment"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "StockAdjustment_companyId_date_idx" ON "StockAdjustment"("companyId", "date");
