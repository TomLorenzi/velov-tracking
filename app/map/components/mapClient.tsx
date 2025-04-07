'use client'

import { MapProvider } from "@/providers/map-provider";
import { useEffect, useState } from "react";
import { MapComponent } from "./map";
import { Station, Travel } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "./datepicker";
import { fetchTravels } from "../actions";
import MultipleSelector, { Option } from "@/components/ui/multi-select";

interface Props {
    stations: {
        [key: number]: Station;
    };
}

const MapClient = ({ stations }: Props) => {
    const [showStations, setShowStations] = useState(false);
    const [travels, setTravels] = useState<Travel[]>([]);
    const [date, setDate] = useState<DateRange | undefined>();

    useEffect(() => {
        getTravels(date);
    }, [date]);

    const getTravels = async (date: DateRange | undefined) => {
        const listTravels = await fetchTravels(date);
        setTravels(listTravels);
    }

    const OPTIONS: Option[] = [
        { label: 'Station départ', value: 'stationFrom' },
        { label: 'Station arrivée', value: 'stationTo' },
    ];

    const [stationFilters, setStationFilters] = useState<Option[]>(OPTIONS);

    return (
        <>
            <MapProvider>
                <MapComponent stations={stations} travels={travels} showStations={showStations} stationFilters={stationFilters} />
            </MapProvider>
            <div className="p-4 flex space-x-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id='stations'
                        onCheckedChange={(checked) => setShowStations(checked !== 'indeterminate' ? checked : true)}
                    />
                    <label
                        htmlFor="stations"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Stations
                    </label>
                </div>
                <DatePickerWithRange date={date} setDate={setDate} />
                <MultipleSelector defaultOptions={OPTIONS} value={stationFilters} onChange={(options) => setStationFilters(options)} />
            </div>
        </>
    );
}

export { MapClient };