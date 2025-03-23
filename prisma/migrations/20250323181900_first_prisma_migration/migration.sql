-- CreateTable
CREATE TABLE "Travel" (
    "id" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "stationFromId" TEXT NOT NULL,
    "stationToId" TEXT NOT NULL,

    CONSTRAINT "Travel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Travel_stationFromId_stationToId_idx" ON "Travel"("stationFromId", "stationToId");

-- CreateIndex
CREATE INDEX "Travel_stationToId_stationFromId_idx" ON "Travel"("stationToId", "stationFromId");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_stationFrom_fkey" FOREIGN KEY ("stationFromId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_stationTo_fkey" FOREIGN KEY ("stationToId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
