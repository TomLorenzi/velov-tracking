'use client';

import { useJsApiLoader } from '@react-google-maps/api';
import { ReactNode } from 'react';

export function MapProvider({ children }: { children: ReactNode }) {

  const { isLoaded: scriptLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
    mapIds: ['968ef0460049d91']
  });

  if(loadError) return <p>Encountered error while loading google maps</p>

  if(!scriptLoaded) return <p>Map Script is loading ...</p>

  return children;
}