import { Coordinates } from '../types';

export const getDeviceLocation = (
  onSuccess: (coords: Coordinates) => void,
  onError: () => void
) => {
  if (!navigator.geolocation) {
    onError();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({ lat: position.coords.latitude, lng: position.coords.longitude });
    },
    (error) => {
      console.error(error);
      onError();
    }
  );
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    // Using OpenStreetMap Nominatim (Free, requires User-Agent)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'ChowkarApp/1.0' } }
    );
    const data = await response.json();

    // Construct a simpler address if possible, or use display_name
    // display_name is usually very long. 
    // Ideally: Road, Suburb, City
    if (data.address) {
      const parts = [];
      if (data.address.road) parts.push(data.address.road);
      if (data.address.suburb) parts.push(data.address.suburb);
      if (data.address.city || data.address.town || data.address.village) parts.push(data.address.city || data.address.town || data.address.village);

      if (parts.length > 0) return parts.join(', ');
    }

    return data.display_name || null;
  } catch (error) {
    console.error("Geocoding failed", error);
    return null;
  }
};