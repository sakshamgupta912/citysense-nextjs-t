"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleMap, HeatmapLayer, Marker, Circle, MarkerClustererF } from '@react-google-maps/api';
import { getFirestore, collection, getDocs, Firestore, query, where, orderBy, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { app } from '@/firebase';
import * as geofire from 'geofire-common';
import { getJitteredPositions } from '@/utils/jitter';
import Spinner from './Spinner';
// import { Loader } from '@googlemaps/js-api-loader';
import getLoader from '@/utils/loadGoogleMaps';
// --- Component Interfaces ---
interface Report {
  id: string;
  issueId: string;
  summary: string;
  imageUrl?: string;
  lat: number;
  lng: number;
  addedAt: Date;
  parentHeatScore: number;
  category: string;
}

interface Issue {
  id: string;
  location: { lat: number; lng: number };
  normalizedHeatScore: number;
  category: string;
  reports?: Report[];
  credibility?: number;
  status?: string;
  geohash?: string;
}

interface MapProps {
  height?: string;
}

// --- Constants ---
const HEATMAP_ZOOM_THRESHOLD = 16;
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
const FETCH_RADIUS_MULTIPLIER = 1000;
const MIN_CREDIBILITY = 0.5;
const USER_LOCATION_ZOOM = 18;
const INITIAL_ZOOM_WITH_LOCATION = 14;
const INITIAL_ZOOM_DEFAULT = 12;

const libraries: ("visualization" | "marker")[] = ["visualization"];

const categoryStyles = {
  sanitation: { name: 'Sanitation', color: '#8B4513', emoji: '🗑️' },
  road_damage: { name: 'Road Damage', color: '#708090', emoji: '🚧' },
  traffic: { name: 'Traffic', color: '#FF4500', emoji: '🚦' },
  water: { name: 'Water', color: '#1E90FF', emoji: '💧' },
  lighting: { name: 'Lighting', color: '#FFD700', emoji: '💡' },
  weather: { name: 'Weather', color: '#4682B4', emoji: '☁️' },
  event: { name: 'Event', color: '#FF69B4', emoji: '🎉' },
  safety: { name: 'Safety', color: '#DC143C', emoji: '🛡️' },
  other: { name: 'Other', color: '#B0B0B0', emoji: '❓' },
  default: { name: 'Other', color: '#B0B0B0', emoji: '❓' },
} as const;

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
};

const heatmapOptions = {
  radius: 25,
  opacity: 0.8,
  maxIntensity: 1,
  dissipating: true,
  gradient: [
    "rgba(54, 212, 206, 0)",
    "rgba(54, 212, 206, 1)",
    "rgba(122, 225, 172, 1)",
    "rgba(255, 225, 107, 1)",
    "rgba(255, 150, 77, 1)",
    "rgba(255, 82, 82, 1)",
  ],
};

// --- Memoized SVG Marker Icon Generator ---
const markerIconCache = new Map<string, string>();

const getMarkerIcon = (category: string): string => {
  if (markerIconCache.has(category)) {
    return markerIconCache.get(category)!;
  }

  const style = categoryStyles[category as keyof typeof categoryStyles] || categoryStyles.default;
  const svg = `
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 0C10.178 0 3 7.178 3 16.001C3 24.824 16.668 37.118 19 38C21.332 37.118 35 24.824 35 16.001C35 7.178 27.822 0 19 0Z" fill="${style.color}" stroke="#FFFFFF" stroke-width="2"/>
      <foreignObject x="10" y="8" width="18" height="18">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1;">${style.emoji}</div>
      </foreignObject>
    </svg>
  `;
  
  const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  markerIconCache.set(category, dataUri);
  return dataUri;
};

// --- Custom Hooks ---
const useUserLocation = () => {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [initialZoom, setInitialZoom] = useState(INITIAL_ZOOM_DEFAULT);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      const location = { lat: latitude, lng: longitude, accuracy };
       console.log('[useUserLocation] User location:', location);
      setUserLocation(location);
      setMapCenter({ lat: latitude, lng: longitude });
      setInitialZoom(INITIAL_ZOOM_WITH_LOCATION);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn("Error getting user location:", error.message);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      timeout: 10000,
      maximumAge: 300000,
    });
  }, []);

  return { userLocation, mapCenter, initialZoom };
};

// --- Optimized Components ---
const CategoryLegend = React.memo<{ selectedCategories: Set<string> }>(({ selectedCategories }) => (
  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-2xl border border-gray-200/50 max-w-xs">
    <h3 className="text-base font-bold mb-2 text-gray-800 flex items-center gap-2">
      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
      Legend
    </h3>
    <div className="grid grid-cols-2 gap-1 text-xs">
      {Object.entries(categoryStyles).map(([key, style]) => {
        if (key === 'default') return null;
        const isActive = selectedCategories.has(key.toLowerCase());
        return (
          <div 
            key={key} 
            className={`flex items-center group hover:bg-gray-50 p-1.5 rounded-md transition-all duration-200 ${
              !isActive ? 'opacity-40' : ''
            }`}
          >
            <span className="text-sm mr-2 group-hover:scale-110 transition-transform duration-200">{style.emoji}</span>
            <span className="text-xs font-medium text-gray-700 truncate">{style.name}</span>
          </div>
        );
      })}
    </div>
  </div>
));

CategoryLegend.displayName = 'CategoryLegend';

const CategoryFilter = React.memo<{
  selectedCategories: Set<string>;
  onCategoryChange: (category: string) => void;
  isVisible: boolean;
  onToggle: () => void;
 }>(({ selectedCategories, onCategoryChange, isVisible, onToggle }) => {
  const handleSelectAll = useCallback(() => {
    Object.keys(categoryStyles).forEach(key => {
      if (key !== 'default' && !selectedCategories.has(key.toLowerCase())) {
        onCategoryChange(key);
      }
    });
  }, [selectedCategories, onCategoryChange]);

  const handleSelectNone = useCallback(() => {
    const allCategories = Object.keys(categoryStyles).filter(key => key !== 'default');
    allCategories.forEach(key => {
      if (selectedCategories.has(key.toLowerCase())) {
        onCategoryChange(key);
      }
    });
  }, [selectedCategories, onCategoryChange]);

  return (
    <div className="absolute top-16 right-2 z-10">
      <button
        onClick={onToggle}
        className="bg-white/90 backdrop-blur-md text-gray-800 px-3 py-2 rounded-xl shadow-lg hover:shadow-xl hover:bg-white transition-all duration-300 flex items-center gap-2 border border-gray-200/50 group text-sm"
      >
        <span className="text-base group-hover:scale-110 transition-transform duration-200">🔍</span>
        <span className="font-medium hidden sm:inline">Filter</span>
        <span className={`transform transition-transform duration-200 text-xs ${isVisible ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isVisible && (
        <div className="absolute top-12 right-0 bg-white/95 backdrop-blur-lg p-4 rounded-xl shadow-2xl w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto border border-gray-200/50 animate-in slide-in-from-top-2 duration-300">
          <h3 className="text-lg font-bold mb-3 text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Filter Categories
          </h3>
          <div className="space-y-1">
            {Object.entries(categoryStyles).map(([key, style]) => {
              if (key === 'default') return null;
              const isChecked = selectedCategories.has(key.toLowerCase());
              return (
                <label key={key} className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all duration-200 group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onCategoryChange(key)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${
                      isChecked 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300 group-hover:border-blue-300'
                    }`}>
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white m-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-lg mx-2 group-hover:scale-110 transition-transform duration-200">{style.emoji}</span>
                  <span className="text-sm font-medium text-gray-700">{style.name}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
            <button
              onClick={handleSelectAll}
              className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-all duration-200"
            >
              All
            </button>
            <button
              onClick={handleSelectNone}
              className="flex-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-all duration-200"
            >
              None
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

CategoryFilter.displayName = 'CategoryFilter';

// --- Main Map Component ---
const MapComponent: React.FC<MapProps> = ({  height = "100vh" }) => {
  // --- State Management ---
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [currentZoom, setCurrentZoom] = useState(INITIAL_ZOOM_DEFAULT);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(Object.keys(categoryStyles).filter(key => key !== 'default').map(k => k.toLowerCase()))
  );
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // --- Refs ---
  const mapRef = useRef<google.maps.Map | null>(null);
  const isFetching = useRef(false);
  const fetchedGeoBounds = useRef(new Set<string>());
  const processedIssueIds = useRef(new Set<string>());
  const initialFetchTriggered = useRef(false);

  const containerStyle = {
    width: '100%',
    height: height,
    borderRadius: '12px',
    position: 'relative' as const,
  };

  // --- New Handlers for Map Load/Unload ---
  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance;
    setMap(mapInstance);
  }, []);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
    setMap(null);
  }, []);

  // --- Custom Hooks ---
  const { userLocation, mapCenter, initialZoom } = useUserLocation();

  // --- Google Maps API Loader ---
  
 const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  
  // ⚙️ THIS IS THE UPDATED EFFECT
  useEffect(() => {
    getLoader()
      .then(() => {
        setIsLoaded(true);
      })
      .catch(err => {
        console.error('Google Maps load error:', err);
        setLoadError(err as Error);
      });
  // We only want this to run once on component mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // --- Optimized Data Fetching ---
  const handleMapIdle = useCallback(async () => {
    if (!mapRef.current || isFetching.current) return;
    
    isFetching.current = true;

    try {
      const db = getFirestore(app);
      const bounds = mapRef.current.getBounds();
      if (!bounds) return;

      // Use user location if available, else default to Bangalore
      const currentMapCenter = mapRef.current.getCenter();
    if (!currentMapCenter) {
        isFetching.current = false;
        return;
    }
    const fetchCenter = { lat: currentMapCenter.lat(), lng: currentMapCenter.lng() };
     console.log('[Map] Fetching data for map center:', fetchCenter);

      // Use map bounds for radius, but center for fetching is user location or default
      const center = new window.google.maps.LatLng(fetchCenter.lat, fetchCenter.lng);
      const northEast = bounds.getNorthEast();
      const radiusInM = geofire.distanceBetween(
        [center.lat(), center.lng()], 
        [northEast.lat(), northEast.lng()]
      ) * FETCH_RADIUS_MULTIPLIER;

      // Log the area being fetched
      // console.log('[Map] Fetching area:', {
      //   center: { lat: center.lat(), lng: center.lng() },
      //   northEast: { lat: northEast.lat(), lng: northEast.lng() },
      //   radiusInM
      // });

      const geoBounds = geofire.geohashQueryBounds([center.lat(), center.lng()], radiusInM);
      const zoomLevel = mapRef.current.getZoom() || INITIAL_ZOOM_DEFAULT;
      const newBoundsToFetch = geoBounds.filter(b => {
        const boundKey = `${zoomLevel}:${b.join(',')}`;
        if (fetchedGeoBounds.current.has(boundKey)) return false;
        fetchedGeoBounds.current.add(boundKey);
        return true;
      });

      if (newBoundsToFetch.length === 0) {
        isFetching.current = false;
        return;
      }

      // const issuesPromises = newBoundsToFetch.map(b =>
      //   getDocs(query(
      //     collection(db, 'issues'),
      //     orderBy('geohash'),
      //     where('geohash', '>=', b[0]),
      //     where('geohash', '<=', b[1])
      //   ))
      // );
      const categoriesToFetch = Array.from(selectedCategories);

      const issuesPromises = newBoundsToFetch.map(b => {
        let q = query(
          collection(db, 'issues'),
          orderBy('geohash'),
          where('geohash', '>=', b[0]),
          where('geohash', '<=', b[1])
        );

        // Add the category filter ONLY if categories are selected and the list is not empty
        if (categoriesToFetch.length > 0 && categoriesToFetch.length < Object.keys(categoryStyles).length -1) {
          q = query(q, where('category', 'in', categoriesToFetch));
        }

        return getDocs(q);
      });

      const snapshots = await Promise.all(issuesPromises);
      const issuesMap = new Map<string, Issue>();
      
      snapshots.forEach((snap) => {
        snap.docs.forEach((doc) => {
          if (!issuesMap.has(doc.id)) {
            issuesMap.set(doc.id, { id: doc.id, ...doc.data() } as Issue);
          }
        });
      });

      const allFetchedIssues = Array.from(issuesMap.values());
      // Log the issues fetched in the area
      console.log('[Map] Issues fetched in area:', allFetchedIssues);

      const newIssuesToProcess = allFetchedIssues.filter(issue => {
        if (processedIssueIds.current.has(issue.id)) return false;
        return (issue.credibility || 0) >= MIN_CREDIBILITY && issue.status === 'open';
      });

      if (newIssuesToProcess.length === 0) {
        isFetching.current = false;
        return;
      }

      newIssuesToProcess.forEach(issue => processedIssueIds.current.add(issue.id));

      const reportsPromises = newIssuesToProcess.map(async issue => {
        try {
          const reportsSnapshot = await getDocs(collection(db, 'issues', issue.id, 'reports'));
          return reportsSnapshot.docs
            .map(doc => {
              const data = doc.data();
              if (!data.addedAt?.toDate) return null;
              
              return {
                id: doc.id,
                issueId: issue.id,
                ...data,
                addedAt: data.addedAt.toDate(),
                parentHeatScore: issue.normalizedHeatScore,
                category: issue.category || 'other',
              } as Report;
            })
            .filter((report): report is Report => report !== null);
        } catch (error) {
          console.error(`Error fetching reports for issue ${issue.id}:`, error);
          processedIssueIds.current.delete(issue.id);
          return [];
        }
      });

      const reportsByIssue = await Promise.all(reportsPromises);
      const newReports = reportsByIssue.flat();

      if (newReports.length > 0) {
        setAllReports(prev => {
          const existingKeys = new Set(prev.map(r => `${r.issueId}-${r.id}`));
          const uniqueReports = newReports.filter(r => !existingKeys.has(`${r.issueId}-${r.id}`));
          return [...prev, ...uniqueReports];
        });
      }
    } catch (error) {
      console.error("Error in handleMapIdle:", error);
    } finally {
      isFetching.current = false;
    }
  }, [userLocation, map]);

  // --- Effect for Initial Data Fetch ---
// Initial fetch when map loads
// Initial fetch when map loads, but only after userLocation is set (or geolocation fails)
useEffect(() => {
  if (map && !initialFetchTriggered.current) {
    // Wait for userLocation to be set (or null after geolocation attempt)
    if (userLocation !== null || (typeof window !== 'undefined' && !navigator.geolocation)) {
      initialFetchTriggered.current = true;
      handleMapIdle();
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [map, userLocation, handleMapIdle]);

// Fetch again when userLocation changes and map is loaded
useEffect(() => {
  if (map && userLocation && initialFetchTriggered.current) {
    // Clear fetched bounds and processed issues so we fetch for the new location
    fetchedGeoBounds.current = new Set();
    processedIssueIds.current = new Set();
    setAllReports([]);
    handleMapIdle();
  }
}, [userLocation, map, handleMapIdle]);
  
  // --- Debounced Map Idle Handler ---
  const debouncedHandleMapIdle = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleMapIdle();
      }, 300);
    };
  }, [handleMapIdle]);
   useEffect(() => {
    // A debounced handler to avoid firing too frequently.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    const handleResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        if (map) {
          // This is the official way to tell Google Maps the container resized.
          // It will trigger a re-render and an 'idle' event.
          const center = map.getCenter();
          google.maps.event.trigger(map, 'resize');
          if (center) {
            map.setCenter(center);
          }
        }
      }, 300); // 300ms delay to wait for resize to finish
    };

    window.addEventListener('resize', handleResize);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map]); 
  // --- Event Handlers ---
  const handleRecenter = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(USER_LOCATION_ZOOM);
    }
  }, [userLocation]);

  const handleMarkerClick = useCallback((report: Report) => {
    setSelectedReport(prev => prev?.id === report.id ? null : report);
  }, []);

  const handleZoomChanged = useCallback(() => {
    if (mapRef.current) {
      setCurrentZoom(mapRef.current.getZoom() || INITIAL_ZOOM_DEFAULT);
    }
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      const lowerCategory = category.toLowerCase();
      if (newSet.has(lowerCategory)) {
        newSet.delete(lowerCategory);
      } else {
        newSet.add(lowerCategory);
      }
      return newSet;
    });
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedReport(null);
    setIsFilterVisible(false);
  }, []);

  const toggleFilter = useCallback(() => {
    setIsFilterVisible(prev => !prev);
  }, []);

  // --- Memoized Values ---
  useEffect(() => {
    const newFilteredReports = allReports.filter(report =>
      selectedCategories.has(report.category?.toLowerCase() || 'other')
    );
    setFilteredReports(newFilteredReports);
  }, [allReports, selectedCategories]);

  const jitteredReportPositions = useMemo(() => getJitteredPositions(filteredReports), [filteredReports]);

  const showMarkers = currentZoom > HEATMAP_ZOOM_THRESHOLD;

  const heatmapData = useMemo(() => {
    if (!window.google?.maps || currentZoom > HEATMAP_ZOOM_THRESHOLD) {
      return [];
    }
    return filteredReports.map(report => ({
      location: new window.google.maps.LatLng(report.lat, report.lng),
      weight: report.parentHeatScore,
    }));
  }, [filteredReports, currentZoom]);

  // --- Render Guards ---
  if (loadError) {
    return <div className="text-red-500">Error loading maps</div>;
  }

  if (!isLoaded) {
    return (
     <div className="flex items-center justify-center h-screen">
          <Spinner />
        </div>)
     }

  return (
    <div className="relative" style={{ height }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={initialZoom}
        options={mapOptions}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
        onZoomChanged={handleZoomChanged}
        onIdle={debouncedHandleMapIdle}
        onClick={handleMapClick}
      >
        {userLocation && showMarkers && (
          <>
            <Circle
              center={userLocation}
              radius={userLocation.accuracy}
              options={{
                fillColor: '#4285F4',
                fillOpacity: 0.2,
                strokeColor: '#4285F4',
                strokeOpacity: 0.3,
                strokeWeight: 1,
              }}
            />
            <Marker
              position={userLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2,
              }}
              title="Your Location"
              zIndex={10}
            />
          </>
        )}

        <HeatmapLayer data={heatmapData} options={heatmapOptions} />

        {showMarkers && (
          <MarkerClustererF>
            {clusterer => (
              <>
                {filteredReports.map(report => {
                  const pos = jitteredReportPositions.get(`${report.issueId}-${report.id}`) || { lat: report.lat, lng: report.lng };
                  return (
                    <Marker
                      key={`${report.issueId}-${report.id}`}
                      position={{ lat: pos.lat, lng: pos.lng }}
                      onClick={() => handleMarkerClick(report)}
                      icon={{
                        url: getMarkerIcon(report.category),
                        scaledSize: new window.google.maps.Size(38, 38),
                        anchor: new window.google.maps.Point(19, 38),
                      }}
                      title={report.summary}
                      clusterer={clusterer}
                    />
                  );
                })}
              </>
            )}
          </MarkerClustererF>
        )}
      </GoogleMap>

      <div className="absolute top-15 md:top-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white py-2 px-4 rounded-full text-xs sm:text-sm font-medium pointer-events-none shadow-2xl border border-gray-700/50 max-w-[calc(100vw-8rem)]">
        {showMarkers ? "📍 Click on a pin to see report details" : "🔍 Zoom in to see individual reports"}
      </div>

      {userLocation && (
        <button
  onClick={handleRecenter}
  className="absolute bottom-66 left-4 group bg-white/95 backdrop-blur-sm w-12 h-12 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all duration-300 z-10 border border-white/20 hover:border-blue-200/50"
  title="Recenter on my location"
>
  <div className="relative">
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="text-gray-700 group-hover:text-blue-600 transition-colors duration-300"
    >
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2L12 4"/>
      <path d="M22 12L20 12"/>
      <path d="M12 22L12 20"/>
      <path d="M2 12L4 12"/>
    </svg>
    
    {/* Subtle pulse animation */}
    <div className="absolute inset-0 rounded-full bg-blue-400/20 scale-0 group-hover:scale-110 group-hover:animate-ping transition-transform duration-300" />
  </div>
</button>
      )}

      <CategoryFilter
        selectedCategories={selectedCategories}
        onCategoryChange={handleCategoryChange}
        isVisible={isFilterVisible}
        onToggle={toggleFilter}
      />
      
      <CategoryLegend selectedCategories={selectedCategories} />

      {selectedReport && (
        <div className="absolute top-0 left-0 h-full w-full sm:w-96 bg-white/95 backdrop-blur-lg text-gray-800 overflow-hidden shadow-2xl animate-in slide-in-from-left duration-300 border-r border-gray-200/50 z-20">
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            <button 
              onClick={() => setSelectedReport(null)}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-800 text-xl w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200 z-30"
            >
              ×
            </button>
            
            <div className="mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 pr-10">Report Details</h2>
              <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
            </div>

            {selectedReport.imageUrl && (
              <div className="mb-4 sm:mb-6">
                <img 
                  src={selectedReport.imageUrl} 
                  alt="Issue Report" 
                  className="w-full h-40 sm:h-48 object-cover rounded-xl shadow-lg border border-gray-200"
                />
              </div>
            )}
            
            <div className="mb-4 sm:mb-6">
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{selectedReport.summary}</p>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 border-t border-gray-200 pt-3 sm:pt-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Details
              </h3>
              
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <span className="text-base sm:text-lg">{categoryStyles[selectedReport.category as keyof typeof categoryStyles]?.emoji || '❓'}</span>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</span>
                    <p className="font-semibold text-gray-800 text-sm">{categoryStyles[selectedReport.category as keyof typeof categoryStyles]?.name || 'Other'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <span className="text-base sm:text-lg">🆔</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Report ID</span>
                    <p className="font-mono text-xs sm:text-sm text-gray-700 break-all">{selectedReport.id}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <span className="text-base sm:text-lg">📍</span>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</span>
                    <p className="font-mono text-xs sm:text-sm text-gray-700">{`${selectedReport.lat.toFixed(5)}, ${selectedReport.lng.toFixed(5)}`}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-gray-50 rounded-lg">
                  <span className="text-base sm:text-lg">📅</span>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</span>
                    <p className="text-xs sm:text-sm text-gray-700">{selectedReport.addedAt.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App Component ---
export default function App({height}: {height?: string}) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white text-center p-8">
        <h1 className="text-2xl">
          Google Maps API key is missing. Please set NEXT_PUBLIC_Maps_API_KEY in your environment variables.
        </h1>
      </div>
    );
  }

  return <MapComponent  height={height} />;
}