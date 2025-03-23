/*
  Warnings:

  - You are about to drop the column `location` on the `Station` table. All the data in the column will be lost.
  - Added the required column `address` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `banking` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bonus` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `connected` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Station` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalStands` to the `Station` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Station" DROP COLUMN "location",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "banking" BOOLEAN NOT NULL,
ADD COLUMN     "bonus" BOOLEAN NOT NULL,
ADD COLUMN     "connected" BOOLEAN NOT NULL,
ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "position" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "totalStands" INTEGER NOT NULL;
