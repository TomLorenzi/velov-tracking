export type Status = 'AVAILABLE'
    | 'TRANSFERRED'
    | 'MAINTENANCE'
    | 'DELETED'
    | 'DESTROYED'
    | 'RESERVED'
    | 'AVAILABLE_IN_STOCK'
    | 'RENTED'
    | 'STOLEN'
    | 'TO_BE_REPARED'
    | 'MAINTENANCE_HEAVY'
    | 'SCRAPPED'
    | 'DISMANTLED'
    | 'NOT_RECOGNIZED'
    | 'REGULATION'
    | 'NEW_BIKE_IN_STOCK';

export interface Bike {
    id: string;
    number: number;
    contractName: string;
    type: string;
    status: Status;
    statusLabel: string;
    hasBattery: boolean;
    hasLock: boolean;
    rating: {
        value: number;
        count: number;
        lastRatingDateTime: string;
    };
    checked: boolean;
    createdAt: string;
    updatedAt: string;
    isReserved: boolean;
    stationNumber?: number;
}
