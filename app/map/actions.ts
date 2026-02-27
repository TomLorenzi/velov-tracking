'use server'

import { DateRange } from "react-day-picker";
import prisma from "@/lib/prisma";

const MAX_RANGE_DAYS = 7;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TIMEZONE = 'Europe/Paris';

const travelsCache = new Map<string, { data: TravelSummary[]; timestamp: number }>();

/** Extract hours and minutes in Europe/Paris timezone regardless of server TZ */
function getParisHoursMinutes(date: Date): { hours: number; minutes: number } {
    const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: TIMEZONE,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(date);

    const hours = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return { hours, minutes };
}

/** Get the start of the day in Paris timezone */
function startOfDayParis(date: Date): Date {
    const paris = new Intl.DateTimeFormat('fr-FR', {
        timeZone: TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);

    const year = paris.find(p => p.type === 'year')?.value;
    const month = paris.find(p => p.type === 'month')?.value;
    const day = paris.find(p => p.type === 'day')?.value;

    // Create midnight in Paris: "YYYY-MM-DDT00:00:00" interpreted in Paris TZ
    // Using a well-known offset calculation
    const midnightParis = new Date(`${year}-${month}-${day}T00:00:00`);
    // Compute the offset for this specific date in Paris (handles DST)
    const offsetMs = midnightParis.getTime() - new Date(
        midnightParis.toLocaleString('en-US', { timeZone: TIMEZONE })
    ).getTime();
    return new Date(midnightParis.getTime() + offsetMs);
}

/** Get the end of the day in Paris timezone */
function endOfDayParis(date: Date): Date {
    const start = startOfDayParis(date);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function clampDateRange(date: DateRange | undefined): { from: Date; to: Date } {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - (MAX_RANGE_DAYS - 1));
    const from_default = startOfDayParis(defaultFrom);
    const to_default = endOfDayParis(now);

    if (!date?.from) {
        return { from: from_default, to: to_default };
    }

    const from = startOfDayParis(new Date(date.from));

    let to = date.to ? endOfDayParis(new Date(date.to)) : endOfDayParis(new Date(date.from));

    // Clamp to max range
    const maxTo = new Date(from);
    maxTo.setDate(maxTo.getDate() + MAX_RANGE_DAYS - 1);
    const maxToEnd = endOfDayParis(maxTo);
    if (to > maxToEnd) {
        to = maxToEnd;
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

    const startDate = new Date(formattedTimeRange.start);
    const endDate = new Date(formattedTimeRange.end);
    const startParis = getParisHoursMinutes(startDate);
    const endParis = getParisHoursMinutes(endDate);
    const filterStartMinutes = startParis.hours * 60 + startParis.minutes;
    const filterEndMinutes = endParis.hours * 60 + endParis.minutes;

    return listTravels.filter(travel => {
        if (!travel.endDateTime) return false;

        const startDateTime = new Date(travel.startDateTime);
        const endDateTime = new Date(travel.endDateTime);

        // Convert to minutes since midnight in Paris timezone
        const travelStart = getParisHoursMinutes(startDateTime);
        const travelEnd = getParisHoursMinutes(endDateTime);
        const travelStartMinutes = travelStart.hours * 60 + travelStart.minutes;
        const travelEndMinutes = travelEnd.hours * 60 + travelEnd.minutes;
        // Include travel if it overlaps with the time window
        return travelStartMinutes <= filterEndMinutes && travelEndMinutes >= filterStartMinutes;
    });
}