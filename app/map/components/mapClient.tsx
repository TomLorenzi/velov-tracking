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
import { TimePicker } from "@/components/ui/time-picker";

interface Props {
    stations: {
        [key: number]: Station;
    };
}

const MapClient = ({ stations }: Props) => {
    const [showStations, setShowStations] = useState(false);
    const [timeRangeFilter, setTimeRangeFilter] = useState(false);
    const [travels, setTravels] = useState<Travel[]>([]);
    const [date, setDate] = useState<DateRange | undefined>();
    const [dateTimeStart, setDateTimeStart] = useState<Date | undefined>(new Date(new Date().setHours(8, 0, 0, 0)));
    const [dateTimeEnd, setDateTimeEnd] = useState<Date | undefined>(new Date(new Date().setHours(10, 0, 0, 0)));

    const [formattedTimeRange, setFormattedTimeRange] = useState<{start: Date, end: Date} | undefined>(undefined);

    useEffect(() => {
        if (!timeRangeFilter || !dateTimeStart || !dateTimeEnd) {
            return setFormattedTimeRange(undefined);
        }
        const start = new Date(dateTimeStart);
        const end = new Date(dateTimeEnd);
        start.setSeconds(0);
        end.setSeconds(59);
        start.setMilliseconds(0);
        end.setMilliseconds(999);
        setFormattedTimeRange({ start, end });
    }, [timeRangeFilter, dateTimeStart, dateTimeEnd]);

    useEffect(() => {
        getTravels(date, formattedTimeRange);
    }, [date, formattedTimeRange]);

    const getTravels = async (date: DateRange | undefined, formattedTimeRange: {start: Date, end: Date} | undefined ) => {
        const listTravels = await fetchTravels(date, formattedTimeRange);
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
            <div className="px-4 flex space-x-2 items-center">
                <div className="flex space-x-2">
                    <Checkbox id='time-range-filter'
                        onCheckedChange={(checked) => setTimeRangeFilter(checked !== 'indeterminate' ? checked : true)}
                    />
                    <label
                        htmlFor="stations"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Filtrer un créneau horaire
                    </label>
                </div>
                {timeRangeFilter && 
                    <>
                        <span>|</span>
                        <label
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Depuis
                        </label>
                        <TimePicker date={dateTimeStart} setDate={setDateTimeStart} />
                        <label
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Jusqu'à
                        </label>
                        <TimePicker date={dateTimeEnd} setDate={setDateTimeEnd} />
                    </>
                }
            </div>
        </>
    );
}

export { MapClient };