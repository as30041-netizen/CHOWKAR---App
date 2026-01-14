import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Ensure CSS is imported

interface LeafletMapProps {
  lat: number;
  lng: number;
  popupText?: string;
  editable?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  height?: string;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  lat,
  lng,
  popupText,
  editable = false,
  onLocationSelect,
  height = "h-48"
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Default icon fix for Leaflet
  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map
      // If 0,0 provided, zoom out to world view, else zoom in
      const initZoom = (lat === 0 && lng === 0) ? 2 : 15;

      mapInstanceRef.current = L.map(mapRef.current).setView([lat, lng], initZoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);

      // Add Marker
      markerRef.current = L.marker([lat, lng], {
        icon,
        draggable: editable
      }).addTo(mapInstanceRef.current);

      if (popupText) {
        markerRef.current.bindPopup(popupText).openPopup();
      }

      // --- Event Listeners ---

      // 1. Drag End (Marker moved)
      markerRef.current.on('dragend', function (event) {
        const marker = event.target;
        const position = marker.getLatLng();
        if (onLocationSelect) {
          onLocationSelect(position.lat, position.lng);
        }
      });

      // 2. Map Click (Move marker to click)
      if (editable) {
        mapInstanceRef.current.on('click', function (e) {
          const { lat, lng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          }
          if (onLocationSelect) {
            onLocationSelect(lat, lng);
          }
        });
      }

    } else {
      // Update view if props change
      // Only verify movement if significant (to allow small drag adjustments without jitter)
      mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom());
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        if (editable) {
          markerRef.current.dragging.enable();
        } else {
          markerRef.current.dragging.disable();
        }
        // Update popup if text changed
        if (popupText) {
          markerRef.current.setPopupContent(popupText);
          // Only open popup if not editing (annoying while dragging)
          if (!editable) markerRef.current.openPopup();
        }
      }
    }

    // Cleanup not needed for singleton ref usually, but good practice if unmounting
    return () => {
      // We keep the map instance alive if typically re-rendering, 
      // but if the component unmounts fully we should remove.
      // For React strict mode, we might want to actually cleanup:
      // mapInstanceRef.current?.remove();
      // mapInstanceRef.current = null;
    };
  }, [lat, lng, popupText, editable]);

  return <div ref={mapRef} className={`w-full ${height} z-0 rounded-lg overflow-hidden`} />;
};