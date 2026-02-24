-- DropIndex
DROP INDEX "Station_number_idx";

-- CreateTable
CREATE TABLE "Statistic" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("key")
);
