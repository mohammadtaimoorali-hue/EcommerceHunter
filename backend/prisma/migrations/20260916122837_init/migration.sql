-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "config" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "source_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "gtin" TEXT,
    "category" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "raw" TEXT,
    "canonicalProductId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "source_products_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "source_products_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "canonical_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "gtin" TEXT,
    "category" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "sku" TEXT,
    "attributes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_variants_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceProductId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_prices_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceProductId" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL,
    "quantity" INTEGER,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_stock_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "demandScore" REAL NOT NULL,
    "trendScore" REAL NOT NULL,
    "competitionScore" REAL NOT NULL,
    "stockScore" REAL NOT NULL,
    "riskScore" REAL NOT NULL,
    "shippingScore" REAL NOT NULL,
    "overallScore" REAL NOT NULL,
    "breakdown" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_scores_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_trends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_trends_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'ebay',
    "sellerName" TEXT,
    "price" REAL NOT NULL,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitors_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "listing_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemSpecifics" TEXT NOT NULL,
    "categoryId" TEXT,
    "priceTarget" REAL NOT NULL,
    "priceMin" REAL NOT NULL,
    "priceMax" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "riskStatus" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "riskReasons" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "listing_drafts_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingDraftId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPrice" REAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "listings_listingDraftId_fkey" FOREIGN KEY ("listingDraftId") REFERENCES "listing_drafts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "listings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "listing_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_events_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "externalId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "salePrice" REAL NOT NULL,
    "buyerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "profit_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "orderId" TEXT,
    "sellPrice" REAL NOT NULL,
    "totalCost" REAL NOT NULL,
    "profit" REAL NOT NULL,
    "marginPercent" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profit_records_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "profit_records_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" TEXT,
    "scheduledFor" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "result" TEXT,
    "error" TEXT,
    CONSTRAINT "job_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "queue_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "queue_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalProductId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_flags_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "context" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "clientId" TEXT,
    "clientSecret" TEXT,
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_credentials_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sources_key_key" ON "sources"("key");

-- CreateIndex
CREATE INDEX "source_products_canonicalProductId_idx" ON "source_products"("canonicalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "source_products_sourceId_externalId_key" ON "source_products"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "canonical_products_gtin_idx" ON "canonical_products"("gtin");

-- CreateIndex
CREATE INDEX "canonical_products_brand_model_idx" ON "canonical_products"("brand", "model");

-- CreateIndex
CREATE INDEX "product_variants_canonicalProductId_idx" ON "product_variants"("canonicalProductId");

-- CreateIndex
CREATE INDEX "product_prices_sourceProductId_capturedAt_idx" ON "product_prices"("sourceProductId", "capturedAt");

-- CreateIndex
CREATE INDEX "product_stock_sourceProductId_capturedAt_idx" ON "product_stock"("sourceProductId", "capturedAt");

-- CreateIndex
CREATE INDEX "product_scores_canonicalProductId_computedAt_idx" ON "product_scores"("canonicalProductId", "computedAt");

-- CreateIndex
CREATE INDEX "product_trends_canonicalProductId_metric_idx" ON "product_trends"("canonicalProductId", "metric");

-- CreateIndex
CREATE INDEX "competitors_canonicalProductId_idx" ON "competitors"("canonicalProductId");

-- CreateIndex
CREATE INDEX "listing_drafts_canonicalProductId_idx" ON "listing_drafts"("canonicalProductId");

-- CreateIndex
CREATE INDEX "listings_storeId_idx" ON "listings"("storeId");

-- CreateIndex
CREATE INDEX "listing_events_listingId_createdAt_idx" ON "listing_events"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_listingId_idx" ON "orders"("listingId");

-- CreateIndex
CREATE INDEX "profit_records_listingId_idx" ON "profit_records"("listingId");

-- CreateIndex
CREATE INDEX "jobs_status_scheduledFor_idx" ON "jobs"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "job_runs_jobId_idx" ON "job_runs"("jobId");

-- CreateIndex
CREATE INDEX "queue_items_status_idx" ON "queue_items"("status");

-- CreateIndex
CREATE INDEX "risk_flags_canonicalProductId_idx" ON "risk_flags"("canonicalProductId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
