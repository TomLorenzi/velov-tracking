'use server'

import { DateRange } from "react-day-picker";
import prisma from "@/lib/prisma";

const MAX_RANGE_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const travelsCache = new Map<string, { data: TravelSummary[]; timestamp: number }>();

function clampDateRange(date: DateRange | undefined): { from: Date; to: Date } {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - (MAX_RANGE_DAYS - 1));
    defaultFrom.setHours(0, 0, 0, 0);
    const defaultTo = new Date(now);
    defaultTo.setHours(23, 59, 59, 999);

    if (!date?.from) {
        return { from: defaultFrom, to: defaultTo };
    }

    const from = new Date(date.from);
    from.setHours(0, 0, 0, 0);

    let to = date.to ? new Date(date.to) : new Date(from);
    to.setHours(23, 59, 59, 999);

    // Clamp to max range
    const maxTo = new Date(from);
    maxTo.setDate(maxTo.getDate() + MAX_RANGE_DAYS - 1);
    maxTo.setHours(23, 59, 59, 999);
    if (to > maxTo) {
        to = maxTo;
    }

    return { from, to };
}

export type TravelSummary = {
    startDateTime: Date;
    endDateTime: Date | null;
    stationFromNumber: number;
    stationToNumber: number | null;
};

async function queryTravels(fromISO: string, toISO: string): Promise<TravelSummary[]> {
    const cacheKey = `${fromISO}|${toISO}`;
    const cached = travelsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const from = new Date(fromISO);
    const to = new Date(toISO);

    const data = await prisma.travel.findMany({
        where: {
            endDateTime: { not: null },
            OR: [
                { startDateTime: { gte: from, lte: to } },
                { endDateTime: { gte: from, lte: to } },
            ],
        },
        select: {
            startDateTime: true,
            endDateTime: true,
            stationFromNumber: true,
            stationToNumber: true,
        },
    });

    travelsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

export async function fetchTravels(date: DateRange | undefined, formattedTimeRange: { start: Date, end: Date } | undefined) {
    const { from, to } = clampDateRange(date);

    // Use longer cache for fully past ranges (data won't change)
    const listTravels = await queryTravels(from.toISOString(), to.toISOString());

    if (!formattedTimeRange) {
        return listTravels;
    }

    const timeFilters = {
        startHour: formattedTimeRange.start.getHours(),
        startMinute: formattedTimeRange.start.getMinutes(),
        endHour: formattedTimeRange.end.getHours(),
        endMinute: formattedTimeRange.end.getMinutes(),
    };

    return listTravels.filter(travel => {
        if (!travel.endDateTime) return false;

        const startDateTime = new Date(travel.startDateTime);
        const endDateTime = new Date(travel.endDateTime);

        // Convert to minutes since midnight for easier comparison
        const travelStartMinutes = startDateTime.getHours() * 60 + startDateTime.getMinutes();
        const travelEndMinutes = endDateTime.getHours() * 60 + endDateTime.getMinutes();
        const filterStartMinutes = timeFilters.startHour * 60 + timeFilters.startMinute;
        const filterEndMinutes = timeFilters.endHour * 60 + timeFilters.endMinute;

        // Include travel if it overlaps with the time window
        return travelStartMinutes <= filterEndMinutes && travelEndMinutes >= filterStartMinutes;
    });
}