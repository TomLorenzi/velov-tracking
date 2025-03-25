'use server';

import { MapProvider } from "@/providers/map-provider";
import { MapComponent } from "./components/map";
import prisma from "@/lib/prisma";
import { Station } from "@prisma/client";
import { unstable_cache } from "next/cache";

const getStations = unstable_cache(
    async () => {
        return await prisma.station.findMany();
    },
    ['stations'],
    { revalidate: 60 * 60 * 12, tags: ['stations'] }
)
  
export default async function Map() {
    const stations = await getStations();

    return (
        <MapProvider>
            <MapComponent stations={stations} />
        </MapProvider>
    )
}