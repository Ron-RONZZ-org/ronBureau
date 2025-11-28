<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="maps-page">
        <div class="maps-sidebar">
          <div class="sidebar-header">
            <h2>🗺️ Maps</h2>
            <button class="btn btn-outline btn-sm location-btn" @click="goToCurrentLocation" :disabled="isGettingLocation">
              {{ isGettingLocation ? '📍...' : '📍 My Location' }}
            </button>
          </div>

          <!-- Search Mode Toggle -->
          <div class="search-mode-toggle">
            <button
              class="mode-btn"
              :class="{ active: searchMode === 'places' }"
              @click="searchMode = 'places'"
            >
              📍 Places
            </button>
            <button
              class="mode-btn"
              :class="{ active: searchMode === 'directions' }"
              @click="searchMode = 'directions'"
            >
              🧭 Directions
            </button>
          </div>

          <!-- Places Search -->
          <div v-if="searchMode === 'places'" class="search-section">
            <div class="input-group">
              <label for="place-search">Search Places</label>
              <input
                id="place-search"
                v-model="placeQuery"
                type="text"
                class="input"
                placeholder="Search for a place..."
                @input="debouncedSearchPlaces"
              />
            </div>
            <div v-if="placeResults.length > 0" class="search-results">
              <div
                v-for="(result, index) in placeResults"
                :key="index"
                class="search-result-item"
                @click="selectPlace(result)"
              >
                <span class="result-icon">📍</span>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-address">{{ result.address }}</span>
                </div>
              </div>
            </div>
            <p class="hint-text">💡 Tip: Click on the map to add a point directly</p>
          </div>

          <!-- Directions Search -->
          <div v-if="searchMode === 'directions'" class="search-section">
            <div class="input-group">
              <label for="origin">Origin</label>
              <div class="input-with-button">
                <input
                  id="origin"
                  v-model="originQuery"
                  type="text"
                  class="input"
                  placeholder="Starting point..."
                  @input="debouncedSearchOrigin"
                />
                <button class="btn btn-outline btn-sm use-location-btn" @click="useCurrentLocationAsOrigin" :disabled="isGettingLocation" title="Use current location">
                  📍
                </button>
              </div>
            </div>
            <div v-if="originResults.length > 0 && showOriginResults" class="search-results">
              <div
                v-for="(result, index) in originResults"
                :key="index"
                class="search-result-item"
                @click="selectOrigin(result)"
              >
                <span class="result-icon">🔵</span>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-address">{{ result.address }}</span>
                </div>
              </div>
            </div>

            <!-- Intermediary Stops -->
            <div v-if="stops.length > 0" class="stops-section">
              <label>Stops</label>
              <draggable v-model="stops" item-key="id" handle=".drag-handle" @end="onStopReorder">
                <template #item="{ element, index }">
                  <div class="stop-item">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="stop-number">{{ index + 1 }}</span>
                    <span class="stop-name">{{ element.name }}</span>
                    <button class="remove-btn" @click="removeStop(index)">×</button>
                  </div>
                </template>
              </draggable>
            </div>
            <button class="btn btn-outline btn-sm w-full" @click="addStopMode = !addStopMode">
              {{ addStopMode ? '✓ Click map to add stop' : '+ Add Stop' }}
            </button>

            <div class="input-group">
              <label for="destination">Destination</label>
              <input
                id="destination"
                v-model="destinationQuery"
                type="text"
                class="input"
                placeholder="Destination..."
                @input="debouncedSearchDestination"
              />
            </div>
            <div v-if="destinationResults.length > 0 && showDestinationResults" class="search-results">
              <div
                v-for="(result, index) in destinationResults"
                :key="index"
                class="search-result-item"
                @click="selectDestination(result)"
              >
                <span class="result-icon">🔴</span>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-address">{{ result.address }}</span>
                </div>
              </div>
            </div>

            <button
              class="btn btn-primary w-full"
              :disabled="!origin || !destination || isLoadingRoute"
              @click="getDirections"
            >
              {{ isLoadingRoute ? 'Loading...' : 'Get Directions' }}
            </button>

            <div v-if="routeInfo" class="route-info card">
              <h4>Route Info</h4>
              <p><strong>Distance:</strong> {{ routeInfo.distance }}</p>
              <p><strong>Duration:</strong> {{ routeInfo.duration }}</p>
              <button class="btn btn-outline btn-sm w-full mt-2" @click="saveCurrentRoute">
                💾 Save Route
              </button>
            </div>
          </div>

          <!-- Saved Places -->
          <div class="saved-section">
            <div class="saved-header">
              <h3>📌 Places</h3>
              <button class="btn btn-outline btn-sm" @click="clearAllPlaces" :disabled="savedPlaces.length === 0">Clear All</button>
            </div>
            <div v-if="savedPlaces.length === 0" class="no-saved">
              <p>No saved places yet</p>
            </div>
            <div v-else class="saved-list">
              <div
                v-for="(place, index) in savedPlaces"
                :key="index"
                class="saved-item"
                @click="goToPlace(place)"
              >
                <span class="saved-icon" :style="{ color: place.color || customization.placeMarkerColor }">{{ place.icon || '📍' }}</span>
                <span class="saved-name">{{ place.name }}</span>
                <button class="remove-btn" @click.stop="removePlace(index)">×</button>
              </div>
            </div>
          </div>

          <!-- Saved Routes -->
          <div class="saved-section">
            <div class="saved-header">
              <h3>🛤️ Routes</h3>
              <button class="btn btn-outline btn-sm" @click="clearAllRoutes" :disabled="savedRoutes.length === 0">Clear All</button>
            </div>
            <div v-if="savedRoutes.length === 0" class="no-saved">
              <p>No saved routes yet</p>
            </div>
            <div v-else class="saved-list">
              <div
                v-for="(route, index) in savedRoutes"
                :key="index"
                class="saved-item"
                @click="loadRoute(route)"
              >
                <span class="saved-icon">🛤️</span>
                <span class="saved-name">{{ route.name }}</span>
                <button class="remove-btn" @click.stop="removeRoute(index)">×</button>
              </div>
            </div>
          </div>

          <!-- Export/Import Section -->
          <div class="geojson-section">
            <h3>📁 Export / Import</h3>
            
            <!-- Export Options -->
            <div class="export-options">
              <label>Export Type:</label>
              <select v-model="exportType" class="select select-sm">
                <option value="both">Both (Places & Routes)</option>
                <option value="places">Places Only</option>
                <option value="routes">Routes Only</option>
              </select>
            </div>
            
            <div class="geojson-buttons">
              <button class="btn btn-outline" @click="exportGeoJSON">📄 GeoJSON</button>
              <button class="btn btn-outline" @click="showPdfExportModal = true">📑 PDF Map</button>
            </div>
            <div class="geojson-buttons mt-2">
              <label class="btn btn-outline import-label w-full">
                📥 Import GeoJSON
                <input type="file" accept=".json,.geojson" @change="importGeoJSON" hidden />
              </label>
            </div>
          </div>

          <!-- Customization Section -->
          <div class="customization-section">
            <h3>🎨 Customization</h3>
            <div class="color-option">
              <label>Place Marker Color:</label>
              <input type="color" v-model="customization.placeMarkerColor" @change="updateMarkerColors" />
            </div>
            <div class="color-option">
              <label>Route Color:</label>
              <input type="color" v-model="customization.routeColor" @change="updateRouteColor" />
            </div>
          </div>

          <!-- Status Message -->
          <div v-if="statusMessage" class="status-message" :class="statusType">
            {{ statusMessage }}
          </div>
        </div>

        <div class="maps-container">
          <div ref="mapContainer" class="map-element"></div>
          
          <!-- Map Controls -->
          <div class="map-controls">
            <button class="map-control-btn" @click="goToCurrentLocation" :disabled="isGettingLocation" title="My Location">
              📍
            </button>
          </div>
        </div>

        <!-- PDF Export Modal -->
        <div v-if="showPdfExportModal" class="modal-overlay" @click.self="showPdfExportModal = false">
          <div class="modal-content">
            <h3>📑 PDF Map Export</h3>
            <div class="input-group">
              <label for="pdf-title">Map Title</label>
              <input id="pdf-title" v-model="pdfOptions.title" type="text" class="input" placeholder="Enter map title..." />
            </div>
            <div class="input-group">
              <label for="pdf-scale">Scale</label>
              <select id="pdf-scale" v-model="pdfOptions.scale" class="select">
                <option value="auto">Auto (fit to page)</option>
                <option value="custom">Current View</option>
              </select>
            </div>
            <div class="checkbox-group">
              <label><input type="checkbox" v-model="pdfOptions.showLegend" /> Show Legend</label>
              <label><input type="checkbox" v-model="pdfOptions.showScaleBar" /> Show Scale Bar</label>
              <label><input type="checkbox" v-model="pdfOptions.showNorthPointer" /> Show North Pointer</label>
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showPdfExportModal = false">Cancel</button>
              <button class="btn btn-primary" @click="exportPdfMap">Export PDF</button>
            </div>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Point, LineString } from 'ol/geom';
import Feature from 'ol/Feature';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { getDistance } from 'ol/sphere';
import { jsPDF } from 'jspdf';

const config = useRuntimeConfig();

interface PlaceResult {
  name: string;
  address: string;
  lon: number;
  lat: number;
}

interface SavedPlace {
  name: string;
  lon: number;
  lat: number;
  icon?: string;
  color?: string;
}

interface SavedRoute {
  id: string;
  name: string;
  origin: PlaceResult;
  destination: PlaceResult;
  stops: PlaceResult[];
  distance: string;
  duration: string;
  coordinates: number[][];
}

interface RouteInfo {
  distance: string;
  duration: string;
}

interface Stop {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

// Simple draggable component
const draggable = {
  template: `<div><slot v-for="(item, index) in modelValue" :key="item.id" :element="item" :index="index" /></div>`,
  props: ['modelValue', 'itemKey', 'handle'],
  emits: ['update:modelValue', 'end'],
};

const auth = useAuthStore();

onMounted(() => {
  auth.initFromStorage();
});

const mapContainer = ref<HTMLElement | null>(null);
let map: Map | null = null;
let markersSource: VectorSource | null = null;
let routeSource: VectorSource | null = null;
let currentLocationSource: VectorSource | null = null;

// Search state
const searchMode = ref<'places' | 'directions'>('places');
const placeQuery = ref('');
const placeResults = ref<PlaceResult[]>([]);

// Directions state
const originQuery = ref('');
const destinationQuery = ref('');
const originResults = ref<PlaceResult[]>([]);
const destinationResults = ref<PlaceResult[]>([]);
const showOriginResults = ref(false);
const showDestinationResults = ref(false);
const origin = ref<PlaceResult | null>(null);
const destination = ref<PlaceResult | null>(null);
const routeInfo = ref<RouteInfo | null>(null);
const isLoadingRoute = ref(false);
const currentRouteCoordinates = ref<number[][]>([]);

// Stops for intermediary points
const stops = ref<Stop[]>([]);
const addStopMode = ref(false);

// Status message state
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | ''>('');

// Saved places and routes
const savedPlaces = ref<SavedPlace[]>([]);
const savedRoutes = ref<SavedRoute[]>([]);

// Export options
const exportType = ref<'both' | 'places' | 'routes'>('both');

// PDF Export options
const showPdfExportModal = ref(false);
const pdfOptions = ref({
  title: 'Map Export',
  scale: 'auto',
  showLegend: true,
  showScaleBar: true,
  showNorthPointer: true,
});

// Location state
const isGettingLocation = ref(false);
const currentLocation = ref<{ lon: number; lat: number } | null>(null);

// Customization options
const customization = ref({
  placeMarkerColor: '#ef4444', // default red
  routeColor: '#22c55e', // default green
});

// Show status message helper
function showStatus(message: string, type: 'success' | 'error') {
  statusMessage.value = message;
  statusType.value = type;
  setTimeout(() => {
    statusMessage.value = '';
    statusType.value = '';
  }, 3000);
}

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Location Service
async function getCurrentLocation(): Promise<{ lon: number; lat: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lon: position.coords.longitude,
          lat: position.coords.latitude,
        });
      },
      (error) => {
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function goToCurrentLocation() {
  isGettingLocation.value = true;
  try {
    const location = await getCurrentLocation();
    currentLocation.value = location;
    
    // Add current location marker
    if (currentLocationSource) {
      currentLocationSource.clear();
      const feature = new Feature({
        geometry: new Point(fromLonLat([location.lon, location.lat])),
        type: 'currentLocation',
      });
      feature.setStyle(
        new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: '#3b82f6' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
          }),
        })
      );
      currentLocationSource.addFeature(feature);
      
      // Add accuracy circle
      const accuracyFeature = new Feature({
        geometry: new Point(fromLonLat([location.lon, location.lat])),
        type: 'currentLocationAccuracy',
      });
      accuracyFeature.setStyle(
        new Style({
          image: new Circle({
            radius: 20,
            fill: new Fill({ color: 'rgba(59, 130, 246, 0.2)' }),
            stroke: new Stroke({ color: 'rgba(59, 130, 246, 0.5)', width: 1 }),
          }),
        })
      );
      currentLocationSource.addFeature(accuracyFeature);
    }
    
    // Center map
    if (map) {
      map.getView().animate({
        center: fromLonLat([location.lon, location.lat]),
        zoom: 15,
        duration: 500,
      });
    }
    showStatus('Location found!', 'success');
  } catch {
    showStatus('Could not get your location', 'error');
  } finally {
    isGettingLocation.value = false;
  }
}

async function useCurrentLocationAsOrigin() {
  isGettingLocation.value = true;
  try {
    const location = await getCurrentLocation();
    const place: PlaceResult = {
      name: 'My Location',
      address: `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
      lon: location.lon,
      lat: location.lat,
    };
    selectOrigin(place);
    showStatus('Using current location as origin', 'success');
  } catch {
    showStatus('Could not get your location', 'error');
  } finally {
    isGettingLocation.value = false;
  }
}

// Search places using Photon API
async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query.trim()) return [];

  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`
    );
    const data = await response.json();

    return data.features.map((feature: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; street?: string; city?: string; country?: string };
    }) => ({
      name: feature.properties.name || feature.properties.street || 'Unknown',
      address: [
        feature.properties.street,
        feature.properties.city,
        feature.properties.country,
      ]
        .filter(Boolean)
        .join(', '),
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
    }));
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// Reverse geocode
async function reverseGeocode(lon: number, lat: number): Promise<string> {
  try {
    const response = await fetch(
      `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}&limit=1`
    );
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      return props.name || props.street || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
  } catch (error) {
    console.error('Reverse geocode failed:', error);
  }
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// Debounced search functions
const debouncedSearchPlaces = debounce(async () => {
  placeResults.value = await searchPlaces(placeQuery.value);
}, 300);

const debouncedSearchOrigin = debounce(async () => {
  showOriginResults.value = true;
  originResults.value = await searchPlaces(originQuery.value);
}, 300);

const debouncedSearchDestination = debounce(async () => {
  showDestinationResults.value = true;
  destinationResults.value = await searchPlaces(destinationQuery.value);
}, 300);

// Select place from search results
function selectPlace(place: PlaceResult) {
  placeResults.value = [];
  placeQuery.value = '';

  // Add marker to map
  addMarker(place.lon, place.lat, place.name);

  // Save place
  savedPlaces.value.push({
    name: place.name,
    lon: place.lon,
    lat: place.lat,
    icon: '📍',
    color: customization.value.placeMarkerColor,
  });

  // Save to localStorage
  saveToLocalStorage();

  // Center map on place
  if (map) {
    map.getView().animate({
      center: fromLonLat([place.lon, place.lat]),
      zoom: 14,
      duration: 500,
    });
  }
}

function selectOrigin(place: PlaceResult) {
  origin.value = place;
  originQuery.value = place.name;
  originResults.value = [];
  showOriginResults.value = false;
  addDirectionMarker(place.lon, place.lat, 'origin');
}

function selectDestination(place: PlaceResult) {
  destination.value = place;
  destinationQuery.value = place.name;
  destinationResults.value = [];
  showDestinationResults.value = false;
  addDirectionMarker(place.lon, place.lat, 'destination');
}

// Add marker to map
function addMarker(lon: number, lat: number, name: string, color?: string) {
  if (!markersSource) return;

  const markerColor = color || customization.value.placeMarkerColor;
  
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: name,
    type: 'place',
    lon: lon,
    lat: lat,
  });

  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: markerColor }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: name,
        offsetY: -20,
        fill: new Fill({ color: '#1e293b' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
        font: '12px sans-serif',
      }),
    })
  );

  markersSource.addFeature(feature);
}

function addDirectionMarker(lon: number, lat: number, type: 'origin' | 'destination' | 'stop', index?: number) {
  if (!markersSource) return;

  // Remove existing marker of same type (for origin/destination)
  if (type !== 'stop') {
    const features = markersSource.getFeatures();
    features.forEach((f) => {
      if (f.get('type') === type) {
        markersSource?.removeFeature(f);
      }
    });
  }

  let color: string;
  let label: string;
  
  if (type === 'origin') {
    color = '#22c55e';
    label = 'A';
  } else if (type === 'destination') {
    color = '#ef4444';
    label = 'B';
  } else {
    color = '#f59e0b';
    label = String(index !== undefined ? index + 1 : '•');
  }
  
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    type: type,
    stopIndex: index,
  });

  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 10,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: label,
        fill: new Fill({ color: '#ffffff' }),
        font: 'bold 12px sans-serif',
      }),
    })
  );

  markersSource.addFeature(feature);
}

// Stops management
function removeStop(index: number) {
  stops.value.splice(index, 1);
  refreshStopMarkers();
}

function refreshStopMarkers() {
  if (!markersSource) return;
  
  // Remove all stop markers
  const features = markersSource.getFeatures();
  features.forEach((f) => {
    if (f.get('type') === 'stop') {
      markersSource?.removeFeature(f);
    }
  });
  
  // Re-add stop markers
  stops.value.forEach((stop, index) => {
    addDirectionMarker(stop.lon, stop.lat, 'stop', index);
  });
}

function onStopReorder() {
  refreshStopMarkers();
}

// Get directions using GraphHopper
async function getDirections() {
  if (!origin.value || !destination.value) return;

  isLoadingRoute.value = true;
  routeInfo.value = null;

  // Clear existing route
  if (routeSource) {
    routeSource.clear();
  }

  try {
    const apiKey = config.public.graphhopperApiKey;
    if (!apiKey) {
      showStatus('GraphHopper API key not configured', 'error');
      return;
    }
    
    // Build points array with intermediary stops
    const points = [
      `point=${origin.value.lat},${origin.value.lon}`,
      ...stops.value.map(stop => `point=${stop.lat},${stop.lon}`),
      `point=${destination.value.lat},${destination.value.lon}`,
    ].join('&');
    
    const url = `https://graphhopper.com/api/1/route?${points}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.paths && data.paths.length > 0) {
      const path = data.paths[0];
      const coordinates = path.points.coordinates;
      currentRouteCoordinates.value = coordinates;
      
      const projectedCoords = coordinates.map((coord: [number, number]) =>
        fromLonLat(coord)
      );

      // Draw route on map
      const routeFeature = new Feature({
        geometry: new LineString(projectedCoords),
        type: 'route',
      });

      routeFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: customization.value.routeColor,
            width: 4,
          }),
        })
      );

      routeSource?.addFeature(routeFeature);

      // Update route info
      const distanceKm = (path.distance / 1000).toFixed(1);
      const durationMin = Math.round(path.time / 60000);

      routeInfo.value = {
        distance: `${distanceKm} km`,
        duration: `${durationMin} min`,
      };

      // Fit map to route
      if (map && routeSource) {
        const extent = routeSource.getExtent();
        map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
      }
    }
  } catch (error) {
    console.error('Failed to get directions:', error);
    showStatus('Failed to get directions', 'error');
  } finally {
    isLoadingRoute.value = false;
  }
}

// Save current route
function saveCurrentRoute() {
  if (!origin.value || !destination.value || !routeInfo.value) {
    showStatus('No route to save', 'error');
    return;
  }
  
  const routeName = `${origin.value.name} → ${destination.value.name}`;
  const newRoute: SavedRoute = {
    id: generateId(),
    name: routeName,
    origin: origin.value,
    destination: destination.value,
    stops: stops.value.map(s => ({ name: s.name, address: '', lon: s.lon, lat: s.lat })),
    distance: routeInfo.value.distance,
    duration: routeInfo.value.duration,
    coordinates: currentRouteCoordinates.value,
  };
  
  savedRoutes.value.push(newRoute);
  saveToLocalStorage();
  showStatus('Route saved!', 'success');
}

// Load saved route
function loadRoute(route: SavedRoute) {
  origin.value = route.origin;
  originQuery.value = route.origin.name;
  destination.value = route.destination;
  destinationQuery.value = route.destination.name;
  stops.value = route.stops.map(s => ({ id: generateId(), name: s.name, lon: s.lon, lat: s.lat }));
  
  // Clear and redraw
  if (routeSource) {
    routeSource.clear();
  }
  
  // Add markers
  addDirectionMarker(route.origin.lon, route.origin.lat, 'origin');
  addDirectionMarker(route.destination.lon, route.destination.lat, 'destination');
  refreshStopMarkers();
  
  // Draw route
  if (route.coordinates.length > 0) {
    const projectedCoords = route.coordinates.map((coord: number[]) =>
      fromLonLat(coord)
    );
    const routeFeature = new Feature({
      geometry: new LineString(projectedCoords),
      type: 'route',
    });
    routeFeature.setStyle(
      new Style({
        stroke: new Stroke({
          color: customization.value.routeColor,
          width: 4,
        }),
      })
    );
    routeSource?.addFeature(routeFeature);
    currentRouteCoordinates.value = route.coordinates;
    
    routeInfo.value = {
      distance: route.distance,
      duration: route.duration,
    };
    
    // Fit map to route
    if (map && routeSource) {
      const extent = routeSource.getExtent();
      map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
    }
  }
  
  searchMode.value = 'directions';
}

// Go to place on map
function goToPlace(place: SavedPlace) {
  if (map) {
    map.getView().animate({
      center: fromLonLat([place.lon, place.lat]),
      zoom: 16,
      duration: 500,
    });
  }
}

// Remove saved place
function removePlace(index: number) {
  savedPlaces.value.splice(index, 1);
  saveToLocalStorage();
  refreshMarkersFromSaved();
}

function removeRoute(index: number) {
  savedRoutes.value.splice(index, 1);
  saveToLocalStorage();
}

function clearAllPlaces() {
  savedPlaces.value = [];
  saveToLocalStorage();
  if (markersSource) {
    const features = markersSource.getFeatures();
    features.forEach((f) => {
      if (f.get('type') === 'place') {
        markersSource?.removeFeature(f);
      }
    });
  }
}

function clearAllRoutes() {
  savedRoutes.value = [];
  saveToLocalStorage();
}

function refreshMarkersFromSaved() {
  if (!markersSource) return;

  // Remove only place markers
  const features = markersSource.getFeatures();
  features.forEach((f) => {
    if (f.get('type') === 'place') {
      markersSource?.removeFeature(f);
    }
  });

  // Re-add from saved
  savedPlaces.value.forEach((place) => {
    addMarker(place.lon, place.lat, place.name, place.color);
  });
}

// Update marker colors
function updateMarkerColors() {
  saveCustomizationToLocalStorage();
  refreshMarkersFromSaved();
}

function updateRouteColor() {
  saveCustomizationToLocalStorage();
  // Update current route color
  if (routeSource) {
    const features = routeSource.getFeatures();
    features.forEach((f) => {
      if (f.get('type') === 'route') {
        f.setStyle(
          new Style({
            stroke: new Stroke({
              color: customization.value.routeColor,
              width: 4,
            }),
          })
        );
      }
    });
  }
}

// LocalStorage persistence
function saveToLocalStorage() {
  if (import.meta.client) {
    localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces.value));
    localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes.value));
  }
}

function saveCustomizationToLocalStorage() {
  if (import.meta.client) {
    localStorage.setItem('mapCustomization', JSON.stringify(customization.value));
  }
}

function loadFromLocalStorage() {
  if (import.meta.client) {
    const savedPlacesData = localStorage.getItem('savedPlaces');
    if (savedPlacesData) {
      try {
        savedPlaces.value = JSON.parse(savedPlacesData);
      } catch {
        savedPlaces.value = [];
      }
    }
    
    const savedRoutesData = localStorage.getItem('savedRoutes');
    if (savedRoutesData) {
      try {
        savedRoutes.value = JSON.parse(savedRoutesData);
      } catch {
        savedRoutes.value = [];
      }
    }
    
    const customizationData = localStorage.getItem('mapCustomization');
    if (customizationData) {
      try {
        customization.value = { ...customization.value, ...JSON.parse(customizationData) };
      } catch {
        // Keep defaults
      }
    }
  }
}

// Record last accessed tool
function recordLastAccessed() {
  if (import.meta.client) {
    const lastAccessed = JSON.parse(localStorage.getItem('lastAccessedTools') || '[]');
    const now = new Date().toISOString();
    const mapEntry = { id: 'maps', name: 'Maps', icon: '🗺️', path: '/maps', accessedAt: now };

    // Remove existing entry for maps
    const filtered = lastAccessed.filter((item: { id: string }) => item.id !== 'maps');
    // Add to front
    filtered.unshift(mapEntry);
    // Keep only last 5
    const trimmed = filtered.slice(0, 5);

    localStorage.setItem('lastAccessedTools', JSON.stringify(trimmed));
  }
}

// GeoJSON Export
function exportGeoJSON() {
  const features: Feature[] = [];

  // Add saved places if selected
  if (exportType.value === 'both' || exportType.value === 'places') {
    savedPlaces.value.forEach((place) => {
      const feature = new Feature({
        geometry: new Point([place.lon, place.lat]),
      });
      feature.set('name', place.name);
      feature.set('type', 'place');
      feature.set('icon', place.icon || '📍');
      feature.set('color', place.color || customization.value.placeMarkerColor);
      features.push(feature);
    });
  }

  // Add routes if selected
  if (exportType.value === 'both' || exportType.value === 'routes') {
    savedRoutes.value.forEach((route) => {
      if (route.coordinates.length > 0) {
        const feature = new Feature({
          geometry: new LineString(route.coordinates),
        });
        feature.set('name', route.name);
        feature.set('type', 'route');
        feature.set('properties', {
          start: { name: route.origin.name, lon: route.origin.lon, lat: route.origin.lat },
          stops: route.stops.map(s => ({ name: s.name, lon: s.lon, lat: s.lat })),
          destination: { name: route.destination.name, lon: route.destination.lon, lat: route.destination.lat },
          distance: route.distance,
          duration: route.duration,
        });
        features.push(feature);
      }
    });
    
    // Also export current route if exists
    if (routeSource && currentRouteCoordinates.value.length > 0 && origin.value && destination.value) {
      const feature = new Feature({
        geometry: new LineString(currentRouteCoordinates.value),
      });
      feature.set('name', `${origin.value.name} → ${destination.value.name}`);
      feature.set('type', 'route');
      feature.set('properties', {
        start: { name: origin.value.name, lon: origin.value.lon, lat: origin.value.lat },
        stops: stops.value.map(s => ({ name: s.name, lon: s.lon, lat: s.lat })),
        destination: { name: destination.value.name, lon: destination.value.lon, lat: destination.value.lat },
        distance: routeInfo.value?.distance || '',
        duration: routeInfo.value?.duration || '',
      });
      features.push(feature);
    }
  }

  if (features.length === 0) {
    showStatus('No data to export', 'error');
    return;
  }

  const geojsonFormat = new GeoJSON();
  const geojson = geojsonFormat.writeFeaturesObject(features, {
    featureProjection: 'EPSG:4326',
  });

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `map-export-${new Date().toISOString().split('T')[0]}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus('GeoJSON exported successfully!', 'success');
}

// PDF Map Export
async function exportPdfMap() {
  if (!map) return;
  
  showPdfExportModal.value = false;
  showStatus('Generating PDF...', 'success');
  
  try {
    const mapCanvas = map.getViewport().querySelector('canvas');
    if (!mapCanvas) {
      showStatus('Could not capture map', 'error');
      return;
    }
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    // Add title
    if (pdfOptions.value.title) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(pdfOptions.value.title, pageWidth / 2, margin + 5, { align: 'center' });
    }
    
    // Calculate map area
    const titleHeight = pdfOptions.value.title ? 15 : 0;
    const legendHeight = pdfOptions.value.showLegend ? 20 : 0;
    const mapTop = margin + titleHeight;
    const mapHeight = pageHeight - margin * 2 - titleHeight - legendHeight;
    const mapWidth = pageWidth - margin * 2;
    
    // Add map image
    const imgData = mapCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', margin, mapTop, mapWidth, mapHeight);
    
    // Add north pointer
    if (pdfOptions.value.showNorthPointer) {
      const npX = pageWidth - margin - 10;
      const npY = mapTop + 10;
      pdf.setFillColor(255, 255, 255);
      pdf.circle(npX, npY, 5, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.circle(npX, npY, 5, 'S');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('N', npX, npY + 1, { align: 'center' });
      // Arrow
      pdf.setLineWidth(0.5);
      pdf.line(npX, npY - 7, npX, npY - 3);
      pdf.line(npX - 2, npY - 5, npX, npY - 7);
      pdf.line(npX + 2, npY - 5, npX, npY - 7);
    }
    
    // Add scale bar
    if (pdfOptions.value.showScaleBar) {
      const view = map.getView();
      const resolution = view.getResolution();
      if (resolution) {
        const center = view.getCenter();
        if (center) {
          const pointOnMap = toLonLat(center);
          const point1 = toLonLat([center[0], center[1]]);
          const point2 = toLonLat([center[0] + resolution * 100, center[1]]);
          const distance = getDistance(point1, point2);
          
          let scaleDistance: number;
          let scaleLabel: string;
          
          if (distance > 1000) {
            scaleDistance = Math.round(distance / 1000);
            scaleLabel = `${scaleDistance} km`;
          } else {
            scaleDistance = Math.round(distance);
            scaleLabel = `${scaleDistance} m`;
          }
          
          const sbX = margin + 5;
          const sbY = mapTop + mapHeight - 5;
          const sbWidth = 30;
          
          pdf.setFillColor(255, 255, 255);
          pdf.rect(sbX - 2, sbY - 5, sbWidth + 4, 8, 'F');
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.5);
          pdf.line(sbX, sbY, sbX + sbWidth, sbY);
          pdf.line(sbX, sbY - 2, sbX, sbY);
          pdf.line(sbX + sbWidth, sbY - 2, sbX + sbWidth, sbY);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.text(scaleLabel, sbX + sbWidth / 2, sbY - 2, { align: 'center' });
        }
      }
    }
    
    // Add legend
    if (pdfOptions.value.showLegend) {
      const legendY = pageHeight - margin - legendHeight + 5;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Legend:', margin, legendY);
      
      let legendX = margin + 20;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      if (savedPlaces.value.length > 0) {
        pdf.setFillColor(239, 68, 68);
        pdf.circle(legendX, legendY - 1, 2, 'F');
        pdf.text('Places', legendX + 5, legendY);
        legendX += 30;
      }
      
      if (savedRoutes.value.length > 0 || currentRouteCoordinates.value.length > 0) {
        pdf.setDrawColor(34, 197, 94);
        pdf.setLineWidth(1);
        pdf.line(legendX, legendY - 1, legendX + 10, legendY - 1);
        pdf.text('Routes', legendX + 15, legendY);
      }
    }
    
    // Add date
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - margin, { align: 'right' });
    
    pdf.save(`map-${new Date().toISOString().split('T')[0]}.pdf`);
    showStatus('PDF exported successfully!', 'success');
  } catch (error) {
    console.error('PDF export failed:', error);
    showStatus('Failed to export PDF', 'error');
  }
}

// GeoJSON Import
function importGeoJSON(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const geojson = JSON.parse(content);
      const geojsonFormat = new GeoJSON();
      const features = geojsonFormat.readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      });

      let placesImported = 0;
      let routesImported = 0;

      // Process imported features
      features.forEach((feature) => {
        const geom = feature.getGeometry();
        const featureType = feature.get('type');
        
        if (geom?.getType() === 'Point') {
          const coords = toLonLat((geom as Point).getCoordinates());
          const name = feature.get('name') || 'Imported Place';
          const icon = feature.get('icon') || '📍';
          const color = feature.get('color') || customization.value.placeMarkerColor;
          
          savedPlaces.value.push({
            name,
            lon: coords[0],
            lat: coords[1],
            icon,
            color,
          });
          addMarker(coords[0], coords[1], name, color);
          placesImported++;
        } else if (geom?.getType() === 'LineString') {
          // Import route
          const lineGeom = geom as LineString;
          const coords = lineGeom.getCoordinates().map((c: number[]) => toLonLat(c));
          const name = feature.get('name') || 'Imported Route';
          const props = feature.get('properties') || {};
          
          // Create saved route
          const newRoute: SavedRoute = {
            id: generateId(),
            name,
            origin: props.start || { name: 'Start', address: '', lon: coords[0][0], lat: coords[0][1] },
            destination: props.destination || { name: 'End', address: '', lon: coords[coords.length - 1][0], lat: coords[coords.length - 1][1] },
            stops: props.stops || [],
            distance: props.distance || '',
            duration: props.duration || '',
            coordinates: coords,
          };
          savedRoutes.value.push(newRoute);
          
          // Draw route on map
          const routeFeature = new Feature({
            geometry: new LineString(lineGeom.getCoordinates()),
            type: 'route',
          });
          routeFeature.setStyle(
            new Style({
              stroke: new Stroke({
                color: customization.value.routeColor,
                width: 4,
              }),
            })
          );
          routeSource?.addFeature(routeFeature);
          routesImported++;
        }
      });

      saveToLocalStorage();

      // Fit map to imported features
      if (map) {
        const allSources = [markersSource, routeSource].filter(Boolean) as VectorSource[];
        let hasFeatures = false;
        
        for (const source of allSources) {
          if (source.getFeatures().length > 0) {
            hasFeatures = true;
            const extent = source.getExtent();
            if (extent && extent[0] !== Infinity) {
              map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
              break;
            }
          }
        }
      }
      
      showStatus(`Imported ${placesImported} places and ${routesImported} routes`, 'success');
    } catch (error) {
      console.error('Failed to import GeoJSON:', error);
      showStatus('Failed to import GeoJSON file', 'error');
    }
  };
  reader.readAsText(file);

  // Reset input
  input.value = '';
}

// Handle map click
function handleMapClick(event: { coordinate: number[] }) {
  const coords = toLonLat(event.coordinate);
  const lon = coords[0];
  const lat = coords[1];
  
  if (searchMode.value === 'places') {
    // Add place from map click
    reverseGeocode(lon, lat).then((name) => {
      addMarker(lon, lat, name);
      savedPlaces.value.push({
        name,
        lon,
        lat,
        icon: '📍',
        color: customization.value.placeMarkerColor,
      });
      saveToLocalStorage();
      showStatus('Place added!', 'success');
    });
  } else if (searchMode.value === 'directions' && addStopMode.value) {
    // Add stop from map click
    reverseGeocode(lon, lat).then((name) => {
      const newStop: Stop = {
        id: generateId(),
        name,
        lon,
        lat,
      };
      stops.value.push(newStop);
      addDirectionMarker(lon, lat, 'stop', stops.value.length - 1);
      addStopMode.value = false;
      showStatus('Stop added!', 'success');
    });
  }
}

// Initialize map
onMounted(() => {
  loadFromLocalStorage();
  recordLastAccessed();

  if (mapContainer.value) {
    markersSource = new VectorSource();
    routeSource = new VectorSource();
    currentLocationSource = new VectorSource();

    map = new Map({
      target: mapContainer.value,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: routeSource,
        }),
        new VectorLayer({
          source: markersSource,
        }),
        new VectorLayer({
          source: currentLocationSource,
        }),
      ],
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 2,
      }),
    });

    // Load saved places onto map
    savedPlaces.value.forEach((place) => {
      addMarker(place.lon, place.lat, place.name, place.color);
    });
    
    // Add click handler
    map.on('click', handleMapClick);
  }
});

onUnmounted(() => {
  if (map) {
    map.setTarget(undefined);
    map = null;
  }
});
</script>

<style scoped>
.maps-page {
  display: flex;
  height: calc(100vh - 140px);
  margin: -2rem 0;
}

.maps-sidebar {
  width: 320px;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0;
}

.location-btn {
  font-size: 0.75rem;
}

.search-mode-toggle {
  display: flex;
  gap: 0.5rem;
}

.mode-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: var(--transition);
}

.mode-btn:hover {
  border-color: var(--color-primary);
}

.mode-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-section .input-group {
  margin-bottom: 0;
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
}

.input-with-button .input {
  flex: 1;
}

.use-location-btn {
  padding: 0.5rem 0.75rem;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.stops-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stops-section label {
  font-size: 0.875rem;
  font-weight: 500;
}

.stop-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-background);
  border-radius: var(--radius);
  font-size: 0.875rem;
}

.drag-handle {
  cursor: grab;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.stop-number {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f59e0b;
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: bold;
}

.stop-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-results {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  max-height: 200px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.search-result-item:hover {
  background: var(--color-background);
}

.search-result-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border);
}

.result-icon {
  font-size: 1.25rem;
}

.result-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.result-name {
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-address {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-info {
  padding: 0.75rem;
  background: var(--color-background);
}

.route-info h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.route-info p {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.saved-section {
  flex-shrink: 0;
}

.saved-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.saved-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.no-saved {
  text-align: center;
  padding: 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 150px;
  overflow-y: auto;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-background);
  border-radius: var(--radius);
  font-size: 0.875rem;
  cursor: pointer;
  transition: var(--transition);
}

.saved-item:hover {
  background: var(--color-border);
}

.saved-icon {
  font-size: 1rem;
}

.saved-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.remove-btn:hover {
  color: var(--color-error);
}

.geojson-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.export-options label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.select-sm {
  padding: 0.5rem;
  font-size: 0.875rem;
}

.geojson-buttons {
  display: flex;
  gap: 0.5rem;
}

.geojson-buttons .btn {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.875rem;
}

.import-label {
  text-align: center;
}

.customization-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.color-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.color-option label {
  font-size: 0.75rem;
}

.color-option input[type="color"] {
  width: 40px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  padding: 2px;
}

.maps-container {
  flex: 1;
  position: relative;
}

.map-element {
  width: 100%;
  height: 100%;
}

.map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.map-control-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow);
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.map-control-btn:hover {
  background: var(--color-background);
}

.map-control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.modal-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .maps-page {
    flex-direction: column;
  }

  .maps-sidebar {
    width: 100%;
    height: auto;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .maps-container {
    min-height: 400px;
  }
}

.status-message {
  padding: 0.75rem;
  border-radius: var(--radius);
  font-size: 0.875rem;
  text-align: center;
  margin-top: 0.5rem;
}

.status-message.success {
  background-color: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.status-message.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.mt-2 {
  margin-top: 0.5rem;
}
</style>
