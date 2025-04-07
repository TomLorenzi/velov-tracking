'use server'

import { Option } from "@/components/ui/multi-select";
import { DateRange } from "react-day-picker";

export async function fetchTravels(date: DateRange | undefined) {
    if (!date) {
        return await prisma.travel.findMany();
    }
    const listTravels = await prisma.travel.findMany({
        where: {
            OR: [
                {
                    startDateTime: {
                        gte: date?.from,
                        lte: date?.to
                    }
                },
                {
                    endDateTime: {
                        gte: date?.from,
                        lte: date?.to
                    }
                }
            ]
        }
    });

    return listTravels;
}