import { Station, Travel } from "@prisma/client";
import { Map } from "@vis.gl/react-google-maps";
import Heatmap from "./heatmap";
import { Option } from "@/components/ui/multi-select";
import {DeckGL} from '@deck.gl/react';
import {limitTiltRange} from '@vis.gl/react-google-maps';
import { MapViewState, PickingInfo } from "@deck.gl/core";
import {IconLayer} from '@deck.gl/layers';
import {TripsLayer} from '@deck.gl/geo-layers';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Props {
    stations: {
        [key: number]: Station;
    };
    travels: Travel[];
    showStations: boolean;
    showHeatmap: boolean;
    stationFilters: Option[];
    selectedStationNumber: number | null;
    setStationSelectedNumber: (number: number | null) => void;
}

const INITIAL_VIEW_STATE: MapViewState = {
    longitude: 4.832114,
    latitude: 45.767736,
    zoom: 14
};

export default function MapComponent({
    stations,
    travels,
    showStations,
    showHeatmap,
    stationFilters,
    selectedStationNumber,
    setStationSelectedNumber
}: Props) {
    const tripsData = useMemo(() => {
        if (selectedStationNumber === null) return [];
        const data: { path: [number, number][]; timestamps: number[] }[] = [];
        for (const travel of travels) {
            const startStation = stations[travel.stationFromNumber];
            const endStation = stations[travel.stationToNumber as number];
            if (![travel.stationFromNumber, travel.stationToNumber].includes(selectedStationNumber)) {
                continue;
            }
            if (!startStation || !endStation) continue;
            const [startLat, startLng] = startStation.position.split(',').map(parseFloat);
            const [endLat, endLng] = endStation.position.split(',').map(parseFloat);
            // Create intermediate points for a smoother path
            const midLng = (startLng + endLng) / 2;
            const midLat = (startLat + endLat) / 2;
            data.push({
                path: [
                    [startLng, startLat],
                    [midLng, midLat],
                    [endLng, endLat],
                ],
                timestamps: [0, 50, 100],
            });
        }
        return data;
    }, [selectedStationNumber, travels, stations]);

    // Animation loop for TripsLayer
    const [currentTime, setCurrentTime] = useState(0);
    const animationRef = useRef<number>(0);
    const LOOP_LENGTH = 100;
    const ANIMATION_SPEED = 1;

    useEffect(() => {
        if (tripsData.length === 0) return;
        let startTimestamp: number;
        const animate = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;
            setCurrentTime((elapsed * ANIMATION_SPEED * 0.06) % LOOP_LENGTH);
            animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
    }, [tripsData]);

    const handleClick = useCallback((info: PickingInfo) => {
        if (info.object) {
            setStationSelectedNumber((info.object as Station).number);
        } else {
            setStationSelectedNumber(null);
        }
    }, [setStationSelectedNumber]);

    const getCursor = useCallback(({isHovering}: {isHovering: boolean}) => {
        return isHovering ? 'pointer' : 'grab';
    }, []);

    const layers = useMemo(() => {
        const result = [];

        const tripsLayer = new TripsLayer({
            id: 'TripsLayer',
            data: tripsData,
            getPath: (d: { path: [number, number][] }) => d.path,
            getTimestamps: (d: { timestamps: number[] }) => d.timestamps,
            getColor: [253, 128, 93],
            getWidth: 6,
            trailLength: 60,
            currentTime,
            shadowEnabled: false,
        });
        result.push(tripsLayer);

        if (showStations) {
            const stationLayer = new IconLayer({
                id: 'IconLayer',
                data: Object.values(stations),
                getPosition: (d: Station) => [parseFloat(d.position.split(',')[1]), parseFloat(d.position.split(',')[0])],
                getIcon: () => ({
                    url: './map/pin.svg',
                    width: 64,
                    height: 64,
                }),
                getSize: 30,
                pickable: true,
            });
            result.push(stationLayer);
        }

        return result;
    }, [stations, tripsData, showStations, currentTime]);

    return (
        <DeckGL
            style={{width: '100%', height: '100%', position: 'absolute', inset: '0'}}
            initialViewState={INITIAL_VIEW_STATE}
            layers={layers}
            controller={true}
            onViewStateChange={limitTiltRange}
            onClick={handleClick}
            getCursor={getCursor}
        >
            <Map
                disableDefaultUI={true}
                defaultZoom={14}
                defaultCenter={{ lat: 45.767736, lng: 4.832114 }}
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
            >
                {showHeatmap && (
                    <Heatmap radius={30} opacity={0.6} travels={travels} stations={stations} stationFilters={stationFilters} />
                )}
            </Map>
        </DeckGL>
    )
};