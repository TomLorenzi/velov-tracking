import dotenv from "dotenv";
dotenv.config();
// The daemon is a long-running process — use the direct DB connection
// to avoid connection pooler (PgBouncer) overhead and reduce egress.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import requestHandler from "./class/RequestHandler";
import { Bike as PrismaBike, Prisma, Station } from "@prisma/client";
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
  bikeNumber: number;
  originalStationNumber: number;
}

// --- Discord webhook ---

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

async function sendDiscordMessage(content: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL not set, skipping notification");
    return;
  }
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.error(`Discord webhook returned ${res.status}`);
    }
  } catch (e) {
    console.error("Failed to send Discord message:", e);
  }
}

// --- State ---

let liveUpdatedStations: Record<number, boolean> = {};
const trackingBikes: Record<number, TrackingInfo> = {};
/** In-memory cache of all bikes, synced with DB. Avoids full reload every cycle. */
let bikeCache: Record<number, PrismaBike> = {};
let bikeCacheInitialized = false;

/** In-memory cache of unfinished travels, indexed by bike number. Avoids querying DB every cycle. */
interface CachedTravel {
  id: string;
  startDateTime: Date;
}
const unfinishedTravelCache: Record<number, CachedTravel> = {};
let travelCacheInitialized = false;

/** Daily travel counters (reset every 24h after recap) */
let dailyTravelsStarted = 0;
let dailyTravelsCompleted = 0;

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

async function ensureTravelCacheLoaded(): Promise<void> {
  if (travelCacheInitialized) return;
  const unfinished = await prisma.travel.findMany({
    where: { stationToNumber: null },
    select: { id: true, bikeNumber: true, startDateTime: true },
  });
  for (const t of unfinished) {
    unfinishedTravelCache[t.bikeNumber] = { id: t.id, startDateTime: t.startDateTime };
  }
  travelCacheInitialized = true;
  console.log(`Travel cache initialized with ${unfinished.length} unfinished travels`);
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
  await ensureTravelCacheLoaded();

  // Clean stale unfinished travels (>6h) from cache
  const now = new Date();
  const MAX_TRAVEL_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
  const staleIds: string[] = [];
  for (const [bikeNumberStr, travel] of Object.entries(unfinishedTravelCache)) {
    if (now.getTime() - travel.startDateTime.getTime() > MAX_TRAVEL_DURATION_MS) {
      const bikeNumber = Number(bikeNumberStr);
      staleIds.push(travel.id);
      delete trackingBikes[bikeNumber];
      delete unfinishedTravelCache[bikeNumber];
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
      endTravel(bike.stationNumber, bikeCache[bike.number], travelUpdates);
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
      const bikeValues = bikesToUpdate.map(
        (b) => Prisma.sql`(${b.where.number}, ${b.data.stationNumber})`
      );
      await prisma.$executeRaw`
        UPDATE "Bike" SET "stationNumber" = v.s::int
        FROM (VALUES ${Prisma.join(bikeValues)}) AS v(n, s)
        WHERE "Bike"."number" = v.n::int
      `;
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
      // Sync cache directly from insert data (avoids re-querying DB)
      for (const bike of bikesToInsert) {
        bikeCache[bike.number] = {
          number: bike.number,
          type: bike.type,
          status: null,
          stationNumber: bike.stationNumber,
        };
      }
    }
  } catch (error) {
    console.error("Error updating bikes:", error);
    return;
  }

  console.log("Bikes updated");

  // --- Persist travel starts ---
  try {
    if (travelInserts.length) {
      const created = await prisma.travel.createManyAndReturn({
        data: travelInserts,
        select: { id: true, bikeNumber: true, stationFromNumber: true, startDateTime: true },
      });
      for (const t of created) {
        trackingBikes[t.bikeNumber] = { stationNumber: t.stationFromNumber };
        unfinishedTravelCache[t.bikeNumber] = { id: t.id, startDateTime: t.startDateTime };
      }
      dailyTravelsStarted += created.length;
      console.log(`${created.length} travels started`);
    }
  } catch (error) {
    console.error("Error inserting travels:", error);
  }

  // --- Persist travel completions ---
  try {
    if (travelUpdates.length) {
      const travelValues = travelUpdates.map(
        (t) => Prisma.sql`(${t.where.id}, ${t.data.stationToNumber}, ${t.data.endDateTime})`
      );
      await prisma.$executeRaw`
        UPDATE "Travel" SET "stationToNumber" = v.s::int, "endDateTime" = v.e::timestamptz
        FROM (VALUES ${Prisma.join(travelValues)}) AS v(i, s, e)
        WHERE "Travel"."id" = v.i
      `;
      for (const t of travelUpdates) {
        delete unfinishedTravelCache[t.bikeNumber];
      }
      dailyTravelsCompleted += travelUpdates.length;
      console.log(`${travelUpdates.length} travels completed`);
    }
  } catch (error) {
    // Restore tracking for bikes whose travel completion failed
    for (const t of travelUpdates) {
      trackingBikes[t.bikeNumber] = { stationNumber: t.originalStationNumber };
    }
    console.error("Error completing travels:", error);
  }
}

// --- Travel helpers (synchronous — no DB calls inside the loop) ---

function startTravel(bike: PrismaBike, travelInserts: TravelInsert[]): void {
  travelInserts.push({
    stationFromNumber: bike.stationNumber,
    bikeNumber: bike.number,
    startDateTime: new Date(),
  });
  // trackingBikes is updated after successful DB insert to ensure consistency
}

function endTravel(
  endStationNumber: number,
  bike: PrismaBike | undefined,
  travelUpdates: TravelUpdate[]
): void {
  if (!bike) return;

  const currentTracking = trackingBikes[bike.number];
  if (currentTracking === undefined) return;

  const cachedTravel = unfinishedTravelCache[bike.number];
  if (!cachedTravel) {
    // No matching travel in DB — clean up stale tracking entry
    delete trackingBikes[bike.number];
    return;
  }

  travelUpdates.push({
    where: { id: cachedTravel.id },
    data: { stationToNumber: endStationNumber, endDateTime: new Date() },
    bikeNumber: bike.number,
    originalStationNumber: currentTracking.stationNumber,
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
  // Clear travel cache since all unfinished travels were deleted
  for (const key of Object.keys(unfinishedTravelCache)) {
    delete unfinishedTravelCache[Number(key)];
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

async function runDailyRecapLoop(): Promise<void> {
  const RECAP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  while (true) {
    await delay(RECAP_INTERVAL);
    try {
      const msg = [
        `📊 **Vélo'v Tracking — Récap 24h**`,
        `• Trajets démarrés : **${dailyTravelsStarted}**`,
        `• Trajets terminés : **${dailyTravelsCompleted}**`,
        `• Vélos actuellement suivis : **${Object.keys(trackingBikes).length}**`,
        `_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`,
      ].join("\n");
      await sendDiscordMessage(msg);
      console.log("Daily recap sent to Discord");
      dailyTravelsStarted = 0;
      dailyTravelsCompleted = 0;
    } catch (e) {
      console.error("Error sending daily recap:", e);
    }
  }
}

// --- Graceful shutdown ---

let isShuttingDown = false;
async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  await sendDiscordMessage(
    `🛑 **Vélo'v Tracking — Arrêt**\nLe script s'est arrêté (signal: \`${signal}\`).\n_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`
  );
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", async (err) => {
  console.error("Uncaught exception:", err);
  await sendDiscordMessage(
    `🔥 **Vélo'v Tracking — Crash**\nErreur fatale : \`${err.message}\`\n_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`
  );
  await prisma.$disconnect();
  process.exit(1);
});

// --- Bootstrap ---

await cleanUnfinishedTravels();
await updateStations();
await updateBikes();

// Start all loops concurrently (each loop is internally sequential)
runStationsLoop();
runBikesLoop();
runDailyRecapLoop();

await sendDiscordMessage(
  `✅ **Vélo'v Tracking — Démarré**\n_${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}_`
);
