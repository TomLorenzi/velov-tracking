const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const stats = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int as total,
           MIN("startDateTime") as first_travel,
           MAX("startDateTime") as last_travel,
           COUNT(CASE WHEN "stationToNumber" IS NULL THEN 1 END)::int as unfinished,
           COUNT(CASE WHEN "stationToNumber" IS NOT NULL THEN 1 END)::int as finished
    FROM "Travel"
  `);
  console.log("=== Overall stats ===");
  console.log(JSON.stringify(stats, null, 2));

  const perBike = await p.$queryRawUnsafe(`
    SELECT "bikeNumber", COUNT(*)::int as cnt
    FROM "Travel"
    GROUP BY "bikeNumber"
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log("\n=== Top 20 bikes by travel count ===");
  console.log(JSON.stringify(perBike, null, 2));

  const rapidDups = await p.$queryRawUnsafe(`
    SELECT t1."bikeNumber", t1."startDateTime" as start1, t2."startDateTime" as start2,
           EXTRACT(EPOCH FROM (t2."startDateTime" - t1."startDateTime"))::int as diff_seconds,
           t1."stationFromNumber" as station1, t2."stationFromNumber" as station2
    FROM "Travel" t1
    JOIN "Travel" t2 ON t1."bikeNumber" = t2."bikeNumber"
      AND t2."startDateTime" > t1."startDateTime"
      AND t2."startDateTime" < t1."startDateTime" + INTERVAL '60 seconds'
      AND t1."id" != t2."id"
    ORDER BY t1."startDateTime" DESC
    LIMIT 20
  `);
  console.log("\n=== Rapid-fire duplicates (same bike, <60s apart) ===");
  console.log(JSON.stringify(rapidDups, null, 2));

  const daily = await p.$queryRawUnsafe(`
    SELECT DATE("startDateTime") as day, COUNT(*)::int as cnt
    FROM "Travel"
    GROUP BY DATE("startDateTime")
    ORDER BY day DESC
    LIMIT 15
  `);
  console.log("\n=== Daily travel counts ===");
  console.log(JSON.stringify(daily, null, 2));

  const hourly = await p.$queryRawUnsafe(`
    SELECT date_trunc('hour', "startDateTime") as hour, COUNT(*)::int as cnt
    FROM "Travel"
    GROUP BY date_trunc('hour', "startDateTime")
    ORDER BY hour DESC
    LIMIT 24
  `);
  console.log("\n=== Hourly travel counts ===");
  console.log(JSON.stringify(hourly, null, 2));

  const sample = await p.$queryRawUnsafe(`
    SELECT t."bikeNumber", t."startDateTime", t."endDateTime", 
           t."stationFromNumber", t."stationToNumber"
    FROM "Travel" t
    WHERE t."bikeNumber" = (SELECT "bikeNumber" FROM "Travel" GROUP BY "bikeNumber" ORDER BY COUNT(*) DESC LIMIT 1)
    ORDER BY t."startDateTime" DESC
    LIMIT 20
  `);
  console.log("\n=== Sample travels for top bike ===");
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
