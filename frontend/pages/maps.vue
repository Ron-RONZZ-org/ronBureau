<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="maps-page">
        <div class="maps-sidebar">
          <div class="sidebar-header">
            <h2>🗺️ Maps</h2>
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
          </div>

          <!-- Directions Search -->
          <div v-if="searchMode === 'directions'" class="search-section">
            <div class="input-group">
              <label for="origin">Origin</label>
              <input
                id="origin"
                v-model="originQuery"
                type="text"
                class="input"
                placeholder="Starting point..."
                @input="debouncedSearchOrigin"
              />
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
            </div>
          </div>

          <!-- Saved Places -->
          <div class="saved-section">
            <div class="saved-header">
              <h3>📌 Saved Places</h3>
              <button class="btn btn-outline btn-sm" @click="clearAllPlaces">Clear All</button>
            </div>
            <div v-if="savedPlaces.length === 0" class="no-saved">
              <p>No saved places yet</p>
            </div>
            <div v-else class="saved-list">
              <div
                v-for="(place, index) in savedPlaces"
                :key="index"
                class="saved-item"
              >
                <span class="saved-icon">📍</span>
                <span class="saved-name">{{ place.name }}</span>
                <button class="remove-btn" @click="removePlace(index)">×</button>
              </div>
            </div>
          </div>

          <!-- GeoJSON Import/Export -->
          <div class="geojson-section">
            <h3>📁 GeoJSON</h3>
            <div class="geojson-buttons">
              <button class="btn btn-outline" @click="exportGeoJSON">Export</button>
              <label class="btn btn-outline import-label">
                Import
                <input type="file" accept=".json,.geojson" @change="importGeoJSON" hidden />
              </label>
            </div>
          </div>

          <!-- Status Message -->
          <div v-if="statusMessage" class="status-message" :class="statusType">
            {{ statusMessage }}
          </div>
        </div>

        <div class="maps-container">
          <div ref="mapContainer" class="map-element"></div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import 'ol/ol.css';
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
}

interface RouteInfo {
  distance: string;
  duration: string;
}

const auth = useAuthStore();

onMounted(() => {
  auth.initFromStorage();
});

const mapContainer = ref<HTMLElement | null>(null);
let map: Map | null = null;
let markersSource: VectorSource | null = null;
let routeSource: VectorSource | null = null;

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

// Status message state
const statusMessage = ref('');
const statusType = ref<'success' | 'error' | ''>('');

// Saved places
const savedPlaces = ref<SavedPlace[]>([]);

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
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
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
function addMarker(lon: number, lat: number, name: string) {
  if (!markersSource) return;

  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    name: name,
    type: 'place',
  });

  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: '#3b82f6' }),
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

function addDirectionMarker(lon: number, lat: number, type: 'origin' | 'destination') {
  if (!markersSource) return;

  // Remove existing marker of same type
  const features = markersSource.getFeatures();
  features.forEach((f) => {
    if (f.get('type') === type) {
      markersSource?.removeFeature(f);
    }
  });

  const color = type === 'origin' ? '#22c55e' : '#ef4444';
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
    type: type,
  });

  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 10,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: type === 'origin' ? 'A' : 'B',
        fill: new Fill({ color: '#ffffff' }),
        font: 'bold 12px sans-serif',
      }),
    })
  );

  markersSource.addFeature(feature);
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
      console.warn('GraphHopper API key not configured. Please set GRAPHHOPPER_API_KEY environment variable.');
      return;
    }
    const url = `https://graphhopper.com/api/1/route?point=${origin.value.lat},${origin.value.lon}&point=${destination.value.lat},${destination.value.lon}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.paths && data.paths.length > 0) {
      const path = data.paths[0];
      const coordinates = path.points.coordinates.map((coord: [number, number]) =>
        fromLonLat(coord)
      );

      // Draw route on map
      const routeFeature = new Feature({
        geometry: new LineString(coordinates),
        type: 'route',
      });

      routeFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#3b82f6',
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
  } finally {
    isLoadingRoute.value = false;
  }
}

// Remove saved place
function removePlace(index: number) {
  savedPlaces.value.splice(index, 1);
  saveToLocalStorage();
  refreshMarkersFromSaved();
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
    addMarker(place.lon, place.lat, place.name);
  });
}

// LocalStorage persistence
function saveToLocalStorage() {
  if (import.meta.client) {
    localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces.value));
  }
}

function loadFromLocalStorage() {
  if (import.meta.client) {
    const saved = localStorage.getItem('savedPlaces');
    if (saved) {
      try {
        savedPlaces.value = JSON.parse(saved);
      } catch {
        savedPlaces.value = [];
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

  // Add saved places
  savedPlaces.value.forEach((place) => {
    const feature = new Feature({
      geometry: new Point([place.lon, place.lat]),
      name: place.name,
      type: 'place',
    });
    features.push(feature);
  });

  // Add route if exists
  if (routeSource) {
    const routeFeatures = routeSource.getFeatures();
    features.push(...routeFeatures);
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

      // Process imported features
      features.forEach((feature) => {
        const geom = feature.getGeometry();
        if (geom?.getType() === 'Point') {
          const coords = toLonLat((geom as Point).getCoordinates());
          const name = feature.get('name') || 'Imported Place';
          savedPlaces.value.push({
            name,
            lon: coords[0],
            lat: coords[1],
          });
          addMarker(coords[0], coords[1], name);
        } else if (geom?.getType() === 'LineString') {
          // Import route
          const routeFeature = new Feature({
            geometry: geom,
            type: 'route',
          });
          routeFeature.setStyle(
            new Style({
              stroke: new Stroke({
                color: '#3b82f6',
                width: 4,
              }),
            })
          );
          routeSource?.addFeature(routeFeature);
        }
      });

      saveToLocalStorage();

      // Fit map to imported features
      if (map && (markersSource?.getFeatures().length || routeSource?.getFeatures().length)) {
        const extent = markersSource?.getExtent();
        if (extent && extent[0] !== Infinity) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
        }
      }
    } catch (error) {
      console.error('Failed to import GeoJSON:', error);
      showStatus('Failed to import GeoJSON file', 'error');
    }
  };
  reader.readAsText(file);

  // Reset input
  input.value = '';
}

// Initialize map
onMounted(() => {
  loadFromLocalStorage();
  recordLastAccessed();

  if (mapContainer.value) {
    markersSource = new VectorSource();
    routeSource = new VectorSource();

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
      ],
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 2,
      }),
    });

    // Load saved places onto map
    savedPlaces.value.forEach((place) => {
      addMarker(place.lon, place.lat, place.name);
    });
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

.sidebar-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
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
  flex: 1;
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
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--color-background);
  border-radius: var(--radius);
  font-size: 0.875rem;
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

.maps-container {
  flex: 1;
  position: relative;
}

.map-element {
  width: 100%;
  height: 100%;
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
</style>
