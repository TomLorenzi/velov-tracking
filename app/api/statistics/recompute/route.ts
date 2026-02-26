import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function computeStatistics() {
    // Total counts
    const [, totalBikes, totalStations] = await Promise.all([
        prisma.travel.count(),
        prisma.bike.count(),
        prisma.station.count(),
    ]);

    // Completed travels only (have endDateTime)
    const completedTravels = await prisma.travel.count({
        where: { endDateTime: { not: null } },
    });

    // Longest travel (by duration)
    const longestTravel = await prisma.$queryRaw<
        { id: string; duration_minutes: number; stationFromNumber: number; stationToNumber: number }[]
    >`
        SELECT id, 
            EXTRACT(EPOCH FROM ("endDateTime" - "startDateTime")) / 60 AS duration_minutes,
            "stationFromNumber",
            "stationToNumber"
        FROM "Travel"
        WHERE "endDateTime" IS NOT NULL
        ORDER BY ("endDateTime" - "startDateTime") DESC
        LIMIT 1
    `;

    // Average travel duration
    const avgResult = await prisma.$queryRaw<{ avg_minutes: number }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("endDateTime" - "startDateTime")) / 60) AS avg_minutes
        FROM "Travel"
        WHERE "endDateTime" IS NOT NULL
    `;

    // Most used bike
    const mostUsedBike = await prisma.$queryRaw<
        { bikeNumber: number; travel_count: bigint }[]
    >`
        SELECT "bikeNumber", COUNT(*) AS travel_count
        FROM "Travel"
        GROUP BY "bikeNumber"
        ORDER BY travel_count DESC
        LIMIT 1
    `;

    // Busiest departure station
    const busiestDeparture = await prisma.$queryRaw<
        { stationFromNumber: number; dep_count: bigint }[]
    >`
        SELECT "stationFromNumber", COUNT(*) AS dep_count
        FROM "Travel"
        GROUP BY "stationFromNumber"
        ORDER BY dep_count DESC
        LIMIT 1
    `;

    // Busiest arrival station
    const busiestArrival = await prisma.$queryRaw<
        { stationToNumber: number; arr_count: bigint }[]
    >`
        SELECT "stationToNumber", COUNT(*) AS arr_count
        FROM "Travel"
        WHERE "stationToNumber" IS NOT NULL
        GROUP BY "stationToNumber"
        ORDER BY arr_count DESC
        LIMIT 1
    `;

    // Busiest hour of departure (Lyon time)
    const busiestHour = await prisma.$queryRaw<
        { hour: number; h_count: bigint }[]
    >`
        SELECT EXTRACT(HOUR FROM "startDateTime" AT TIME ZONE 'Europe/Paris') AS hour, COUNT(*) AS h_count
        FROM "Travel"
        GROUP BY hour
        ORDER BY h_count DESC
        LIMIT 1
    `;

    // Travels today (Lyon time)
    const travelsToday = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count
        FROM "Travel"
        WHERE ("startDateTime" AT TIME ZONE 'Europe/Paris')::date = (NOW() AT TIME ZONE 'Europe/Paris')::date
    `;
    const travelsTodayCount = Number(travelsToday[0]?.count ?? 0);

    // Most common route (pair of stations)
    const mostCommonRoute = await prisma.$queryRaw<
        { stationFromNumber: number; stationToNumber: number; route_count: bigint }[]
    >`
        SELECT "stationFromNumber", "stationToNumber", COUNT(*) AS route_count
        FROM "Travel"
        WHERE "stationToNumber" IS NOT NULL
        GROUP BY "stationFromNumber", "stationToNumber"
        ORDER BY route_count DESC
        LIMIT 1
    `;

    // Fetch station names for display
    const stationNumbers = new Set<number>();
    if (longestTravel[0]) {
        stationNumbers.add(longestTravel[0].stationFromNumber);
        stationNumbers.add(longestTravel[0].stationToNumber);
    }
    if (busiestDeparture[0]) stationNumbers.add(busiestDeparture[0].stationFromNumber);
    if (busiestArrival[0]) stationNumbers.add(busiestArrival[0].stationToNumber);
    if (mostCommonRoute[0]) {
        stationNumbers.add(mostCommonRoute[0].stationFromNumber);
        stationNumbers.add(mostCommonRoute[0].stationToNumber);
    }

    const stations = await prisma.station.findMany({
        where: { number: { in: Array.from(stationNumbers) } },
    });
    const stationMap: Record<number, string> = {};
    for (const s of stations) {
        stationMap[s.number] = s.name;
    }

    // Build statistics entries
    const entries: { key: string; value: string; label: string }[] = [
        {
            key: "total_travels",
            value: completedTravels.toLocaleString("fr-FR"),
            label: "Nombre total de trajets",
        },
        {
            key: "total_bikes",
            value: totalBikes.toLocaleString("fr-FR"),
            label: "Nombre de vélos",
        },
        {
            key: "total_stations",
            value: totalStations.toLocaleString("fr-FR"),
            label: "Nombre de stations",
        },
        {
            key: "average_travel_duration",
            value: avgResult[0]?.avg_minutes
                ? `${Math.round(avgResult[0].avg_minutes)} min`
                : "N/A",
            label: "Durée moyenne d'un trajet",
        },
        {
            key: "travels_today",
            value: travelsTodayCount.toLocaleString("fr-FR"),
            label: "Trajets aujourd'hui",
        },
    ];

    if (longestTravel[0]) {
        const lt = longestTravel[0];
        const durationH = Math.floor(lt.duration_minutes / 60);
        const durationM = Math.round(lt.duration_minutes % 60);
        entries.push({
            key: "longest_travel_duration",
            value: durationH > 0 ? `${durationH}h ${durationM}min` : `${durationM} min`,
            label: "Trajet le plus long (durée)",
        });
        entries.push({
            key: "longest_travel_info",
            value: `${stationMap[lt.stationFromNumber] || lt.stationFromNumber} → ${stationMap[lt.stationToNumber] || lt.stationToNumber}`,
            label: "Trajet le plus long (itinéraire)",
        });
    }

    if (mostUsedBike[0]) {
        entries.push({
            key: "most_used_bike",
            value: `Vélo n°${mostUsedBike[0].bikeNumber}`,
            label: "Vélo le plus utilisé",
        });
        entries.push({
            key: "most_used_bike_travels",
            value: `${Number(mostUsedBike[0].travel_count).toLocaleString("fr-FR")} trajets`,
            label: "Trajets du vélo le plus utilisé",
        });
    }

    if (busiestDeparture[0]) {
        entries.push({
            key: "busiest_departure_station",
            value: stationMap[busiestDeparture[0].stationFromNumber] || `Station ${busiestDeparture[0].stationFromNumber}`,
            label: "Station de départ la plus active",
        });
        entries.push({
            key: "busiest_departure_count",
            value: `${Number(busiestDeparture[0].dep_count).toLocaleString("fr-FR")} départs`,
            label: "Nombre de départs (station la plus active)",
        });
    }

    if (busiestArrival[0]) {
        entries.push({
            key: "busiest_arrival_station",
            value: stationMap[busiestArrival[0].stationToNumber] || `Station ${busiestArrival[0].stationToNumber}`,
            label: "Station d'arrivée la plus active",
        });
        entries.push({
            key: "busiest_arrival_count",
            value: `${Number(busiestArrival[0].arr_count).toLocaleString("fr-FR")} arrivées`,
            label: "Nombre d'arrivées (station la plus active)",
        });
    }

    if (busiestHour[0]) {
        const h = Number(busiestHour[0].hour);
        entries.push({
            key: "busiest_hour",
            value: `${h}h - ${h + 1}h`,
            label: "Heure de pointe",
        });
    }

    if (mostCommonRoute[0]) {
        const r = mostCommonRoute[0];
        entries.push({
            key: "most_common_route",
            value: `${stationMap[r.stationFromNumber] || r.stationFromNumber} → ${stationMap[r.stationToNumber] || r.stationToNumber}`,
            label: "Itinéraire le plus fréquent",
        });
        entries.push({
            key: "most_common_route_count",
            value: `${Number(r.route_count).toLocaleString("fr-FR")} trajets`,
            label: "Nombre de trajets (itinéraire le plus fréquent)",
        });
    }

    // Upsert all statistics
    for (const entry of entries) {
        await prisma.statistic.upsert({
            where: { key: entry.key },
            update: { value: entry.value, label: entry.label },
            create: { key: entry.key, value: entry.value, label: entry.label },
        });
    }

    return entries;
}

export async function GET(request: Request) {
    // Optional: protect with a secret token
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    try {
        const stats = await computeStatistics();
        return NextResponse.json({
            success: true,
            count: stats.length,
            computedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Erreur lors du calcul des statistiques:", error);
        return NextResponse.json(
            { error: "Erreur lors du calcul des statistiques" },
            { status: 500 }
        );
    }
}
