import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { MAP_CENTER, MAP_ZOOM, MAP_TILES } from '../../lib/constants';

interface MapContainerProps {
  onMapReady: (map: maplibregl.Map) => void;
  children?: React.ReactNode;
  className?: string;
}

function getTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export default function MapContainer({ onMapReady, children, className = '' }: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const theme = getTheme();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_TILES[theme],
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      // Force resize after layout settles
      requestAnimationFrame(() => {
        map.resize();
        requestAnimationFrame(() => map.resize());
      });
      setReady(true);
      onMapReady(map);
    });

    // Resize when container changes dimensions
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    // Theme change listener
    const observer = new MutationObserver(() => {
      const newTheme = getTheme();
      const center = map.getCenter();
      const zoom = map.getZoom();
      map.setStyle(MAP_TILES[newTheme]);
      map.once('idle', () => {
        map.setCenter(center);
        map.setZoom(zoom);
        // Re-trigger onMapReady so layers get re-added after style change
        onMapReady(map);
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      resizeObserver.disconnect();
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative flex-1 min-h-0 ${className}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {ready && children}
    </div>
  );
}
