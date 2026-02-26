'use server'

import { DateRange } from "react-day-picker";
import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const MAX_RANGE_DAYS = 7;

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

const queryTravels = unstable_cache(
    async (fromISO: string, toISO: string) => {
        const from = new Date(fromISO);
        const to = new Date(toISO);

        return prisma.travel.findMany({
            where: {
                endDateTime: { not: null },
                OR: [
                    { startDateTime: { gte: from, lte: to } },
                    { endDateTime: { gte: from, lte: to } },
                ],
            },
        });
    },
    ["travels-by-date"],
    { revalidate: 300 } // 5 minutes
);

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

        const startHour = startDateTime.getHours();
        const startMinute = startDateTime.getMinutes();
        const endHour = endDateTime.getHours();
        const endMinute = endDateTime.getMinutes();

        const isStartInRange =
            startHour > timeFilters.startHour ||
            (startHour === timeFilters.startHour && startMinute >= timeFilters.startMinute);

        const isEndInRange =
            endHour < timeFilters.endHour ||
            (endHour === timeFilters.endHour && endMinute <= timeFilters.endMinute);

        return isStartInRange && isEndInRange;
    });
}