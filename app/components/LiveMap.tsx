'use client';

import { useEffect, useRef } from 'react';

type Coordinates = { lat: number; lng: number };

type MapPerson = {
  id: string;
  realName: string;
  building: string;
  signal: string;
  lat?: number;
  lng?: number;
  distanceMiles?: number | null;
  isSeed?: boolean;
};

type LiveMapProps = {
  selfLocation: Coordinates | null;
  people: MapPerson[];
  isDiscoverable: boolean;
  onSelectPerson?: (person: MapPerson) => void;
};

function offsetSeed(base: Coordinates, index: number): Coordinates {
  const angle = (index + 1) * 1.4;
  const radius = 0.006 + index * 0.0028;
  return {
    lat: base.lat + Math.cos(angle) * radius,
    lng: base.lng + Math.sin(angle) * radius
  };
}

export default function LiveMap({ selfLocation, people, isDiscoverable, onSelectPerson }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      const leaflet = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      const center = selfLocation || { lat: 39.8283, lng: -98.5795 };
      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true
      }).setView([center.lat, center.lng], selfLocation ? 13 : 4);

      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
      layerRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function draw() {
      if (!mapRef.current || !layerRef.current) return;
      const leaflet = await import('leaflet');
      const layer = layerRef.current;
      layer.clearLayers();

      const center = selfLocation || { lat: 39.8283, lng: -98.5795 };
      mapRef.current.setView([center.lat, center.lng], selfLocation ? 13 : 4, { animate: true });

      if (selfLocation) {
        leaflet.circle([selfLocation.lat, selfLocation.lng], {
          radius: 805,
          color: '#a7ff6b',
          fillColor: '#a7ff6b',
          fillOpacity: 0.08,
          weight: 1
        }).addTo(layer);

        leaflet.circleMarker([selfLocation.lat, selfLocation.lng], {
          radius: 12,
          color: '#050607',
          fillColor: isDiscoverable ? '#a7ff6b' : '#f7f7f2',
          fillOpacity: 1,
          weight: 3
        })
          .bindPopup(`<strong>You</strong><br />${isDiscoverable ? 'Discoverable' : 'Private'}`)
          .addTo(layer);
      }

      people.slice(0, 20).forEach((person, index) => {
        const coords = person.lat && person.lng ? { lat: person.lat, lng: person.lng } : offsetSeed(center, index);
        const marker = leaflet.circleMarker([coords.lat, coords.lng], {
          radius: person.isSeed ? 8 : 10,
          color: person.isSeed ? '#ffe08a' : '#a7ff6b',
          fillColor: person.isSeed ? '#ffe08a' : '#a7ff6b',
          fillOpacity: 0.9,
          weight: 2
        });

        marker
          .bindPopup(`<strong>${person.realName}</strong><br />${person.signal}<br />${person.building}`)
          .on('click', () => onSelectPerson?.(person))
          .addTo(layer);
      });
    }

    void draw();
  }, [selfLocation, people, isDiscoverable, onSelectPerson]);

  return <div ref={containerRef} className='liveMapCanvas' aria-label='Norm live map' />;
}
