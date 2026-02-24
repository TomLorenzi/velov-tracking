import dotenv from "dotenv";
dotenv.config();
import requestHandler from "./class/RequestHandler";
import { Bike as PrismaBike, Station, Travel } from "@prisma/client";
import prisma from "./lib/prisma";
import { Bike as ApiBike } from "./types/bike";

// --- Types ---

interface TrackingInfo {
  stationNumber: number;
}

interface BikeUpdate {
  where: { number: number };
  data: { stationNumber: number };
}

interface TravelInsert {
  stationFromNumber: number;
  bikeNumber: number;
  startDateTime: Date;
}

interface TravelUpdate {
  where: { id: string };
  data: { stationToNumber: number; endDateTime: Date };
}

// --- State ---

let liveUpdatedStations: Record<number, boolean> = {};
const trackingBikes: Record<number, TrackingInfo> = {};
/** In-memory cache of all bikes, synced with DB. Avoids full reload every cycle. */
let bikeCache: Record<number, PrismaBike> = {};
let bikeCacheInitialized = false;

// --- Helpers ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Station logic ---

async function fetchLiveStationsData(): Promise<any[]> {
  if (!process.env.VELOV_API_KEY) {
    throw new Error("VELOV_API_KEY is not defined");
  }
  const response = await fetch(
    `https://api.jcdecaux.com/vls/v3/stations?apiKey=${process.env.VELOV_API_KEY}&contract=lyon`
  );
  if (!response.ok) {
    throw new Error(`JCDecaux API returned status ${response.status}`);
  }
  return response.json();
}

async function updateStations(): Promise<void> {
  const stations = await prisma.station.findMany();
  const existingStations: Record<number, Station> = {};
  for (const station of stations) {
    existingStations[station.number] = station;
  }

  let liveStationsData: any[];
  try {
    liveStationsData = await fetchLiveStationsData();
  } catch (e) {
    console.error("Error fetching live stations:", e);
    return;
  }

  // Insert new stations that don't exist in DB yet
  const stationsToInsert: {
    number: number; name: string; address: string; position: string;
    banking: boolean; bonus: boolean; connected: boolean; status: string; totalStands: number;
  }[] = [];
  for (const liveStation of liveStationsData) {
    if (existingStations[liveStation.number]) {
      continue;
    }
    stationsToInsert.push({
      number: liveStation.number,
      name: liveStation.name,
      address: liveStation.address,
      position: `${liveStation.position.latitude},${liveStation.position.longitude}`,
      banking: liveStation.banking,
      bonus: liveStation.bonus,
      connected: liveStation.connected,
      status: liveStation.status,
      totalStands: liveStation.totalStands.capacity,
    });
  }

  try {
    if (stationsToInsert.length) {
      await prisma.station.createMany({ data: stationsToInsert });
      console.log(`${stationsToInsert.length} new stations inserted`);
    }
  } catch (e) {
    console.error("Error inserting stations:", e);
    return;
  }

  // Update the live stations set (reset each cycle to reflect current state)
  liveUpdatedStations = {};
  for (const liveStation of liveStationsData) {
    liveUpdatedStations[liveStation.number] = true;
  }

  console.log("Stations updated");
}

// --- Bike logic ---

async function ensureBikeCacheLoaded(): Promise<void> {
  if (bikeCacheInitialized) return;
  const storedBikes = await prisma.bike.findMany();
  bikeCache = {};
  for (const bike of storedBikes) {
    bikeCache[bike.number] = bike;
  }
  bikeCacheInitialized = true;
  console.log(`Bike cache initialized with ${storedBikes.length} bikes`);
}

async function updateBikes(): Promise<void> {
  let liveBikes: ApiBike[];
  try {
    liveBikes = await requestHandler.handleRequest(
      "https://api.cyclocity.fr/contracts/lyon/bikes",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/vnd.bikes.v4+json",
        },
      }
    ) as ApiBike[];
  } catch (error) {
    console.error("Error fetching live bikes:", error);
    return;
  }

  await ensureBikeCacheLoaded();

  // Pre-load all unfinished travels to avoid N+1 queries in updateTravel
  const unfinishedTravels = await prisma.travel.findMany({
    where: { stationToNumber: null },
  });
  const unfinishedTravelsByBike: Record<number, Travel> = {};
  const now = new Date();
  const MAX_TRAVEL_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
  const staleIds: string[] = [];
  for (const travel of unfinishedTravels) {
    if (now.getTime() - travel.startDateTime.getTime() > MAX_TRAVEL_DURATION_MS) {
      staleIds.push(travel.id);
      delete trackingBikes[travel.bikeNumber];
    } else {
      unfinishedTravelsByBike[travel.bikeNumber] = travel;
    }
  }
  if (staleIds.length) {
    await prisma.travel.deleteMany({ where: { id: { in: staleIds } } });
    console.log(`Deleted ${staleIds.length} stale travels (>6h)`);
  }

  const bikesToInsert: { number: number; type: string; stationNumber: number }[] = [];
  const bikesToUpdate: BikeUpdate[] = [];
  const travelInserts: TravelInsert[] = [];
  const travelUpdates: TravelUpdate[] = [];

  for (const bike of liveBikes) {
    if (
      !["AVAILABLE", "RENTED", "RESERVED"].includes(bike.status) ||
      (liveUpdatedStations[bike.stationNumber as number] === undefined && bike.status !== "RENTED")
    ) {
      continue;
    }

    // Bike is being tracked and has changed station → end travel
    if (trackingBikes[bike.number] && trackingBikes[bike.number].stationNumber !== bike.stationNumber) {
      if (bike.status === "RENTED" || bike.stationNumber === undefined) {
        continue;
      }
      endTravel(bike.stationNumber, bikeCache[bike.number], unfinishedTravelsByBike, travelUpdates);
    }

    if (bikeCache[bike.number] !== undefined) {
      if (bike.status === "RENTED" && !trackingBikes[bike.number]) {
        // Bike just rented → start a new travel
        startTravel(bikeCache[bike.number], travelInserts);
      } else if (bike.status === "AVAILABLE" && bikeCache[bike.number].stationNumber !== bike.stationNumber) {
        bikesToUpdate.push({
          where: { number: bike.number },
          data: { stationNumber: bike.stationNumber as number },
        });
      }
    } else {
      // New bike we've never seen before
      if (bike.stationNumber === undefined) {
        continue;
      }
      bikesToInsert.push({
        number: bike.number,
        type: bike.type,
        stationNumber: bike.stationNumber,
      });
    }
  }

  // --- Persist bike changes ---
  try {
    if (bikesToUpdate.length) {
      console.log(`${bikesToUpdate.length} bikes have changed location`);
      await prisma.$transaction(
        bikesToUpdate.map((b) => prisma.bike.update({ where: b.where, data: b.data }))
      );
      // Sync cache
      for (const b of bikesToUpdate) {
        if (bikeCache[b.where.number]) {
          bikeCache[b.where.number] = { ...bikeCache[b.where.number], stationNumber: b.data.stationNumber };
        }
      }
    }
    if (bikesToInsert.length) {
      await prisma.bike.createMany({ data: bikesToInsert });
      console.log(`${bikesToInsert.length} new bikes inserted`);
      // Sync cache with newly inserted bikes
      const newBikes = await prisma.bike.findMany({
        where: { number: { in: bikesToInsert.map((b) => b.number) } },
      });
      for (const bike of newBikes) {
        bikeCache[bike.number] = bike;
      }
    }
  } catch (error) {
    console.error("Error updating bikes:", error);
    return;
  }

  console.log("Bikes updated");

  // --- Persist travel changes ---
  try {
    if (travelInserts.length) {
      await prisma.travel.createMany({ data: travelInserts });
      console.log(`${travelInserts.length} travels started`);
    }
    if (travelUpdates.length) {
      await prisma.$transaction(
        travelUpdates.map((t) => prisma.travel.update({ where: t.where, data: t.data }))
      );
      console.log(`${travelUpdates.length} travels completed`);
    }
  } catch (error) {
    console.error("Error updating travels:", error);
    return;
  }
}

// --- Travel helpers (synchronous — no DB calls inside the loop) ---

function startTravel(bike: PrismaBike, travelInserts: TravelInsert[]): void {
  travelInserts.push({
    stationFromNumber: bike.stationNumber,
    bikeNumber: bike.number,
    startDateTime: new Date(),
  });
  trackingBikes[bike.number] = { stationNumber: bike.stationNumber };
}

function endTravel(
  endStationNumber: number,
  bike: PrismaBike | undefined,
  unfinishedTravelsByBike: Record<number, Travel>,
  travelUpdates: TravelUpdate[]
): void {
  if (!bike) return;

  const currentTracking = trackingBikes[bike.number];
  if (currentTracking === undefined) return;

  const storedTravel = unfinishedTravelsByBike[bike.number];
  if (!storedTravel) return;

  travelUpdates.push({
    where: { id: storedTravel.id },
    data: { stationToNumber: endStationNumber, endDateTime: new Date() },
  });
  delete trackingBikes[bike.number];
}

// --- Cleanup ---

async function cleanUnfinishedTravels(): Promise<void> {
  const deleted = await prisma.travel.deleteMany({
    where: { stationToNumber: null },
  });
  if (deleted.count > 0) {
    console.log(`Cleaned ${deleted.count} unfinished travels`);
  }
}

// --- Main loop (sequential, no overlapping executions) ---

async function runStationsLoop(): Promise<void> {
  const STATION_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  while (true) {
    await delay(STATION_INTERVAL);
    try {
      await updateStations();
    } catch (e) {
      console.error("Unhandled error in station loop:", e);
    }
  }
}

async function runBikesLoop(): Promise<void> {
  const BIKE_INTERVAL = 10 * 1000; // 10 seconds
  while (true) {
    await delay(BIKE_INTERVAL);
    try {
      await updateBikes();
    } catch (e) {
      console.error("Unhandled error in bike loop:", e);
    }
  }
}

// --- Graceful shutdown ---

let isShuttingDown = false;
function handleShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  prisma.$disconnect().finally(() => process.exit(0));
}
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// --- Bootstrap ---

await cleanUnfinishedTravels();
await updateStations();
await updateBikes();

// Start both loops concurrently (but each loop is internally sequential)
runStationsLoop();
runBikesLoop();
