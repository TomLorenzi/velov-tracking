'use client'

import { MapProvider } from "@/providers/map-provider";
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
const MapComponent = dynamic(() => import('./map'), {ssr: false});
import { Station, Travel } from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "./datepicker";
import { fetchTravels } from "../actions";
import MultipleSelector, { Option } from "@/components/ui/multi-select";
import { TimePicker } from "@/components/ui/time-picker";
import { X, Layers, Clock, MapPin, Flame, Home, Route } from "lucide-react";
import Link from "next/link";

interface Props {
    stations: {
        [key: number]: Station;
    };
}

const MapClient = ({ stations }: Props) => {
    const [showStations, setShowStations] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showAllTrips, setShowAllTrips] = useState(false);
    const [timeRangeFilter, setTimeRangeFilter] = useState(false);
    const [travels, setTravels] = useState<Travel[]>([]);
    const [date, setDate] = useState<DateRange | undefined>();
    const [dateTimeStart, setDateTimeStart] = useState<Date | undefined>(new Date(new Date().setHours(8, 0, 0, 0)));
    const [dateTimeEnd, setDateTimeEnd] = useState<Date | undefined>(new Date(new Date().setHours(10, 0, 0, 0)));
    const [stationSelectedNumber, setStationSelectedNumber] = useState<number | null>(null);

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

    const selectedStation = stationSelectedNumber !== null ? stations[stationSelectedNumber] : null;

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {/* Map - full screen */}
            <MapProvider>
                <MapComponent
                    stations={stations}
                    travels={travels}
                    showStations={showStations}
                    showHeatmap={showHeatmap}
                    showAllTrips={showAllTrips}
                    stationFilters={stationFilters}
                    selectedStationNumber={stationSelectedNumber}
                    setStationSelectedNumber={setStationSelectedNumber}
                />
            </MapProvider>

            {/* Top-left: layer toggles */}
            <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
                <Link
                    href="/"
                    className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-3 flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                    <Home className="h-4 w-4" />
                    <span className="text-sm font-medium">Accueil</span>
                </Link>
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="stations"
                            checked={showStations}
                            onCheckedChange={(checked) => setShowStations(checked !== 'indeterminate' ? checked : true)}
                        />
                        <MapPin className="h-4 w-4 text-zinc-500" />
                        <label htmlFor="stations" className="text-sm font-medium cursor-pointer select-none">
                            Stations
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="heatmap"
                            checked={showHeatmap}
                            onCheckedChange={(checked) => setShowHeatmap(checked !== 'indeterminate' ? checked : true)}
                        />
                        <Flame className="h-4 w-4 text-orange-500" />
                        <label htmlFor="heatmap" className="text-sm font-medium cursor-pointer select-none">
                            Heatmap
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="all-trips"
                            checked={showAllTrips}
                            onCheckedChange={(checked) => setShowAllTrips(checked !== 'indeterminate' ? checked : false)}
                        />
                        <Route className="h-4 w-4 text-blue-500" />
                        <label htmlFor="all-trips" className="text-sm font-medium cursor-pointer select-none">
                            Tous les trajets
                        </label>
                    </div>
                </div>
            </div>

            {/* Top-center: filters bar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-3 flex items-center gap-3">
                    <DatePickerWithRange date={date} setDate={setDate} />
                    <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                    <MultipleSelector
                        defaultOptions={OPTIONS}
                        value={stationFilters}
                        onChange={(options) => setStationFilters(options)}
                    />
                </div>
            </div>

            {/* Bottom-left: time range filter */}
            <div className="absolute bottom-4 left-4 z-50">
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-3 flex items-center gap-3">
                    <Checkbox
                        id="time-range-filter"
                        checked={timeRangeFilter}
                        onCheckedChange={(checked) => setTimeRangeFilter(checked !== 'indeterminate' ? checked : true)}
                    />
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <label htmlFor="time-range-filter" className="text-sm font-medium cursor-pointer select-none whitespace-nowrap">
                        Créneau horaire
                    </label>
                    {timeRangeFilter && (
                        <>
                            <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                            <span className="text-xs text-zinc-500">De</span>
                            <TimePicker date={dateTimeStart} setDate={setDateTimeStart} />
                            <span className="text-xs text-zinc-500">à</span>
                            <TimePicker date={dateTimeEnd} setDate={setDateTimeEnd} />
                        </>
                    )}
                </div>
            </div>

            {/* Bottom-right: selected station info */}
            {selectedStation && (
                <div className="absolute bottom-4 right-4 z-50 max-w-xs">
                    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-sm">{selectedStation.name}</h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{selectedStation.address}</p>
                            </div>
                            <button
                                onClick={() => setStationSelectedNumber(null)}
                                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                            <div className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                <span>{selectedStation.totalStands} places</span>
                            </div>
                            <div className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                selectedStation.status === 'OPEN'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                {selectedStation.status === 'OPEN' ? 'Ouverte' : 'Fermée'}
                            </div>
                        </div>
                        {travels.length > 0 && (
                            <p className="text-xs text-zinc-500 mt-2">
                                {travels.filter(t =>
                                    t.stationFromNumber === stationSelectedNumber ||
                                    t.stationToNumber === stationSelectedNumber
                                ).length} trajets liés
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export { MapClient };