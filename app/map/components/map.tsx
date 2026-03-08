import { Station } from "@prisma/client";
import { TravelSummary } from "../actions";
import { Map } from "@vis.gl/react-google-maps";
import Heatmap from "./heatmap";
import { Option } from "@/components/ui/multi-select";
import {DeckGL} from '@deck.gl/react';
import {limitTiltRange} from '@vis.gl/react-google-maps';
import { MapViewState, PickingInfo } from "@deck.gl/core";
import {IconLayer} from '@deck.gl/layers';
import {TripsLayer} from '@deck.gl/geo-layers';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DECK_STYLE = {width: '100%', height: '100%', position: 'absolute' as const, inset: '0'};

interface ParsedCoords {
    lat: number;
    lng: number;
}

interface Props {
    stations: {
        [key: number]: Station;
    };
    travels: TravelSummary[];
    showStations: boolean;
    showHeatmap: boolean;
    showAllTrips: boolean;
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
    showAllTrips,
    stationFilters,
    selectedStationNumber,
    setStationSelectedNumber
}: Props) {
    // Workaround for luma.gl bug in @luma.gl/core 9.x:
    // CanvasContext's ResizeObserver fires during WebGLDevice construction,
    // before device.limits is populated (createDevice is async).
    // We patch ResizeObserver to swallow that initial error; deck.gl will
    // handle the resize properly once the device finishes initialising.
    const [deckReady, setDeckReady] = useState(false);
    useEffect(() => {
        const OriginalRO = window.ResizeObserver;
        window.ResizeObserver = class SafeResizeObserver extends OriginalRO {
            constructor(callback: ResizeObserverCallback) {
                super((entries, observer) => {
                    try {
                        callback(entries, observer);
                    } catch {
                        // Silently ignored — luma.gl will resize once the device is ready
                    }
                });
            }
        };
        setDeckReady(true);
        return () => {
            window.ResizeObserver = OriginalRO;
        };
    }, []);

    // Pre-compute station coordinates once to avoid repeated split/parseFloat
    const stationCoords = useMemo(() => {
        const coords: Record<number, ParsedCoords> = {};
        for (const key in stations) {
            const [lat, lng] = stations[key].position.split(',').map(parseFloat);
            coords[key] = { lat, lng };
        }
        return coords;
    }, [stations]);

    const tripsData = useMemo(() => {
        if (!showAllTrips && selectedStationNumber === null) return [];

        // Aggregate trips by route (station pair) to count occurrences
        const routeMap: Record<string, { from: number; to: number; count: number }> = {};
        for (const travel of travels) {
            if (!showAllTrips && ![travel.stationFromNumber, travel.stationToNumber].includes(selectedStationNumber!)) {
                continue;
            }
            const key = `${travel.stationFromNumber}->${travel.stationToNumber}`;
            if (routeMap[key]) {
                routeMap[key].count++;
            } else {
                routeMap[key] = { from: travel.stationFromNumber, to: travel.stationToNumber as number, count: 1 };
            }
        }

        const routes = Object.values(routeMap);
        const maxCount = Math.max(1, ...routes.map(r => r.count));

        const data: { path: [number, number][]; timestamps: number[]; count: number; maxCount: number }[] = [];
        for (const route of routes) {
            const startCoord = stationCoords[route.from];
            const endCoord = stationCoords[route.to];
            if (!startCoord || !endCoord) continue;
            const midLng = (startCoord.lng + endCoord.lng) / 2;
            const midLat = (startCoord.lat + endCoord.lat) / 2;
            data.push({
                path: [
                    [startCoord.lng, startCoord.lat],
                    [midLng, midLat],
                    [endCoord.lng, endCoord.lat],
                ],
                timestamps: [0, 50, 100],
                count: route.count,
                maxCount,
            });
        }
        return data;
    }, [selectedStationNumber, showAllTrips, travels, stationCoords]);

    // Animation loop for TripsLayer
    const [currentTime, setCurrentTime] = useState(0);
    const animationRef = useRef<number>(0);
    const LOOP_LENGTH = 100;
    const ANIMATION_SPEED = showAllTrips ? 0.3 : 1;

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
    }, [tripsData, ANIMATION_SPEED]);

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
            getPath: (d: { path: [number, number][]; count: number }) => d.path,
            getTimestamps: (d: { timestamps: number[]; count: number }) => d.timestamps,
            // Color gradient: low count = yellow [255,255,100], high count = red [253,50,30]
            getColor: (d: { count: number; maxCount: number }) => {
                const t = d.maxCount > 1 ? (d.count - 1) / (d.maxCount - 1) : 0;
                return [253, Math.round(255 - 205 * t), Math.round(100 - 70 * t)];
            },
            // Width: 2px min for 1 trip, up to 12px for the most frequent route
            getWidth: (d: { count: number; maxCount: number }) => {
                const t = d.maxCount > 1 ? (d.count - 1) / (d.maxCount - 1) : 0;
                return 2 + 10 * t;
            },
            trailLength: showAllTrips ? 10 : 60,
            currentTime,
            shadowEnabled: false,
            widthUnits: 'pixels' as const,
        });
        result.push(tripsLayer);

        if (showStations) {
            const stationLayer = new IconLayer({
                id: 'IconLayer',
                data: Object.values(stations),
                getPosition: (d: Station) => {
                    const c = stationCoords[d.number];
                    return c ? [c.lng, c.lat] : [0, 0];
                },
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
    }, [stations, stationCoords, tripsData, showStations, currentTime, showAllTrips]);

    if (!deckReady) {
        return <div style={DECK_STYLE} />;
    }

    return (
        <DeckGL
            style={DECK_STYLE}
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