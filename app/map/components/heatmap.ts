import { TravelSummary } from '../actions';
import { Option } from '@/components/ui/multi-select';

export interface HeatmapPoint {
    position: [number, number];
    weight: number;
}

/**
 * Aggregate travels into one weighted point per station, for deck.gl's HeatmapLayer.
 * (Google's visualization.HeatmapLayer was removed in Maps JS API 3.65.)
 */
export function computeHeatmapPoints(
    travels: TravelSummary[],
    stationCoords: Record<number, { lat: number; lng: number }>,
    stationFilters: Option[]
): HeatmapPoint[] {
    const showFrom = stationFilters.length !== 1 || stationFilters[0].value === 'stationFrom';
    const showTo = stationFilters.length !== 1 || stationFilters[0].value === 'stationTo';

    // Aggregate weights per station to keep the layer data small
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

    const points: HeatmapPoint[] = [];
    for (const [stationNum, weight] of weightMap) {
        const c = stationCoords[stationNum];
        if (!c) continue;
        points.push({ position: [c.lng, c.lat], weight });
    }
    return points;
}
