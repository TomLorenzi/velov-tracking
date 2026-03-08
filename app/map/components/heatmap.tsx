'use client'

import {useEffect, useMemo, useRef} from 'react';
import {useMap, useMapsLibrary} from '@vis.gl/react-google-maps';
import { Station } from '@prisma/client';
import { TravelSummary } from '../actions';
import { Option } from '@/components/ui/multi-select';

type HeatmapProps = {
    radius: number;
    opacity: number;
    travels: TravelSummary[];
    stations: {
        [key: number]: Station;
    };
    stationFilters: Option[];
};

/** Pre-parse station positions once to avoid repeated split/parseFloat */
function parseStationCoords(stations: { [key: number]: Station }) {
    const coords: Record<number, { lat: number; lng: number }> = {};
    for (const key in stations) {
        const [lat, lng] = stations[key].position.split(',').map(parseFloat);
        coords[key] = { lat, lng };
    }
    return coords;
}

const Heatmap = ({radius, opacity, travels, stations, stationFilters}: HeatmapProps) => {
    const map = useMap();
    const visualization = useMapsLibrary('visualization');
    const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

    // Pre-compute station coordinates
    const stationCoords = useMemo(() => parseStationCoords(stations), [stations]);

    // Create heatmap layer once, update properties separately
    useEffect(() => {
        if (!visualization) return;
        if (!heatmapRef.current) {
            heatmapRef.current = new google.maps.visualization.HeatmapLayer({
                radius,
                opacity,
            });
        } else {
            heatmapRef.current.set('radius', radius);
            heatmapRef.current.set('opacity', opacity);
        }
    }, [visualization, radius, opacity]);

    // Aggregate heatmap points by location to reduce data size
    const heatmapData = useMemo(() => {
        if (!visualization) return [];

        const showFrom = stationFilters.length !== 1 || stationFilters[0].value === 'stationFrom';
        const showTo = stationFilters.length !== 1 || stationFilters[0].value === 'stationTo';

        // Aggregate weights per station to avoid duplicate LatLng objects
        const weightMap = new Map<number, number>();

        for (const travel of travels) {
            if (travel.stationToNumber === null) continue;
            if (!(travel.stationFromNumber in stationCoords) || !(travel.stationToNumber in stationCoords)) continue;

            if (showFrom) {
                weightMap.set(travel.stationFromNumber, (weightMap.get(travel.stationFromNumber) ?? 0) + 1);
            }
            if (showTo) {
                weightMap.set(travel.stationToNumber, (weightMap.get(travel.stationToNumber) ?? 0) + 1);
            }
        }

        const points: google.maps.visualization.WeightedLocation[] = [];
        for (const [stationNum, weight] of weightMap) {
            const c = stationCoords[stationNum];
            if (!c) continue;
            points.push({
                location: new google.maps.LatLng(c.lat, c.lng),
                weight,
            });
        }
        return points;
    }, [visualization, travels, stationFilters, stationCoords]);

    // Apply data to heatmap
    useEffect(() => {
        if (!heatmapRef.current) return;
        heatmapRef.current.setData(heatmapData);
    }, [heatmapData]);

    useEffect(() => {
        if (!heatmapRef.current) return;

        heatmapRef.current.setMap(map);

        return () => {
            heatmapRef.current?.setMap(null);
        };
    }, [map, visualization]);

    return null;
};

export default Heatmap;