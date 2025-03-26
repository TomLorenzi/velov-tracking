'use client'

import { MapProvider } from "@/providers/map-provider";
import { useState } from "react";
import { MapComponent } from "./map";
import { Station, Travel } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
    stations: {
        [key: number]: Station;
    };
    travels: Travel[];
}

const MapClient = ({ stations, travels }: Props) => {
    const [showStations, setShowStations] = useState(true);

    return (
        <>
            <MapProvider>
                <MapComponent stations={stations} travels={travels} showStations={showStations} />
            </MapProvider>
            <div className="p-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id='stations'
                        defaultChecked
                        onCheckedChange={(checked) => setShowStations(checked !== 'indeterminate' ? checked : true)}
                    />
                    <label
                        htmlFor="stations"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Stations
                    </label>
                </div>
            </div>
        </>
    );
}

export { MapClient };