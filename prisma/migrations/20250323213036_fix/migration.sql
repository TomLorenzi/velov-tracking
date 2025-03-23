/*
  Warnings:

  - Added the required column `bikeNumber` to the `Travel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Travel" ADD COLUMN     "bikeNumber" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_bike_fkey" FOREIGN KEY ("bikeNumber") REFERENCES "Bike"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
