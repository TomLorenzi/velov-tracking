import { Station, Travel } from "@prisma/client";
import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import Heatmap from "./heatmap";
import { Option } from "@/components/ui/multi-select";
import {DeckGL} from '@deck.gl/react';
import {limitTiltRange} from '@vis.gl/react-google-maps';
import { MapViewState } from "@deck.gl/core";
import {ArcLayer} from '@deck.gl/layers';

interface Props {
    stations: {
        [key: number]: Station;
    };
    travels: Travel[];
    showStations: boolean;
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
    stationFilters,
    selectedStationNumber,
    setStationSelectedNumber
}: Props) {
    const arcData: any[] = [];

    if (selectedStationNumber !== null) {
        for (const travel of travels) {
            const startStation = stations[travel.stationFromNumber];
            const endStation = stations[travel.stationToNumber as number];
            if (![travel.startDateTime, travel.stationToNumber].includes(selectedStationNumber)) {
                continue;
            }
            const [startLat, startLng] = startStation.position.split(',').map(parseFloat);
            const [endLat, endLng] = endStation.position.split(',').map(parseFloat);
            arcData.push({
                from: {
                    coordinates: [startLng, startLat]
                },
                to: {
                    coordinates: [endLng, endLat]
                }
            });
        }
    }

    const arcLayer = new ArcLayer({
        id: 'ArcLayer',
        data: arcData,
        getSourceColor: [0, 128, 255],
        getTargetColor: [255, 0, 0],
        getSourcePosition: d => d.from.coordinates,
        getTargetPosition: d => d.to.coordinates,
        getWidth: 1,
    });

    const layers = [arcLayer];

    return (
        <DeckGL
            style={{width: '100vw', height: '80vh', position: 'relative', pointerEvents: 'none'}}
            initialViewState={INITIAL_VIEW_STATE}
            layers={layers}
            controller={true}
            onViewStateChange={limitTiltRange}
        >
            <Map
                disableDefaultUI={true}
                defaultZoom={14}
                defaultCenter={{ lat: 45.767736, lng: 4.832114 }}
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
            >
                {showStations && Object.values(stations).map((station, index) => (
                    <AdvancedMarker
                        position={{
                            lat: parseFloat(station.position.split(',')[0]),
                            lng: parseFloat(station.position.split(',')[1])
                        }}
                        key={index}
                        clickable
                        onClick={() => setStationSelectedNumber(station.number)}
                    >
                        <img src="/map/pin.svg" alt="Pin" width={15} height={25} />
                    </AdvancedMarker>
                ))}
                <Heatmap radius={30} opacity={0.6} travels={travels} stations={stations} stationFilters={stationFilters} />
            </Map>
        </DeckGL>
    )
};