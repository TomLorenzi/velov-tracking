import { MapProvider } from "@/providers/map-provider";
import { MapComponent } from "./components/map";

export default function Map() {
    return (
        <MapProvider>
            <MapComponent />
        </MapProvider>
    )
}