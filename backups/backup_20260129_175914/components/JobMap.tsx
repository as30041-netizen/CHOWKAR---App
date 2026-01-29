import React from 'react';
import { LeafletMap } from './LeafletMap';
import { Job, UserRole } from '../types';
import { MapPin, ArrowRight } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface JobMapProps {
    jobs: Job[];
    onJobClick: (job: Job) => void;
    userLocation?: { lat: number; lng: number };
}

export const JobMap: React.FC<JobMapProps> = ({ jobs, onJobClick, userLocation }) => {
    // Custom logic to render multiple markers
    // Since our basic LeafletMap is designed for single marker/editing, 
    // we need a slightly more specialized component for the feed.
    // However, to keep it DRY, I will create a new specialized component here 
    // instead of hacking the generic one.

    // We actually need a full component because generic LeafletMap takes single lat/lng.

    return (
        <div className="w-full h-[60vh] rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-gray-800 shadow-glass relative z-0">
            <FeedMapInternal jobs={jobs} onJobClick={onJobClick} userLocation={userLocation} />
        </div>
    );
};

// Internal component to handle Leaflet instance
const FeedMapInternal: React.FC<JobMapProps> = ({ jobs, onJobClick, userLocation }) => {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const mapInstance = React.useRef<L.Map | null>(null);
    const markersRef = React.useRef<L.Marker[]>([]);

    React.useEffect(() => {
        if (!mapRef.current) return;

        // Init Map
        if (!mapInstance.current) {
            const centerLat = userLocation?.lat || 20.5937;
            const centerLng = userLocation?.lng || 78.9629;
            const zoom = userLocation ? 13 : 5;

            mapInstance.current = L.map(mapRef.current).setView([centerLat, centerLng], zoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance.current);
        }

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // Add User Location Marker (Blue Dot)
        if (userLocation) {
            const userIcon = L.divIcon({
                className: 'custom-user-marker',
                html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            const m = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
                .addTo(mapInstance.current!)
                .bindPopup("You are here");
            markersRef.current.push(m);
        }

        // Add Job Markers
        const jobIcon = L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });

        jobs.forEach(job => {
            if (job.coordinates) {

                // Create a custom popup content
                const popupContent = document.createElement('div');
                popupContent.innerHTML = `
                    <div class="p-2 min-w-[200px]">
                        <h3 class="font-bold text-sm mb-1 line-clamp-1">${job.title}</h3>
                        <p class="text-xs text-gray-500 mb-2 truncate">₹${job.budget} • ${job.duration}</p>
                        <button id="btn-${job.id}" class="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors">
                            View Details
                        </button>
                    </div>
                `;

                const marker = L.marker([job.coordinates.lat, job.coordinates.lng], { icon: jobIcon })
                    .addTo(mapInstance.current!)
                    .bindPopup(popupContent);

                // Add event listener for the button inside popup
                marker.on('popupopen', () => {
                    const btn = document.getElementById(`btn-${job.id}`);
                    if (btn) {
                        btn.onclick = () => onJobClick(job);
                    }
                });

                markersRef.current.push(marker);
            }
        });

    }, [jobs, userLocation]); // Re-render when jobs change

    return <div ref={mapRef} className="w-full h-full" />;
};
