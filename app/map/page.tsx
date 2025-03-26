import { Station } from "@prisma/client";
import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { MapClient } from "./components/mapClient";

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
);

async function getTravels() {
    return await prisma.travel.findMany();
}

export default async function MapPage() {
    const stations = await getStations();
    const travels = await getTravels();

    return <MapClient stations={stations} travels={travels} />;
}