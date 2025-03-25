'use server';

import { MapProvider } from "@/providers/map-provider";
import { MapComponent } from "./components/map";
import prisma from "@/lib/prisma";
import { Station } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getTravels } from "./action";

const getStations = unstable_cache(
    async () => {
        const stations = await prisma.station.findMany();
        const formattedStations: {
            [key: number]: Station;
        } = {};
        for (const station of stations) {
            formattedStations[station.number] = station;
        }

        return formattedStations;
    },
    ['stations'],
    { revalidate: 60 * 60 * 12, tags: ['stations'] }
)
  
export default async function Map() {
    const stations = await getStations();
    const travels = await getTravels();

    return (
        <MapProvider>
            <MapComponent stations={stations} travels={travels} />
        </MapProvider>
    )
}