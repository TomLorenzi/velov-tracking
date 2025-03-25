'use client'

import {useEffect, useMemo} from 'react';
import {useMap, useMapsLibrary} from '@vis.gl/react-google-maps';
import { Station, Travel } from '@prisma/client';

type HeatmapProps = {
    radius: number;
    opacity: number;
    travels: Travel[];
    stations: {
        [key: number]: Station;
    }
};

const Heatmap = ({radius, opacity, travels, stations}: HeatmapProps) => {
    const map = useMap();
    const visualization = useMapsLibrary('visualization');

    const heatmap = useMemo(() => {
        if (!visualization) return null;

        return new google.maps.visualization.HeatmapLayer({
            radius: radius,
            opacity: opacity
        });
    }, [visualization, radius, opacity]);

    useEffect(() => {
        if (!heatmap) return;

        const filteredTravels = travels.filter(travel => {
            return travel.stationToNumber !== null
                && travel.stationFromNumber in stations
                && travel.stationToNumber in stations;
        });

        heatmap.setData(
            filteredTravels.map(travel => {
                const startStation = stations[travel.stationFromNumber];
                const endStation = stations[travel.stationToNumber as number];
                const [lat, lng] = startStation.position.split(',').map(parseFloat);

                return {
                    location: new google.maps.LatLng(lat, lng),
                    weight: 1
                };
            })
        );
    }, [heatmap, radius, opacity]);

    useEffect(() => {
        if (!heatmap) return;

        heatmap.setMap(map);

        return () => {
            heatmap.setMap(null);
        };
    }, [heatmap, map]);

    return null;
};

export default Heatmap;