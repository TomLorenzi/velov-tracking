'use client'

import { GoogleMap, Marker } from "@react-google-maps/api";

export const defaultMapContainerStyle = {
    width: '100%',
    height: '80vh',
    borderRadius: '15px 0px 0px 15px',
};

//TODO: replace with real data
const listMarkers = [
    {
        name: '1001 - TERREAUX / TERME',
        position: '45.767736,4.832114',
        address: "Angle rue d'Algérie",
        number: 1001,
    },
    {
        name: '1002 - OPERA',
        position: '45.767611,4.836619',
        address: 'Angle rue Serlin - Angle place de la comédie',
        number: 1002,
    }
];

const MapComponent = () => {
    return (
        <div className="w-full">
            <GoogleMap
                mapContainerStyle={defaultMapContainerStyle}
                center={{ lat: 45.767736, lng: 4.832114 }}
                zoom={14}
                options={{
                    zoomControl: true,
                    tilt: 0,
                    gestureHandling: 'auto',
                    mapTypeId: 'roadmap',
                    mapId: '968ef0460049d91',
                    disableDefaultUI: true,
                }}
            >
                {listMarkers.map((marker, index) => (
                    <Marker
                        position={{
                            lat: parseFloat(marker.position.split(',')[0]),
                            lng: parseFloat(marker.position.split(',')[1])
                        }}
                        key={index}
                        icon={{ 
                            url: 'map/pin.svg',
                            size: new window.google.maps.Size(30, 50),
                            scaledSize: new window.google.maps.Size(30, 50),
                        }}
                    />
                ))}
            </GoogleMap>
        </div>
    )
};

export { MapComponent };