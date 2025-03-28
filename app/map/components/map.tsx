import { Station, Travel } from "@prisma/client";
import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import Heatmap from "./heatmap";

export const defaultMapContainerStyle = {
    width: '100%',
    height: '80vh',
    borderRadius: '1em',
};

interface Props {
    stations: {
        [key: number]: Station;
    };
    travels: Travel[];
    showStations: boolean;
}

const MapComponent = ({ stations, travels, showStations }: Props) => {
    return (
        <Map
            style={{width: '100vw', height: '80vh'}}
            defaultCenter={{ lat: 45.767736, lng: 4.832114 }}
            defaultZoom={14}
            disableDefaultUI={true}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
        >
            {showStations && Object.values(stations).map((station, index) => (
                <AdvancedMarker
                    position={{
                        lat: parseFloat(station.position.split(',')[0]),
                        lng: parseFloat(station.position.split(',')[1])
                    }}
                    key={index}
                >
                    <img src="/map/pin.svg" alt="Pin" width={15} height={25} />
                </AdvancedMarker>
            ))}
            <Heatmap radius={40} opacity={0.6} travels={travels} stations={stations} />
        </Map>
    )
};

export { MapComponent };