import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface LeafletMapProps {
  lat: number;
  lng: number;
  popupText?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({ lat, lng, popupText }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default icon fix for Leaflet with CDN
    const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    if (!mapInstanceRef.current) {
        // Initialize map
        mapInstanceRef.current = L.map(mapRef.current).setView([lat, lng], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstanceRef.current);
        
        L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current)
            .bindPopup(popupText || "Job Location")
            .openPopup();
    } else {
        // Update view if props change (though typically this component re-mounts in modal)
        mapInstanceRef.current.setView([lat, lng], 13);
    }

    // Cleanup
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, [lat, lng, popupText]);

  return <div ref={mapRef} className="w-full h-full z-0" />;
};