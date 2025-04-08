'use server'

import { Travel } from "@prisma/client";
import { DateRange } from "react-day-picker";

export async function fetchTravels(date: DateRange | undefined, formattedTimeRange: { start: Date, end: Date } | undefined) {
    let listTravels: Travel[] = [];
    if (!date) {
        listTravels = await prisma.travel.findMany({
            where: {
                endDateTime: {
                    not: null
                }
            }
        });
    } else {
        listTravels = await prisma.travel.findMany({
            where: {
                endDateTime: {
                    not: null
                },
                OR: [
                    {
                        startDateTime: {
                            gte: date.from,
                            lte: date.to
                        }
                    },
                    {
                        endDateTime: {
                            gte: date.from,
                            lte: date.to
                        }
                    }
                ],
            }
        });
    }

    if (!formattedTimeRange) {
        return listTravels;
    }

    const timeFilters = formattedTimeRange
        ? {
            startHour: formattedTimeRange.start.getHours(),
            startMinute: formattedTimeRange.start.getMinutes(),
            endHour: formattedTimeRange.end.getHours(),
            endMinute: formattedTimeRange.end.getMinutes(),
        }
        : undefined;

    const filteredTravels = timeFilters
        ? listTravels.filter(travel => {
            if (!travel.endDateTime) {
                return false;
            }
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
        })
        : listTravels;

    return filteredTravels;
}