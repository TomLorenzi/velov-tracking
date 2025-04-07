import dotenv from 'dotenv';
dotenv.config();
import requestHandler from './class/RequestHandler';
import { PrismaClient, Bike as PrismaBike } from '@prisma/client';

const prisma = new PrismaClient();

let liveUpdatedStations: any = [];
let trackingBikes: any = {};
async function updateStations() {
    const stations = await prisma.station.findMany();
    const formattedStations: any = {};
    for (const station of stations) {
        formattedStations[station.number] = station;
    }
    try {
        const liveStations = await fetch(`https://api.jcdecaux.com/vls/v3/stations?apiKey=${process.env.VELOV_API_KEY}&contract=lyon`);
        const liveStationsData = await liveStations.json();
        const listStationToInsert: any[] = [];
        for (const liveStation of liveStationsData) {
            if (formattedStations[liveStation.number]) {
                continue;
            }
            listStationToInsert.push({
                number: liveStation.number,
                name: liveStation.name,
                address: liveStation.address,
                position: `${liveStation.position.latitude},${liveStation.position.longitude}`,
                banking: liveStation.banking,
                bonus: liveStation.bonus,
                connected: liveStation.connected,
                status: liveStation.status,
                totalStands: liveStation.totalStands.capacity,
            });
        }
        if (listStationToInsert.length) {
            await prisma.station.createMany({
                data: listStationToInsert
            });
        }
    } catch (_) {
        //TODO: log or smth
        return;
    }
    await updateLiveStations();
    console.log('Stations updated');
}

async function updateLiveStations() {
    if (process.env.VELOV_API_KEY === undefined) {
        throw new Error('VELOV_API_KEY is not defined');
    }
    try {
        const liveStations = await fetch(`https://api.jcdecaux.com/vls/v3/stations?apiKey=${process.env.VELOV_API_KEY}&contract=lyon`);
        const liveStationsData = await liveStations.json();
        for (const liveStation of liveStationsData) {
            liveUpdatedStations[liveStation.number] = true;
        }
    } catch (_) {
        //TODO: log or smth
        return;
    }
}

async function updateBikes() {
    let liveBikes = [];
    try {
        liveBikes = await requestHandler.handleRequest('https://api.cyclocity.fr/contracts/lyon/bikes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/vnd.bikes.v4+json'
            }
        });
    } catch (error) {
        return;
    }
    const storedBikes = await prisma.bike.findMany();
    const formattedBikes: any = {};
    for (const bike of storedBikes) {
        formattedBikes[bike.number] = bike;
    }
    const listBikesToInsert: any[] = [];
    const listBikesToUpdates: any[] = [];
    let listTravelToInsert: any[] = [];
    let listTravelToUpdates: any[] = [];
    for (const bike of liveBikes) {
        if (!['AVAILABLE', 'RENTED', 'RESERVED'].includes(bike.status)
            || (undefined === liveUpdatedStations[bike.stationNumber] && bike.status !== 'RENTED')
        ) {
            continue;
        }
        if (trackingBikes[bike.number]
            && trackingBikes[bike.number].stationNumber !== bike.stationNumber
        ) {
            if (bike.status === 'RENTED' || bike.stationNumber === undefined) {
                continue;
            }
            [listTravelToInsert, listTravelToUpdates] = await updateTravel(bike.stationNumber, formattedBikes[bike.number], listTravelToInsert, listTravelToUpdates);
        }
        if (formattedBikes[bike.number] !== undefined) {
            if (bike.status === 'RENTED') {
                [listTravelToInsert, listTravelToUpdates] = await updateTravel(null, formattedBikes[bike.number], listTravelToInsert, listTravelToUpdates);
            } else if (bike.status === 'AVAILABLE' && formattedBikes[bike.number].stationNumber !== bike.stationNumber) {
                listBikesToUpdates.push({
                    where: {
                        number: bike.number
                    },
                    data: {
                        stationNumber: bike.stationNumber
                    }
                });
            }
        } else {
            if (bike.stationNumber === undefined) {
                continue;
            }
            listBikesToInsert.push({
                number: bike.number,
                type: bike.type,
                stationNumber: bike.stationNumber,
            });
        }
    }
    try {
        if (listBikesToUpdates.length) {
            console.log(`${listBikesToUpdates.length} bikes have changed location`);
            //This might take a long time is script wasn't running for some time, many bikes to updates
            await prisma.$transaction([
                ...listBikesToUpdates.map(bike => prisma.bike.update({
                    where: bike.where,
                    data: bike.data
                }))
            ]);
        }
        if (listBikesToInsert.length) {
            await prisma.bike.createMany({
                data: listBikesToInsert
            });
        }
    } catch (error) {
        return; //TODO: log or smth
    }

    console.log('Bikes updated');

    try {
        if (listTravelToInsert.length) {
            await prisma.travel.createMany({
                data: listTravelToInsert
            });
        }
        if (listTravelToUpdates.length) {
            await prisma.$transaction([
                ...listTravelToUpdates.map(travel => prisma.travel.update({
                    where: travel.where,
                    data: travel.data
                }))
            ]);
        }
    } catch (error) {
        return; //TODO: log or smth
    }

    console.log('Travels updated');
}

async function updateTravel(endStationNumber: number|null, bike: PrismaBike, listTravelToInsert: any[], listTravelToUpdates: any[]) {
    const currentTravel = trackingBikes[bike.number];
    if (endStationNumber === null) {
        listTravelToInsert.push({
            stationFromNumber: bike.stationNumber,
            bikeNumber: bike.number,
            startDateTime: new Date()
        });
        trackingBikes[bike.number] = {
            stationNumber: bike.stationNumber
        };
    } else {
        if (currentTravel === undefined) {
            return [listTravelToInsert, listTravelToUpdates];
        }
        const storedTravel = await prisma.travel.findFirst({
            where: {
                bikeNumber: bike.number,
                stationToNumber: null
            }
        });
        if (storedTravel === null) {
            return [listTravelToInsert, listTravelToUpdates];
        }
        listTravelToUpdates.push({
            where: {
                id: storedTravel.id,
            },
            data: {
                stationToNumber: endStationNumber,
                endDateTime: new Date()
            }
        });
        delete trackingBikes[bike.number];
    }

    return [listTravelToInsert, listTravelToUpdates];
}

async function cleanUnfinishedTravels() {
    await prisma.travel.deleteMany({
        where: {
            stationToNumber: null
        }
    });
}

await cleanUnfinishedTravels();
await updateStations();
await updateBikes();

function startLoop() {
    setInterval(async () => {
        await updateStations();
    }, 12 * 60 * 60 * 1000);
    setInterval(async () => {
        await updateBikes();
    }, 0.5 * 60 * 1000);
}

startLoop();