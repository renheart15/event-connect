
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Save, Search, Locate } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GeofenceMapProps {
  eventId: string;
  initialCenter?: [number, number];
  initialRadius?: number;
  onGeofenceUpdate?: (center: [number, number], radius: number) => void;
  showSaveButton?: boolean;
}

const GeofenceMap = ({ 
  eventId, 
  initialCenter = [40.7128, -74.006], 
  initialRadius = 100, 
  onGeofenceUpdate,
  showSaveButton = true // <-- set default to true
}: GeofenceMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const radiusMarker = useRef<L.Marker | null>(null);
  const [center, setCenter] = useState<[number, number]>(initialCenter);
  const [radius, setRadius] = useState(initialRadius);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Check for system-wide dark mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const calculateRadiusMarkerPosition = (centerPos: [number, number], radiusMeters: number): [number, number] => {
    const lat = centerPos[0];
    const lng = centerPos[1];
    
    // Convert radius from meters to degrees (approximate)
    const earthRadius = 6371000; // Earth's radius in meters
    const latRad = lat * Math.PI / 180;
    
    // Calculate longitude offset
    const deltaLng = (radiusMeters / earthRadius) * (180 / Math.PI) / Math.cos(latRad);
    
    return [lat, lng + deltaLng];
  };

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return;

    // Initialize Leaflet map
    map.current = L.map(mapContainer.current).setView(center, 15);

    // Add OpenStreetMap tiles based on theme
    const tileUrl = isDarkMode 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    
    const attribution = isDarkMode
      ? '© OpenStreetMap contributors © CARTO'
      : '© OpenStreetMap contributors';

    L.tileLayer(tileUrl, { attribution }).addTo(map.current);

    // Add initial marker and circle
    addGeofenceElements();

    // Handle click events to update geofence center
    map.current.on('click', (e) => {
      const newCenter: [number, number] = [e.latlng.lat, e.latlng.lng];
      setCenter(newCenter);
      updateGeofenceElements(newCenter, radius);

      if (onGeofenceUpdate) {
        onGeofenceUpdate(newCenter, radius); // Already correct here
      }
    });
  };

  const addGeofenceElements = () => {
    if (!map.current) return;

    // Remove existing elements
    if (marker.current) {
      map.current.removeLayer(marker.current);
    }
    if (circle.current) {
      map.current.removeLayer(circle.current);
    }
    if (radiusMarker.current) {
      map.current.removeLayer(radiusMarker.current);
    }

    // Add center marker
    marker.current = L.marker(center, {
      draggable: true
    }).addTo(map.current);

    // Add geofence circle
    circle.current = L.circle(center, {
      radius: radius,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      color: '#3b82f6',
      weight: 2
    }).addTo(map.current);

    // Add radius marker (for resizing the circle)
    const radiusMarkerPos = calculateRadiusMarkerPosition(center, radius);
    radiusMarker.current = L.marker(radiusMarkerPos, {
      draggable: true,
      icon: L.divIcon({
        className: 'radius-marker',
        html: '<div style="width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; cursor: grab;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }).addTo(map.current);

    // Handle center marker drag
    marker.current.on('dragend', (e) => {
      const newCenter: [number, number] = [e.target.getLatLng().lat, e.target.getLatLng().lng];
      setCenter(newCenter);
      updateGeofenceElements(newCenter, radius);

      if (onGeofenceUpdate) {
        onGeofenceUpdate(newCenter, radius); // <== Ensure parent receives updated center
      }
    });

    // Handle radius marker drag
    radiusMarker.current.on('drag', (e) => {
      if (!circle.current || !marker.current) return;
      
      const radiusMarkerPos = e.target.getLatLng();
      const centerLatLng = marker.current.getLatLng();
      const distance = centerLatLng.distanceTo(radiusMarkerPos);
      const newRadius = Math.round(distance);
      
      // Update circle radius during drag
      circle.current.setRadius(newRadius);
    });

    radiusMarker.current.on('dragend', (e) => {
      if (!radiusMarker.current || !circle.current || !marker.current) return;
      
      const radiusMarkerPos = e.target.getLatLng();
      const centerLatLng = marker.current.getLatLng();
      const distance = centerLatLng.distanceTo(radiusMarkerPos);
      const newRadius = Math.round(distance);
      
      // Update state
      setRadius(newRadius);
      
      // Calculate correct position for radius marker
      const currentCenter: [number, number] = [centerLatLng.lat, centerLatLng.lng];
      const correctRadiusMarkerPos = calculateRadiusMarkerPosition(currentCenter, newRadius);
      radiusMarker.current.setLatLng(correctRadiusMarkerPos);
      
      // Final update to circle
      circle.current.setRadius(newRadius);
      
      // Notify parent component
      if (onGeofenceUpdate) {
        onGeofenceUpdate(currentCenter, newRadius);
      }
    });
  };

  const updateGeofenceElements = (newCenter: [number, number], newRadius: number) => {
    if (!map.current || !circle.current || !marker.current || !radiusMarker.current) return;

    // Update marker position
    marker.current.setLatLng(newCenter);

    // Update circle position and radius
    circle.current.setLatLng(newCenter);
    circle.current.setRadius(newRadius);

    // Update radius marker position with correct calculation
    const radiusMarkerPos = calculateRadiusMarkerPosition(newCenter, newRadius);
    radiusMarker.current.setLatLng(radiusMarkerPos);

    // Center map on new position
    map.current.setView(newCenter);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newCenter: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
        setCenter(newCenter);
        
        if (map.current) {
          map.current.setView(newCenter, 15);
          // Update geofence elements at new location with current radius
          updateGeofenceElements(newCenter, radius);
        }

        if (onGeofenceUpdate) {
          onGeofenceUpdate(newCenter, radius);
        }
        
        toast({
          title: "Location Found",
          description: `Centered map on: ${result.display_name}`,
        });
      } else {
        toast({
          title: "Location Not Found",
          description: "Please try a different search term.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "Unable to search for location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveGeofence = () => {
    if (onGeofenceUpdate) {
      onGeofenceUpdate(center, radius);
    }
    
    toast({
      title: "Location Applied",
      description: `Geofence set with radius of ${radius}m at coordinates ${center[0].toFixed(4)}, ${center[1].toFixed(4)}`,
    });
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setCenter(newCenter);

          if (map.current) {
            map.current.setView(newCenter, 15);
            updateGeofenceElements(newCenter, radius);
          }

          
          if (onGeofenceUpdate) {
            onGeofenceUpdate(newCenter, radius);
          }

          toast({
            title: "Location Set",
            description: "Map centered at your current location",
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Location Error",
            description: "Unable to get your current location. Please check location permissions.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      });
    }
  };



  const handleRadiusChange = (newRadius: number) => {
    const clampedRadius = newRadius;
    setRadius(clampedRadius);
    updateGeofenceElements(center, clampedRadius);
  };

  useEffect(() => {
    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Re-initialize map when theme changes
  useEffect(() => {
    if (map.current) {
      map.current.remove();
      map.current = null;
      setTimeout(initializeMap, 100);
    }
  }, [isDarkMode]);

  // Update elements when center or radius changes
  useEffect(() => {
    if (map.current) {
      updateGeofenceElements(center, radius);
    }
  }, [center, radius]);

  // Listen for system theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    // Check theme on mount and add listener
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Event Geofence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="search">Search Location</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="search"
                    type="text"
                    placeholder="Enter address or location name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button 
                    type="button"
                    onClick={handleSearch} 
                    disabled={isSearching}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={radius}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Coordinates</Label>
                <p className="text-sm text-gray-600 dark:text-gray-300 pt-2">
                  {center[0].toFixed(6)}, {center[1].toFixed(6)}
                </p>
              </div>
            </div>
            
            <div 
              ref={mapContainer} 
              className="w-full h-80 border rounded-lg"
            />
            
            <div className="flex gap-2">
              <Button type="button" onClick={handleUseCurrentLocation} variant="outline" className="flex items-center gap-2">
                <Locate className="w-4 h-4" />
                Use My Location
              </Button>
              {showSaveButton !== false && (
                <Button type="button" onClick={handleSaveGeofence} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Geofence
                </Button>
              )}
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Search for a location above, click on the map, or drag the center marker to set the geofence center. Drag the blue dot on the circle edge to resize the radius (minimum 10m), or adjust it with the input field above.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeofenceMap;
