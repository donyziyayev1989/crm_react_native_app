import axios from 'axios';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MapboxRoute {
  geometry: string;
  distance: number;
  duration: number;
  waypoints: any[];
}

export const MapboxService = {
  /**
   * Geocode a region and district to coordinates
   */
  geocode: async (region: string, district?: string): Promise<Coordinate | null> => {
    try {
      const query = `${district ? district + ', ' : ''}${region}, Uzbekistan`;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
      
      const response = await axios.get(url);
      if (response.data.features && response.data.features.length > 0) {
        const [lng, lat] = response.data.features[0].center;
        return { latitude: lat, longitude: lng };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  },

  /**
   * Get optimized route for multiple coordinates
   */
  getOptimizedRoute: async (coordinates: Coordinate[]): Promise<MapboxRoute | null> => {
    if (coordinates.length < 2) return null;
    if (coordinates.length > 12) {
      // Optimization API limited to 12 coordinates for common plans
      // We might need to split or use Directions API if more, but for now let's use the first 12
      coordinates = coordinates.slice(0, 12);
    }

    try {
      const coordsString = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
      // 'driving-traffic' real vaqtdagi tirbandliklarni hisobga oladi
      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coordsString}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full&steps=true&source=first`;
      
      const response = await axios.get(url);
      if (response.data.trips && response.data.trips.length > 0) {
        const trip = response.data.trips[0];
        return {
          geometry: trip.geometry,
          distance: trip.distance,
          duration: trip.duration,
          waypoints: response.data.waypoints || []
        };
      }
      return null;
    } catch (error) {
      console.error('Optimization error:', error);
      return null;
    }
  },

  /**
   * Calculate distance between two points in km
   */
  getDistance: (p1: Coordinate, p2: Coordinate): number => {
    const R = 6371; // Earth radius in km
    const dLat = (p2.latitude - p1.latitude) * (Math.PI / 180);
    const dLng = (p2.longitude - p1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.latitude * (Math.PI / 180)) *
        Math.cos(p2.latitude * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Get simple directions between points in order
   */
  getDirections: async (coordinates: Coordinate[]): Promise<MapboxRoute | null> => {
    if (coordinates.length < 2) return null;
    
    try {
      const coordsString = coordinates.map(c => `${c.longitude},${c.latitude}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full`;
      
      const response = await axios.get(url);
      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: []
        };
      }
      return null;
    } catch (error) {
      console.error('Directions error:', error);
      return null;
    }
  }
};
