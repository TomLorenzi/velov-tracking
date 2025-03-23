/*
  Warnings:

  - The primary key for the `Bike` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Bike` table. All the data in the column will be lost.
  - You are about to drop the column `stationId` on the `Bike` table. All the data in the column will be lost.
  - The primary key for the `Station` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Station` table. All the data in the column will be lost.
  - You are about to drop the column `stationFromId` on the `Travel` table. All the data in the column will be lost.
  - You are about to drop the column `stationToId` on the `Travel` table. All the data in the column will be lost.
  - Added the required column `stationNumber` to the `Bike` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stationFromNumber` to the `Travel` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Bike" DROP CONSTRAINT "Bike_station_fkey";

-- DropForeignKey
ALTER TABLE "Travel" DROP CONSTRAINT "Travel_stationFrom_fkey";

-- DropForeignKey
ALTER TABLE "Travel" DROP CONSTRAINT "Travel_stationTo_fkey";

-- DropIndex
DROP INDEX "Bike_number_idx";

-- DropIndex
DROP INDEX "Bike_stationId_idx";

-- DropIndex
DROP INDEX "Travel_stationFromId_stationToId_idx";

-- DropIndex
DROP INDEX "Travel_stationToId_stationFromId_idx";

-- AlterTable
ALTER TABLE "Bike" DROP CONSTRAINT "Bike_pkey",
DROP COLUMN "id",
DROP COLUMN "stationId",
ADD COLUMN     "stationNumber" INTEGER NOT NULL,
ADD CONSTRAINT "Bike_pkey" PRIMARY KEY ("number");

-- AlterTable
ALTER TABLE "Station" DROP CONSTRAINT "Station_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Station_pkey" PRIMARY KEY ("number");

-- AlterTable
ALTER TABLE "Travel" DROP COLUMN "stationFromId",
DROP COLUMN "stationToId",
ADD COLUMN     "stationFromNumber" INTEGER NOT NULL,
ADD COLUMN     "stationToNumber" INTEGER;

-- CreateIndex
CREATE INDEX "Bike_stationNumber_idx" ON "Bike"("stationNumber");

-- CreateIndex
CREATE INDEX "Travel_stationFromNumber_stationToNumber_idx" ON "Travel"("stationFromNumber", "stationToNumber");

-- CreateIndex
CREATE INDEX "Travel_stationToNumber_stationFromNumber_idx" ON "Travel"("stationToNumber", "stationFromNumber");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_stationFrom_fkey" FOREIGN KEY ("stationFromNumber") REFERENCES "Station"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_stationTo_fkey" FOREIGN KEY ("stationToNumber") REFERENCES "Station"("number") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_station_fkey" FOREIGN KEY ("stationNumber") REFERENCES "Station"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
