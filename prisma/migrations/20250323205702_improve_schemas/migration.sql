/*
  Warnings:

  - You are about to drop the column `latitude` on the `Bike` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Bike` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bike" DROP COLUMN "latitude",
DROP COLUMN "longitude",
ALTER COLUMN "status" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Bike_number_idx" ON "Bike"("number");

-- CreateIndex
CREATE INDEX "Station_number_idx" ON "Station"("number");
