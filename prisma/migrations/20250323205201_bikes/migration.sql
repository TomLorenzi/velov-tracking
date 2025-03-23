-- DropForeignKey
ALTER TABLE "Travel" DROP CONSTRAINT "Travel_stationTo_fkey";

-- AlterTable
ALTER TABLE "Travel" ALTER COLUMN "stationToId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Bike" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,

    CONSTRAINT "Bike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bike_stationId_idx" ON "Bike"("stationId");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_stationTo_fkey" FOREIGN KEY ("stationToId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_station_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
