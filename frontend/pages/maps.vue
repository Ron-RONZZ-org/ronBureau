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
          
          <div v-if="vectorTilesAvailable || (useVectorTiles && vectorTileProvider)" class="vector-tiles-status">
            <!-- MapTiler Style Selector (visible when MapTiler key available) -->
            <div v-if="vectorTilesAvailable" class="sidebar-style-selector">
              <label for="maptiler-style">Map Style:</label>
              <select id="maptiler-style" v-model="maptilerStyle" @change="onMapStyleChange" class="select select-sm">
                <option v-for="style in maptilerStyles" :key="style.id" :value="style.id">
                  {{ style.name }}
                </option>
              </select>
            </div>
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
            <!-- Route Profile Selector -->
            <div class="route-profile-selector">
              <label>Route Type:</label>
              <div class="profile-buttons">
                <button 
                  class="profile-btn" 
                  :class="{ active: routeProfile === 'car' }"
                  @click="routeProfile = 'car'"
                  title="Car"
                >🚗 Car</button>
                <button 
                  class="profile-btn" 
                  :class="{ active: routeProfile === 'bike' }"
                  @click="routeProfile = 'bike'"
                  title="Bike"
                >🚴 Bike</button>
                <button 
                  class="profile-btn" 
                  :class="{ active: routeProfile === 'foot' }"
                  @click="routeProfile = 'foot'"
                  title="Walking"
                >🚶 Walk</button>
              </div>
            </div>

            <div class="input-group">
              <label for="origin">Origin</label>
              <div class="input-with-actions">
                <input
                  id="origin"
                  v-model="originQuery"
                  type="text"
                  class="input"
                  :class="{ 'pick-mode': pickPointMode === 'origin' }"
                  placeholder="Starting point..."
                  @input="debouncedSearchOrigin"
                  @focus="focusedField = 'origin'"
                  @blur="handleFieldBlur"
                />
                <button 
                  v-if="originQuery" 
                  class="clear-input-btn" 
                  @click="clearOrigin" 
                  title="Clear"
                >×</button>
              </div>
              <!-- Unified action buttons - shown on focus -->
              <div v-if="focusedField === 'origin'" class="field-action-buttons" @mouseenter="isMouseOverActionButtons = true" @mouseleave="isMouseOverActionButtons = false" @mousedown.prevent>
                <button class="action-btn-sm" @click.prevent="useCurrentLocationFor('origin')" :disabled="isGettingLocation" title="Use my location">
                  📍 My Location
                </button>
                <button class="action-btn-sm" :class="{ active: pickPointMode === 'origin' }" @click.prevent="togglePickPoint('origin')" title="Pick point on map">
                  🗺️ Pick on Map
                </button>
                <button class="action-btn-sm" @click.prevent="showSavedPlacesModal('origin')" title="Pick from saved places">
                  📌 Saved
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
            <div class="stops-section">
              <div class="stops-header">
                <label>Stops</label>
              </div>
              <div class="input-group">
                <div class="input-with-actions">
                  <input
                    v-model="stopQuery"
                    type="text"
                    class="input"
                    :class="{ 'pick-mode': pickPointMode === 'stop' }"
                    placeholder="Add a stop..."
                    @input="debouncedSearchStop"
                    @keyup.enter="addStopFromSearch"
                    @focus="focusedField = 'stop'"
                    @blur="handleFieldBlur"
                  />
                  <button 
                    v-if="stopQuery" 
                    class="clear-input-btn" 
                    @click="stopQuery = ''; stopResults = [];" 
                    title="Clear"
                  >×</button>
                </div>
                <!-- Unified action buttons - shown on focus -->
                <div v-if="focusedField === 'stop'" class="field-action-buttons" @mouseenter="isMouseOverActionButtons = true" @mouseleave="isMouseOverActionButtons = false" @mousedown.prevent>
                  <button class="action-btn-sm" @click.prevent="useCurrentLocationFor('stop')" :disabled="isGettingLocation" title="Use my location">
                    📍 My Location
                  </button>
                  <button class="action-btn-sm" :class="{ active: pickPointMode === 'stop' }" @click.prevent="togglePickPoint('stop')" title="Pick point on map">
                    🗺️ Pick on Map
                  </button>
                  <button class="action-btn-sm" @click.prevent="showSavedPlacesModal('stop')" title="Pick from saved places">
                    📌 Saved
                  </button>
                </div>
              </div>
              <div v-if="stopResults.length > 0 && showStopResults" class="search-results">
                <div
                  v-for="(result, index) in stopResults"
                  :key="index"
                  class="search-result-item"
                  @click="selectStop(result)"
                >
                  <span class="result-icon">🟡</span>
                  <div class="result-info">
                    <span class="result-name">{{ result.name }}</span>
                    <span class="result-address">{{ result.address }}</span>
                  </div>
                </div>
              </div>
              <div v-if="stops.length > 0" class="stops-list">
                <div 
                  v-for="(stop, index) in stops" 
                  :key="stop.id"
                  class="stop-item"
                >
                  <div class="stop-reorder-controls">
                    <button 
                      class="reorder-btn" 
                      @click="moveStopUp(index)" 
                      :disabled="index === 0"
                      title="Move up"
                    >▲</button>
                    <button 
                      class="reorder-btn" 
                      @click="moveStopDown(index)" 
                      :disabled="index === stops.length - 1"
                      title="Move down"
                    >▼</button>
                  </div>
                  <span class="stop-number">{{ index + 1 }}</span>
                  <span class="stop-name">{{ stop.name }}</span>
                  <button class="remove-btn" @click="removeStop(index)">×</button>
                </div>
              </div>
            </div>

            <div class="input-group">
              <label for="destination">Destination</label>
              <div class="input-with-actions">
                <input
                  id="destination"
                  v-model="destinationQuery"
                  type="text"
                  class="input"
                  :class="{ 'pick-mode': pickPointMode === 'destination' }"
                  placeholder="Destination..."
                  @input="debouncedSearchDestination"
                  @focus="focusedField = 'destination'"
                  @blur="handleFieldBlur"
                />
                <button 
                  v-if="destinationQuery" 
                  class="clear-input-btn" 
                  @click="clearDestination" 
                  title="Clear"
                >×</button>
              </div>
              <!-- Unified action buttons - shown on focus -->
              <div v-if="focusedField === 'destination'" class="field-action-buttons" @mouseenter="isMouseOverActionButtons = true" @mouseleave="isMouseOverActionButtons = false" @mousedown.prevent>
                <button class="action-btn-sm" @click.prevent="useCurrentLocationFor('destination')" :disabled="isGettingLocation" title="Use my location">
                  📍 My Location
                </button>
                <button class="action-btn-sm" :class="{ active: pickPointMode === 'destination' }" @click.prevent="togglePickPoint('destination')" title="Pick point on map">
                  🗺️ Pick on Map
                </button>
                <button class="action-btn-sm" @click.prevent="showSavedPlacesModal('destination')" title="Pick from saved places">
                  📌 Saved
                </button>
              </div>
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
              <p><strong>Profile:</strong> {{ routeProfile === 'car' ? '🚗 Car' : routeProfile === 'bike' ? '🚴 Bike' : '🚶 Walk' }}</p>
              <div class="route-actions">
                <button class="btn btn-outline btn-sm" @click="saveCurrentRoute">
                  💾 Save
                </button>
                <button class="btn btn-outline btn-sm" @click="clearCurrentRoute">
                  🗑️ Clear
                </button>
              </div>
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
                :key="place.id || index"
                class="saved-item"
                @click="goToPlace(place)"
              >
                <span class="saved-icon" :style="{ color: place.color || customization.placeMarkerColor }">{{ place.icon || '📍' }}</span>
                <span class="saved-name">{{ place.name }}</span>
                <button class="edit-btn" @click.stop="editPlace(place, index)" title="Edit place">✏️</button>
                <button class="remove-btn" @click.stop="removePlace(index)">×</button>
              </div>
            </div>
            <!-- Manage Lists Button -->
            <button class="btn btn-outline btn-sm w-full mt-2" @click="showPlaceListsModal = true">
              📋 Manage Lists
            </button>
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
                :key="route.id || index"
                class="saved-item"
                @click="loadRoute(route)"
              >
                <span class="saved-icon">🛤️</span>
                <span class="saved-name">{{ route.name }}</span>
                <button class="edit-btn" @click.stop="editRoute(route, index)" title="Edit route">✏️</button>
                <button class="remove-btn" @click.stop="removeRoute(index)">×</button>
              </div>
            </div>
            <!-- Manage Lists Button -->
            <button class="btn btn-outline btn-sm w-full mt-2" @click="showRouteListsModal = true">
              📋 Manage Lists
            </button>
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
              <button class="btn btn-outline" @click="exportGPX">📍 GPX</button>
              <button class="btn btn-outline" @click="openPdfExportModal">📑 PDF Map</button>
            </div>
            <div class="geojson-buttons mt-2">
              <label class="btn btn-outline import-label w-full">
                📥 Import GeoJSON/GPX
                <input type="file" accept=".json,.geojson,.gpx" @change="importFile" hidden />
              </label>
            </div>
          </div>

          <!-- Customization Section -->
          <div class="customization-section">
            <div class="customization-header">
              <h3>🎨 Customization</h3>
              <button class="btn btn-outline btn-sm" @click="showPreferencesModal = true" title="Open preferences">⚙️</button>
            </div>
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
            <button 
              class="map-control-btn" 
              @click="useVectorTiles = !useVectorTiles; toggleVectorTiles()" 
              :title="useVectorTiles ? 'Switch to Raster Tiles' : 'Switch to Vector Tiles'"
              :class="{ 'active': useVectorTiles }"
            >
              {{ useVectorTiles ? '🗺️' : '🌐' }}
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
              <label for="pdf-size">Page Size</label>
              <select id="pdf-size" v-model="pdfOptions.pageSize" class="select">
                <option value="a4">A4</option>
                <option value="a3">A3</option>
              </select>
            </div>
            <div class="input-group">
              <label for="pdf-scale">Scale</label>
              <select id="pdf-scale" v-model="pdfOptions.scale" class="select">
                <option value="auto">Auto (fit to page)</option>
                <option value="custom">Current View</option>
              </select>
            </div>
            <div class="input-group">
              <label for="pdf-export-type">Export Content</label>
              <select id="pdf-export-type" v-model="pdfOptions.exportContent" class="select">
                <option value="both">Both (Places & Routes)</option>
                <option value="places">Places Only</option>
                <option value="routes">Routes Only</option>
              </select>
            </div>
            <div class="checkbox-group">
              <label><input type="checkbox" v-model="pdfOptions.showLegend" /> Show Legend</label>
              <label><input type="checkbox" v-model="pdfOptions.showScaleBar" /> Show Scale Bar</label>
              <label><input type="checkbox" v-model="pdfOptions.showNorthPointer" /> Show North Pointer</label>
            </div>
            <div class="checkbox-group">
              <label><input type="checkbox" v-model="pdfOptions.vectorExport" /> <strong>🎯 Vector Export (SVG→PDF)</strong></label>
              <p style="font-size: 0.85em; color: #64748b; margin: 0.25rem 0 0 1.5rem;">Higher quality, sharp text/lines at any zoom level</p>
            </div>
            <div v-if="pdfOptions.vectorExport" class="checkbox-group" style="margin-left: 1.5rem; padding-left: 1rem; border-left: 2px solid #e2e8f0;">
              <div v-if="vectorTilesAvailable">
                <label><input type="checkbox" v-model="pdfOptions.useVectorBasemap" /> <strong>Use vector basemap</strong> (⏱️ longer export time)</label>
                <p style="font-size: 0.85em; color: #64748b; margin: 0.25rem 0 0 1.5rem;">
                  {{ useVectorTiles && vectorTileProvider ? `Currently using ${vectorTileProvider === 'maptiler' ? 'MapTiler' : 'OpenFreeMap'} vector tiles` : 'Will enable MapTiler vector tiles for export' }}
                </p>
              </div>
              <div v-if="!pdfOptions.useVectorBasemap">
                <label style="margin-top: 0.5rem;"><input type="checkbox" v-model="pdfOptions.includeBasemap" /> Include Basemap (as raster)</label>
                <p style="font-size: 0.85em; color: #64748b; margin: 0.25rem 0 0 1.5rem;">Places & routes will be vector, basemap will be raster</p>
              </div>
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showPdfExportModal = false">Cancel</button>
              <button class="btn btn-primary" @click="exportPdfMap">Export PDF</button>
            </div>
          </div>
        </div>

        <!-- User Preferences Modal -->
        <div v-if="showPreferencesModal" class="modal-overlay" @click.self="showPreferencesModal = false">
          <div class="modal-content">
            <h3>⚙️ Map Preferences</h3>
            <p class="modal-description">Set your default map preferences. These will be saved and restored when you visit the maps page.</p>
            <div class="color-option">
              <label>Default Place Marker Color:</label>
              <input type="color" v-model="preferencesForm.placeMarkerColor" />
            </div>
            <div class="color-option">
              <label>Default Route Color:</label>
              <input type="color" v-model="preferencesForm.routeColor" />
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showPreferencesModal = false">Cancel</button>
              <button class="btn btn-primary" @click="savePreferences" :disabled="isSavingPreferences">
                {{ isSavingPreferences ? 'Saving...' : 'Save Preferences' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Place Modal -->
        <div v-if="showEditPlaceModal" class="modal-overlay" @click.self="showEditPlaceModal = false">
          <div class="modal-content">
            <h3>✏️ Edit Place</h3>
            <div class="input-group">
              <label for="edit-place-name">Name</label>
              <input id="edit-place-name" v-model="editPlaceForm.name" type="text" class="input" placeholder="Place name..." />
            </div>
            <div class="color-option">
              <label>Icon:</label>
              <select v-model="editPlaceForm.icon" class="select select-sm">
                <option value="📍">📍 Pin</option>
                <option value="⭐">⭐ Star</option>
                <option value="🏠">🏠 Home</option>
                <option value="🏢">🏢 Building</option>
                <option value="🎯">🎯 Target</option>
                <option value="❤️">❤️ Heart</option>
                <option value="🔵">🔵 Blue</option>
                <option value="🔴">🔴 Red</option>
              </select>
            </div>
            <div class="color-option">
              <label>Color:</label>
              <input type="color" v-model="editPlaceForm.color" />
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showEditPlaceModal = false">Cancel</button>
              <button class="btn btn-primary" @click="saveEditedPlace">Save</button>
            </div>
          </div>
        </div>

        <!-- Edit Route Modal -->
        <div v-if="showEditRouteModal" class="modal-overlay" @click.self="showEditRouteModal = false">
          <div class="modal-content">
            <h3>✏️ Edit Route</h3>
            <div class="input-group">
              <label for="edit-route-name">Name</label>
              <input id="edit-route-name" v-model="editRouteForm.name" type="text" class="input" placeholder="Route name..." />
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showEditRouteModal = false">Cancel</button>
              <button class="btn btn-primary" @click="saveEditedRoute">Save</button>
            </div>
          </div>
        </div>

        <!-- Saved Places Picker Modal -->
        <div v-if="showSavedPlacesPickerModal" class="modal-overlay" @click.self="showSavedPlacesPickerModal = false">
          <div class="modal-content">
            <h3>📌 Select a Saved Place</h3>
            <div v-if="savedPlaces.length === 0" class="no-saved">
              <p>No saved places available</p>
            </div>
            <div v-else class="picker-list">
              <div
                v-for="(place, index) in savedPlaces"
                :key="place.id || index"
                class="picker-item"
                @click="selectSavedPlaceFor(place)"
              >
                <span class="saved-icon" :style="{ color: place.color || customization.placeMarkerColor }">{{ place.icon || '📍' }}</span>
                <span class="saved-name">{{ place.name }}</span>
              </div>
            </div>
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showSavedPlacesPickerModal = false">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Place Lists Management Modal -->
        <div v-if="showPlaceListsModal" class="modal-overlay" @click.self="showPlaceListsModal = false">
          <div class="modal-content modal-large">
            <h3>📋 Manage Place Lists</h3>
            <p class="modal-description">Organize your places into named lists (e.g., "Delivery Mondays", "worktrip 12-12-2025")</p>
            
            <div class="list-search-form">
              <input 
                v-model="placeListSearchQuery" 
                type="text" 
                class="input" 
                placeholder="Search lists..."
              />
            </div>
            
            <div v-if="filteredPlaceLists.length === 0" class="no-saved">
              <p>{{ placeLists.length === 0 ? 'No place lists yet.' : 'No matching lists found.' }}</p>
            </div>
            <div v-else class="lists-container">
              <div 
                v-for="list in filteredPlaceLists" 
                :key="list.id" 
                class="list-item"
              >
                <div class="list-header">
                  <span class="list-name">{{ list.name }}</span>
                  <span class="list-count">{{ list.places?.length || 0 }} places</span>
                  <button class="edit-btn" @click="editPlaceListName(list)" title="Rename">✏️</button>
                  <button class="remove-btn" @click="deletePlaceList(list.id)">×</button>
                </div>
                <div v-if="list.places?.length > 0" class="list-items-preview">
                  <span v-for="place in list.places.slice(0, 3)" :key="place.id" class="preview-item">
                    {{ place.icon || '📍' }} {{ place.name }}
                  </span>
                  <span v-if="list.places.length > 3" class="preview-more">+{{ list.places.length - 3 }} more</span>
                </div>
                <button class="btn btn-outline btn-sm" @click="loadPlaceList(list)">Load</button>
              </div>
            </div>
            
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showPlaceListsModal = false">Close</button>
              <button class="btn btn-primary" @click="saveCurrentPlacesToList" :disabled="savedPlaces.length === 0">
                💾 Save Current Places to New List
              </button>
            </div>
          </div>
        </div>

        <!-- Route Lists Management Modal -->
        <div v-if="showRouteListsModal" class="modal-overlay" @click.self="showRouteListsModal = false">
          <div class="modal-content modal-large">
            <h3>📋 Manage Route Lists</h3>
            <p class="modal-description">Organize your routes into named lists (e.g., "Delivery Mondays", "worktrip 12-12-2025")</p>
            
            <div class="list-search-form">
              <input 
                v-model="routeListSearchQuery" 
                type="text" 
                class="input" 
                placeholder="Search lists..."
              />
            </div>
            
            <div v-if="filteredRouteLists.length === 0" class="no-saved">
              <p>{{ routeLists.length === 0 ? 'No route lists yet.' : 'No matching lists found.' }}</p>
            </div>
            <div v-else class="lists-container">
              <div 
                v-for="list in filteredRouteLists" 
                :key="list.id" 
                class="list-item"
              >
                <div class="list-header">
                  <span class="list-name">{{ list.name }}</span>
                  <span class="list-count">{{ list.routes?.length || 0 }} routes</span>
                  <button class="edit-btn" @click="editRouteListName(list)" title="Rename">✏️</button>
                  <button class="remove-btn" @click="deleteRouteList(list.id)">×</button>
                </div>
                <div v-if="list.routes?.length > 0" class="list-items-preview">
                  <span v-for="route in list.routes.slice(0, 3)" :key="route.id" class="preview-item">
                    🛤️ {{ route.name }}
                  </span>
                  <span v-if="list.routes.length > 3" class="preview-more">+{{ list.routes.length - 3 }} more</span>
                </div>
                <button class="btn btn-outline btn-sm" @click="loadRouteList(list)">Load</button>
              </div>
            </div>
            
            <div class="modal-buttons">
              <button class="btn btn-outline" @click="showRouteListsModal = false">Close</button>
              <button class="btn btn-primary" @click="saveCurrentRoutesToList" :disabled="savedRoutes.length === 0">
                💾 Save Current Routes to New List
              </button>
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
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorSource from 'ol/source/Vector';
import VectorTileSource from 'ol/source/VectorTile';
import OSM from 'ol/source/OSM';
import MVT from 'ol/format/MVT';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Point, LineString } from 'ol/geom';
import Feature from 'ol/Feature';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { getDistance } from 'ol/sphere';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { apply as applyStyle } from 'ol-mapbox-style';

const config = useRuntimeConfig();

interface PlaceResult {
  name: string;
  address: string;
  lon: number;
  lat: number;
}

interface SavedPlace {
  id?: string;
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
const stopQuery = ref('');
const stopResults = ref<PlaceResult[]>([]);
const showStopResults = ref(false);

// Pick point mode
const pickPointMode = ref<'origin' | 'stop' | 'destination' | null>(null);

// Focused field for showing action buttons
const focusedField = ref<'origin' | 'stop' | 'destination' | null>(null);

// Route profile (car/bike/foot)
const routeProfile = ref<'car' | 'bike' | 'foot'>('car');

// Saved places picker modal
const showSavedPlacesPickerModal = ref(false);
const savedPlacesPickerTarget = ref<'origin' | 'stop' | 'destination' | null>(null);

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
  pageSize: 'a4' as 'a4' | 'a3',
  scale: 'auto',
  exportContent: 'both' as 'both' | 'places' | 'routes',
  showLegend: true,
  showScaleBar: true,
  showNorthPointer: true,
  vectorExport: false, // New: use SVG vector export instead of raster
  includeBasemap: true, // New: include basemap in vector export (as raster)
  useVectorBasemap: false, // New: user choice to use vector basemap (longer export time)
});

// Vector tiles state
const useVectorTiles = ref(false);
const vectorTileProvider = ref<'maptiler' | 'openfreemap' | null>(null);
const maptilerStyle = ref<string>('basic-v2'); // Selected MapTiler style
let vectorTileLayer: VectorTileLayer | null = null;

// Available MapTiler styles / tilesets (extracted from temp.html)
const maptilerStyles = [
    { id: 'basic-v2', name: '🗺️ Basic', description: 'Simple clean style (MapTiler built-in)' },
  { id: 'streets-v2', name: '🛣️ Streets', description: 'Detailed streets (MapTiler built-in)' },
  { id: 'topo-v2', name: '📐 Topo', description: 'Topographic map (MapTiler built-in)' },
  { id: 'dataviz', name: '📊 DataViz', description: 'Data visualization (MapTiler built-in)' },
  { id: 'winter-v2', name: '❄️ Winter', description: 'Winter theme (MapTiler built-in)' },
  { id: 'buildings', name: 'Buildings', description: 'z12-15 | vector' },
  { id: 'contours-v2', name: 'Contours v2', description: 'z9-14 | vector' },
  { id: 'countries', name: 'Countries', description: 'z0-11 | vector' },
  { id: 'hand-drawn-hillshade', name: 'Hand drawn hillshade', description: 'z0-9 | raster' },
  { id: 'hillshade', name: 'Hillshade', description: 'z0-12 | raster' },
  { id: 'land', name: 'Land', description: 'z0-14 | vector' },
  { id: 'land-gradient', name: 'Land Gradient', description: 'z0-4 | raster' },
  { id: 'land-gradient-dark', name: 'Land Gradient Dark', description: 'z0-4 | raster' },
  { id: 'landcover', name: 'Landcover', description: 'z0-9 | vector' },
  { id: 'landform', name: 'Landform', description: 'z7-14 | vector' },
  { id: 'v3-lite', name: 'MapTiler Planet Lite v3', description: 'z0-10 | vector' },
  { id: 'v3', name: 'MapTiler Planet v3', description: 'z0-15 | vector (deprecated)' },
  { id: 'v4', name: 'MapTiler Planet v4', description: 'z0-15 | vector' },
  { id: 'ocean', name: 'Ocean', description: 'z0-12 | vector' },
  { id: 'ocean-rgb', name: 'Ocean RGB', description: 'z0-7 | raster-dem' },
  { id: 'v3-openmaptiles', name: 'OpenMapTiles', description: 'z0-14 | vector' },
  { id: 'outdoor', name: 'Outdoor', description: 'z5-14 | vector' },
  { id: 'satellite-v2', name: 'Satellite v2', description: 'z0-22 | raster' },
  { id: 'satellite-mediumres', name: 'Satellite Mediumres 2016', description: 'z0-13 | raster' },
  { id: 'satellite-mediumres-2018', name: 'Satellite Mediumres 2018', description: 'z0-13 | raster' },
  { id: 'terrain-quantized-mesh-v2', name: 'Terrain 3D (quantized mesh)', description: 'z0-15 | terrain' },
  { id: 'terrain-rgb-v2', name: 'Terrain RGB', description: 'z0-14 | raster-dem' },
  { id: 'fr-cadastre', name: 'France cadastre', description: 'z11-16 | vector' },
  { id: 'jp-forest', name: 'JP Forest', description: 'z0-12 | raster' },
  { id: 'jp-gsi-building', name: 'JP GSI Building', description: 'z13-15 | vector' },
  { id: 'jp-hillshade', name: 'JP Hillshade', description: 'z0-15 | raster' },
  { id: 'jp-mierune', name: 'JP MIERUNE OpenMapTiles', description: 'z0-15 | vector' },
  { id: 'nl-cartiqo', name: 'NL Cartiqo', description: 'z0-16 | vector' },
  { id: 'nl-topraster', name: 'NL PDOK TOPraster', description: 'z5-16 | raster' },
  { id: 'ch-swisstopo-lbm', name: 'CH Swisstopo LBM', description: 'z0-14 | vector' },
  { id: 'cadastre', name: 'Cadastre BETA', description: 'z0-17 | vector' },
  { id: 'uk-baire250k1940', name: 'UK Bartholomew Ireland 1940s', description: 'z5-12 | raster' },
  { id: 'uk-osgb25k1937', name: 'UK OSGB 1937', description: 'z1-16 | raster' },
  { id: 'uk-osgb1888', name: 'UK OSGB 1888', description: 'z1-17 | raster' },
  { id: 'uk-osgb63k1955', name: 'UK OSGB 63k 1955', description: 'z1-15 | raster' },
  { id: 'uk-osgb63k1885', name: 'UK OSGB 63k 1885', description: 'z1-16 | raster' },
  { id: 'uk-osgb10k1888', name: 'UK OSGB 10k 1888', description: 'z1-17 | raster' },
  { id: 'uk-oslondon1k1893', name: 'UK OS London 1893', description: 'z9-20 | raster' },
  { id: 'uk-openzoomstack', name: 'UK Open Zoomstack', description: 'z0-14 | vector' },
  { id: 'uk-osgb1919', name: 'UK OSGB 1919', description: 'z1-14 | raster' }
];

// Location state
const isGettingLocation = ref(false);
const currentLocation = ref<{ lon: number; lat: number } | null>(null);

// Customization options
const customization = ref({
  placeMarkerColor: '#ef4444', // default red
  routeColor: '#22c55e', // default green
});

// User Preferences Modal
const showPreferencesModal = ref(false);
const isSavingPreferences = ref(false);
const preferencesForm = ref({
  placeMarkerColor: '#ef4444',
  routeColor: '#22c55e',
});

// Edit Place Modal
const showEditPlaceModal = ref(false);
const editPlaceIndex = ref<number | null>(null);
const editPlaceForm = ref({
  name: '',
  icon: '📍',
  color: '#ef4444',
});

// Edit Route Modal
const showEditRouteModal = ref(false);
const editRouteIndex = ref<number | null>(null);
const editRouteForm = ref({
  name: '',
});

// Place Lists Modal
const showPlaceListsModal = ref(false);
const placeLists = ref<{ id: string; name: string; description?: string; places?: SavedPlace[] }[]>([]);
const newPlaceListName = ref('');

// Route Lists Modal
const showRouteListsModal = ref(false);
const routeLists = ref<{ id: string; name: string; description?: string; routes?: SavedRoute[] }[]>([]);
const newRouteListName = ref('');

// Search queries for list modals
const placeListSearchQuery = ref('');
const routeListSearchQuery = ref('');

// Computed filtered lists based on search
const filteredPlaceLists = computed(() => {
  if (!placeListSearchQuery.value.trim()) return placeLists.value;
  const query = placeListSearchQuery.value.toLowerCase();
  return placeLists.value.filter(list => list.name.toLowerCase().includes(query));
});

const filteredRouteLists = computed(() => {
  if (!routeListSearchQuery.value.trim()) return routeLists.value;
  const query = routeListSearchQuery.value.toLowerCase();
  return routeLists.value.filter(list => list.name.toLowerCase().includes(query));
});

// Check if vector tiles are available (MapTiler key exists)
const vectorTilesAvailable = computed(() => {
  const maptilerKey = config.public.maptilerApiKey;
  return maptilerKey && maptilerKey !== 'get_your_free_key_at_https://maptiler.com' && maptilerKey.length > 10;
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

// Handle field blur with delay to allow button clicks
const FIELD_BLUR_DELAY = 3000; // ms delay before hiding field action buttons

// Track if mouse is over action buttons
const isMouseOverActionButtons = ref(false);

function handleFieldBlur() {
  setTimeout(() => {
    // Only hide if mouse is not over action buttons
    if (!isMouseOverActionButtons.value) {
      focusedField.value = null;
    }
  }, FIELD_BLUR_DELAY);
}

// Round a value to the nearest 10
function roundToNearest10(value: number): number {
  const rounded = Math.round(value / 10) * 10;
  return rounded === 0 ? Math.round(value) : rounded;
}

// PDF export scaling constants
const PDF_EXPORT_MIN_SCALE = 1; // Minimum scale factor for PDF export (increased for better label readability)
const PDF_EXPORT_MAX_SCALE = 3; // Maximum scale factor for PDF export (increased for crisp text)
const PDF_EXPORT_ZOOM_DIVISOR = 3; // Divide zoom level by this to get base scale (adjusted for better quality)

// Clear origin field
function clearOrigin() {
  if (routeInfo.value) {
    // Route already calculated, ask user
    showClearRouteConfirm('origin');
  } else {
    originQuery.value = '';
    origin.value = null;
    originResults.value = [];
    showOriginResults.value = false;
    // Remove origin marker
    if (markersSource) {
      const features = markersSource.getFeatures();
      features.forEach((f) => {
        if (f.get('type') === 'origin') {
          markersSource?.removeFeature(f);
        }
      });
    }
  }
}

// Clear destination field
function clearDestination() {
  if (routeInfo.value) {
    // Route already calculated, ask user
    showClearRouteConfirm('destination');
  } else {
    destinationQuery.value = '';
    destination.value = null;
    destinationResults.value = [];
    showDestinationResults.value = false;
    // Remove destination marker
    if (markersSource) {
      const features = markersSource.getFeatures();
      features.forEach((f) => {
        if (f.get('type') === 'destination') {
          markersSource?.removeFeature(f);
        }
      });
    }
  }
}

// Show clear route confirmation
function showClearRouteConfirm(field: 'origin' | 'destination') {
  const saveRoute = confirm('A route is currently displayed. Would you like to save it before clearing?\n\nClick OK to save the route, or Cancel to just clear it.');
  if (saveRoute) {
    saveCurrentRoute();
  }
  // Clear the route
  clearCurrentRoute();
  // Now clear the field
  if (field === 'origin') {
    originQuery.value = '';
    origin.value = null;
    originResults.value = [];
  } else {
    destinationQuery.value = '';
    destination.value = null;
    destinationResults.value = [];
  }
}

// Clear current route from map
function clearCurrentRoute() {
  if (routeSource) {
    routeSource.clear();
  }
  routeInfo.value = null;
  currentRouteCoordinates.value = [];
  // Clear markers but keep origin/destination if set
  if (markersSource) {
    const features = markersSource.getFeatures();
    features.forEach((f) => {
      const type = f.get('type');
      if (type === 'origin' || type === 'destination' || type === 'stop') {
        markersSource?.removeFeature(f);
      }
    });
  }
  // Clear stops
  stops.value = [];
  // Clear origin and destination
  origin.value = null;
  destination.value = null;
  originQuery.value = '';
  destinationQuery.value = '';
  showStatus('Route cleared', 'success');
}

// Open PDF export modal with synced export content
function openPdfExportModal() {
  // Sync export content with the export type from Export/Import section
  pdfOptions.value.exportContent = exportType.value;
  showPdfExportModal.value = true;
}

// Ensure MapTiler vector tiles are used for vector PDF export when API key is available
async function ensureMapTilerForVectorExport() {
  // Only enable vector tiles if user explicitly requested it
  if (!pdfOptions.value.useVectorBasemap) {
    return false;
  }
  
  try {
    const maptilerKey = config.public.maptilerApiKey;
    if (maptilerKey && maptilerKey !== 'get_your_free_key_at_https://maptiler.com' && maptilerKey.length > 10) {
      // Enable vector tiles and force MapTiler provider
      useVectorTiles.value = true;
      // Prefer not to include a raster basemap when full vector tiles are available
      pdfOptions.value.includeBasemap = false;
      await toggleVectorTiles();
      // Wait a bit for tiles/style to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      if (useVectorTiles.value && vectorTileProvider.value) {
        showStatus('✨ Using MapTiler vector tiles for vector PDF export', 'success');
        return true;
      }
    }
  } catch (e) {
    // ignore and fall back
  }
  return false;
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

// Use current location for origin/stop/destination
async function useCurrentLocationFor(target: 'origin' | 'stop' | 'destination') {
  isGettingLocation.value = true;
  try {
    const location = await getCurrentLocation();
    const place: PlaceResult = {
      name: 'My Location',
      address: `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
      lon: location.lon,
      lat: location.lat,
    };
    
    if (target === 'origin') {
      selectOrigin(place);
      showStatus('Using current location as origin', 'success');
    } else if (target === 'stop') {
      const newStop: Stop = {
        id: generateId(),
        name: place.name,
        lon: place.lon,
        lat: place.lat,
      };
      stops.value.push(newStop);
      addDirectionMarker(place.lon, place.lat, 'stop', stops.value.length - 1);
      showStatus('Stop added from current location', 'success');
    } else {
      selectDestination(place);
      showStatus('Using current location as destination', 'success');
    }
  } catch {
    showStatus('Could not get your location', 'error');
  } finally {
    isGettingLocation.value = false;
  }
}

// Toggle pick point on map mode
function togglePickPoint(target: 'origin' | 'stop' | 'destination') {
  if (pickPointMode.value === target) {
    pickPointMode.value = null;
  } else {
    pickPointMode.value = target;
    showStatus(`Click on the map to set ${target}`, 'success');
  }
}

// Show saved places modal for selection
function showSavedPlacesModal(target: 'origin' | 'stop' | 'destination') {
  savedPlacesPickerTarget.value = target;
  showSavedPlacesPickerModal.value = true;
}

// Select a saved place for origin/stop/destination
function selectSavedPlaceFor(place: SavedPlace) {
  const target = savedPlacesPickerTarget.value;
  if (!target) return;
  
  const placeResult: PlaceResult = {
    name: place.name,
    address: '',
    lon: place.lon,
    lat: place.lat,
  };
  
  if (target === 'origin') {
    selectOrigin(placeResult);
  } else if (target === 'stop') {
    const newStop: Stop = {
      id: generateId(),
      name: place.name,
      lon: place.lon,
      lat: place.lat,
    };
    stops.value.push(newStop);
    addDirectionMarker(place.lon, place.lat, 'stop', stops.value.length - 1);
  } else {
    selectDestination(placeResult);
  }
  
  showSavedPlacesPickerModal.value = false;
  savedPlacesPickerTarget.value = null;
  showStatus(`${place.name} selected as ${target}`, 'success');
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

const debouncedSearchStop = debounce(async () => {
  showStopResults.value = true;
  stopResults.value = await searchPlaces(stopQuery.value);
}, 300);

// Select stop from search results
function selectStop(place: PlaceResult) {
  const newStop: Stop = {
    id: generateId(),
    name: place.name,
    lon: place.lon,
    lat: place.lat,
  };
  stops.value.push(newStop);
  addDirectionMarker(place.lon, place.lat, 'stop', stops.value.length - 1);
  stopQuery.value = '';
  stopResults.value = [];
  showStopResults.value = false;
  showStatus('Stop added!', 'success');
}

// Add stop from search input on enter
function addStopFromSearch() {
  if (stopResults.value.length > 0) {
    selectStop(stopResults.value[0]);
  }
}

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
  pickPointMode.value = null;
  addDirectionMarker(place.lon, place.lat, 'origin');
}

function selectDestination(place: PlaceResult) {
  destination.value = place;
  destinationQuery.value = place.name;
  destinationResults.value = [];
  showDestinationResults.value = false;
  pickPointMode.value = null;
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

function moveStopUp(index: number) {
  if (index > 0) {
    const temp = stops.value[index];
    stops.value[index] = stops.value[index - 1];
    stops.value[index - 1] = temp;
    refreshStopMarkers();
  }
}

function moveStopDown(index: number) {
  if (index < stops.value.length - 1) {
    const temp = stops.value[index];
    stops.value[index] = stops.value[index + 1];
    stops.value[index + 1] = temp;
    refreshStopMarkers();
  }
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
      showStatus('Route service unavailable', 'error');
      return;
    }
    
    // Build points array with intermediary stops
    const points = [
      `point=${origin.value.lat},${origin.value.lon}`,
      ...stops.value.map(stop => `point=${stop.lat},${stop.lon}`),
      `point=${destination.value.lat},${destination.value.lon}`,
    ].join('&');
    
    // Use selected route profile (vehicle type)
    const url = `https://graphhopper.com/api/1/route?${points}&vehicle=${routeProfile.value}&locale=en&points_encoded=false&key=${apiKey}`;

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
  // Clear routes from map and redraw remaining
  if (routeSource) {
    routeSource.clear();
    // Redraw all remaining saved routes
    savedRoutes.value.forEach((route) => {
      if (route.coordinates.length > 0) {
        const projectedCoords = route.coordinates.map((coord: number[]) => fromLonLat(coord));
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
      }
    });
  }
  showStatus('Route removed', 'success');
}

// Edit place
function editPlace(place: SavedPlace, index: number) {
  editPlaceIndex.value = index;
  editPlaceForm.value = {
    name: place.name,
    icon: place.icon || '📍',
    color: place.color || customization.value.placeMarkerColor,
  };
  showEditPlaceModal.value = true;
}

function saveEditedPlace() {
  if (editPlaceIndex.value === null) return;
  
  const place = savedPlaces.value[editPlaceIndex.value];
  place.name = editPlaceForm.value.name;
  place.icon = editPlaceForm.value.icon;
  place.color = editPlaceForm.value.color;
  
  saveToLocalStorage();
  refreshMarkersFromSaved();
  showEditPlaceModal.value = false;
  editPlaceIndex.value = null;
  showStatus('Place updated!', 'success');
}

// Edit route
function editRoute(route: SavedRoute, index: number) {
  editRouteIndex.value = index;
  editRouteForm.value = {
    name: route.name,
  };
  showEditRouteModal.value = true;
}

function saveEditedRoute() {
  if (editRouteIndex.value === null) return;
  
  const route = savedRoutes.value[editRouteIndex.value];
  route.name = editRouteForm.value.name;
  
  saveToLocalStorage();
  showEditRouteModal.value = false;
  editRouteIndex.value = null;
  showStatus('Route updated!', 'success');
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
  // Clear routes from map view
  if (routeSource) {
    routeSource.clear();
  }
  // Also clear current route info
  currentRouteCoordinates.value = [];
  routeInfo.value = null;
  showStatus('All routes cleared', 'success');
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

// Load map preferences from API
async function loadMapPreferencesFromAPI() {
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    const response = await $fetch<{ placeMarkerColor?: string; routeColor?: string }>(
      `${config.public.apiBase}/maps/preferences`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );
    
    if (response.placeMarkerColor) {
      customization.value.placeMarkerColor = response.placeMarkerColor;
    }
    if (response.routeColor) {
      customization.value.routeColor = response.routeColor;
    }
    
    // Update the preferences form as well
    preferencesForm.value = {
      placeMarkerColor: customization.value.placeMarkerColor,
      routeColor: customization.value.routeColor,
    };
    
    // Also save to localStorage for offline use
    saveCustomizationToLocalStorage();
  } catch (error) {
    console.error('Failed to load map preferences from API:', error);
    // Fall back to localStorage
  }
}

// Save preferences to API
async function savePreferences() {
  if (!auth.isAuthenticated || !auth.token) {
    showStatus('Please log in to save preferences', 'error');
    return;
  }
  
  isSavingPreferences.value = true;
  
  try {
    await $fetch(`${config.public.apiBase}/maps/preferences`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: preferencesForm.value,
    });
    
    // Update local customization
    customization.value.placeMarkerColor = preferencesForm.value.placeMarkerColor;
    customization.value.routeColor = preferencesForm.value.routeColor;
    
    // Save to localStorage as well
    saveCustomizationToLocalStorage();
    
    // Refresh markers with new colors
    refreshMarkersFromSaved();
    updateRouteColor();
    
    showPreferencesModal.value = false;
    showStatus('Preferences saved!', 'success');
  } catch (error) {
    console.error('Failed to save preferences:', error);
    showStatus('Failed to save preferences', 'error');
  } finally {
    isSavingPreferences.value = false;
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

// GPX Export
function exportGPX() {
  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RonBureau Maps" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Map Export</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

  // Add saved places as waypoints if selected
  if (exportType.value === 'both' || exportType.value === 'places') {
    savedPlaces.value.forEach((place) => {
      gpxContent += `  <wpt lat="${place.lat}" lon="${place.lon}">
    <name>${escapeXml(place.name)}</name>
    <sym>${place.icon || '📍'}</sym>
  </wpt>
`;
    });
  }

  // Add routes as tracks if selected
  if (exportType.value === 'both' || exportType.value === 'routes') {
    savedRoutes.value.forEach((route) => {
      if (route.coordinates.length > 0) {
        gpxContent += `  <trk>
    <name>${escapeXml(route.name)}</name>
    <trkseg>
`;
        route.coordinates.forEach((coord: number[]) => {
          gpxContent += `      <trkpt lat="${coord[1]}" lon="${coord[0]}"></trkpt>
`;
        });
        gpxContent += `    </trkseg>
  </trk>
`;
      }
    });
    
    // Also export current route if exists
    if (currentRouteCoordinates.value.length > 0 && origin.value && destination.value) {
      gpxContent += `  <trk>
    <name>${escapeXml(origin.value.name)} → ${escapeXml(destination.value.name)}</name>
    <trkseg>
`;
      currentRouteCoordinates.value.forEach((coord: number[]) => {
        gpxContent += `      <trkpt lat="${coord[1]}" lon="${coord[0]}"></trkpt>
`;
      });
      gpxContent += `    </trkseg>
  </trk>
`;
    }
  }

  gpxContent += `</gpx>`;

  if (savedPlaces.value.length === 0 && savedRoutes.value.length === 0 && currentRouteCoordinates.value.length === 0) {
    showStatus('No data to export', 'error');
    return;
  }

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `map-export-${new Date().toISOString().split('T')[0]}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus('GPX exported successfully!', 'success');
}

// Helper function to escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Import file (GeoJSON or GPX)
function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.gpx')) {
    importGPX(file);
  } else {
    importGeoJSON(file);
  }
  
  // Reset input
  input.value = '';
}

// GPX Import
function importGPX(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      
      let placesImported = 0;
      let routesImported = 0;

      // Import waypoints as places
      const waypoints = xmlDoc.getElementsByTagName('wpt');
      for (let i = 0; i < waypoints.length; i++) {
        const wpt = waypoints[i];
        const lat = parseFloat(wpt.getAttribute('lat') || '0');
        const lon = parseFloat(wpt.getAttribute('lon') || '0');
        const nameEl = wpt.getElementsByTagName('name')[0];
        const name = nameEl?.textContent || 'Imported Place';
        
        savedPlaces.value.push({
          name,
          lon,
          lat,
          icon: '📍',
          color: customization.value.placeMarkerColor,
        });
        addMarker(lon, lat, name, customization.value.placeMarkerColor);
        placesImported++;
      }

      // Import tracks as routes
      const tracks = xmlDoc.getElementsByTagName('trk');
      for (let i = 0; i < tracks.length; i++) {
        const trk = tracks[i];
        const nameEl = trk.getElementsByTagName('name')[0];
        const name = nameEl?.textContent || 'Imported Route';
        
        const trksegs = trk.getElementsByTagName('trkseg');
        for (let j = 0; j < trksegs.length; j++) {
          const trkseg = trksegs[j];
          const trkpts = trkseg.getElementsByTagName('trkpt');
          const coordinates: number[][] = [];
          
          for (let k = 0; k < trkpts.length; k++) {
            const trkpt = trkpts[k];
            const lat = parseFloat(trkpt.getAttribute('lat') || '0');
            const lon = parseFloat(trkpt.getAttribute('lon') || '0');
            coordinates.push([lon, lat]);
          }
          
          if (coordinates.length > 0) {
            const newRoute: SavedRoute = {
              id: generateId(),
              name,
              origin: { name: 'Start', address: '', lon: coordinates[0][0], lat: coordinates[0][1] },
              destination: { name: 'End', address: '', lon: coordinates[coordinates.length - 1][0], lat: coordinates[coordinates.length - 1][1] },
              stops: [],
              distance: '',
              duration: '',
              coordinates: coordinates,
            };
            savedRoutes.value.push(newRoute);
            
            // Draw route on map
            const projectedCoords = coordinates.map(coord => fromLonLat(coord));
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
            routesImported++;
          }
        }
      }

      saveToLocalStorage();

      // Fit map to imported features
      if (map && routesImported > 0) {
        if (routeSource && routeSource.getFeatures().length > 0) {
          const extent = routeSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
          }
        }
      } else if (map && placesImported > 0) {
        if (markersSource && markersSource.getFeatures().length > 0) {
          const extent = markersSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
          }
        }
      }
      
      showStatus(`Imported ${placesImported} places and ${routesImported} routes from GPX`, 'success');
    } catch (error) {
      console.error('Failed to import GPX:', error);
      showStatus('Failed to import GPX file', 'error');
    }
  };
  reader.readAsText(file);
}

// Shared PDF Export Helper Functions

// Calculate combined extent from features for auto-scale
function calculateExportExtent(): number[] | null {
  if (!map || !markersSource || !routeSource) return null;
  
  const extents: number[][] = [];
  
  // Collect extents from places if showing places
  if (pdfOptions.value.exportContent !== 'routes') {
    const placeFeatures = markersSource.getFeatures().filter(f => f.get('type') === 'place');
    if (placeFeatures.length > 0) {
      placeFeatures.forEach(f => {
        const geom = f.getGeometry();
        if (geom) extents.push(geom.getExtent());
      });
    }
  }
  
  // Collect extents from routes if showing routes
  if (pdfOptions.value.exportContent !== 'places') {
    const routeFeatures = routeSource.getFeatures();
    if (routeFeatures.length > 0) {
      routeFeatures.forEach(f => {
        const geom = f.getGeometry();
        if (geom) extents.push(geom.getExtent());
      });
    }
  }
  
  if (extents.length === 0) return null;
  
  // Calculate combined extent
  const combinedExtent = extents[0].slice();
  for (let i = 1; i < extents.length; i++) {
    combinedExtent[0] = Math.min(combinedExtent[0], extents[i][0]);
    combinedExtent[1] = Math.min(combinedExtent[1], extents[i][1]);
    combinedExtent[2] = Math.max(combinedExtent[2], extents[i][2]);
    combinedExtent[3] = Math.max(combinedExtent[3], extents[i][3]);
  }
  
  // For single points, add padding to create a reasonable extent
  const extentWidth = combinedExtent[2] - combinedExtent[0];
  const extentHeight = combinedExtent[3] - combinedExtent[1];
  
  if (extentWidth < 1000 || extentHeight < 1000) {
    const minSize = 5000;
    const expandX = Math.max(0, (minSize - extentWidth) / 2);
    const expandY = Math.max(0, (minSize - extentHeight) / 2);
    combinedExtent[0] -= expandX;
    combinedExtent[1] -= expandY;
    combinedExtent[2] += expandX;
    combinedExtent[3] += expandY;
  }
  
  return combinedExtent;
}

// Apply auto-scale to map view
async function applyAutoScale(): Promise<void> {
  if (!map || pdfOptions.value.scale !== 'auto') return;
  
  const extent = calculateExportExtent();
  if (extent) {
    map.getView().fit(extent, { padding: [80, 80, 80, 80], maxZoom: 18 });
    await new Promise(resolve => setTimeout(resolve, 500));
    map.renderSync();
    await new Promise(resolve => setTimeout(resolve, 300));
  } else {
    showStatus('Warning: No places or routes to export', 'error');
  }
}

// Add PDF decorations (north pointer, scale bar, legend, credits)
function addPdfDecorations(
  pdf: InstanceType<typeof jsPDF>,
  mapLeft: number,
  mapTop: number,
  mapWidth: number,
  mapHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: number
): void {
  // Add north pointer
  if (pdfOptions.value.showNorthPointer) {
    const npX = mapLeft + mapWidth - 10;
    const npY = mapTop + 10;
    pdf.setFillColor(255, 255, 255);
    pdf.circle(npX, npY, 5, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.circle(npX, npY, 5, 'S');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('N', npX, npY + 1, { align: 'center' });
    pdf.setLineWidth(0.5);
    pdf.line(npX, npY - 7, npX, npY - 3);
    pdf.line(npX - 2, npY - 5, npX, npY - 7);
    pdf.line(npX + 2, npY - 5, npX, npY - 7);
  }
  
  // Add scale bar
  if (pdfOptions.value.showScaleBar && map) {
    const view = map.getView();
    const resolution = view.getResolution();
    if (resolution && resolution > 0) {
      const center = view.getCenter();
      if (center) {
        const centerLonLat = toLonLat(center);
        const pixelDistance = 100;
        const offsetPoint = toLonLat([center[0] + resolution * pixelDistance, center[1]]);
        const distanceFor100px = getDistance(centerLonLat, offsetPoint);
        
        const niceScaleValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
        let selectedScale = niceScaleValues[0];
        
        for (const niceValue of niceScaleValues) {
          const pixelsNeeded = (niceValue / distanceFor100px) * pixelDistance;
          if (pixelsNeeded >= 50 && pixelsNeeded <= 200) {
            selectedScale = niceValue;
            break;
          }
        }
        
        const scaleLabel = selectedScale >= 1000 
          ? `${selectedScale / 1000} km` 
          : `${selectedScale} m`;
        
        const sbX = mapLeft + 5;
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
    const legendHeight = pdfOptions.value.pageSize === 'a3' ? 25 : 20;
    const legendY = pageHeight - margin - legendHeight + 5;
    pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 12 : 10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Legend:', margin, legendY);
    
    let legendX = margin + 25;
    pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 10 : 8);
    pdf.setFont('helvetica', 'normal');
    
    const showPlaces = (pdfOptions.value.exportContent === 'both' || pdfOptions.value.exportContent === 'places') && savedPlaces.value.length > 0;
    const showRoutes = (pdfOptions.value.exportContent === 'both' || pdfOptions.value.exportContent === 'routes') && (savedRoutes.value.length > 0 || currentRouteCoordinates.value.length > 0);
    
    if (showPlaces) {
      pdf.setFillColor(239, 68, 68);
      pdf.circle(legendX, legendY - 1, 2, 'F');
      pdf.text('Places', legendX + 5, legendY);
      legendX += 35;
    }
    
    if (showRoutes) {
      pdf.setDrawColor(34, 197, 94);
      pdf.setLineWidth(1);
      pdf.line(legendX, legendY - 1, legendX + 10, legendY - 1);
      pdf.text('Routes', legendX + 15, legendY);
    }
  }
  
  // Add credits
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated with ronBureau by ${auth.user?.userId ?? 'unknown user'} on ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - margin, { align: 'right' });
  pdf.text('Map data © OpenStreetMap contributors — https://osmfoundation.org/Licence', margin, pageHeight - margin, { align: 'left' });
}

// SVG Vector Export Helper
function generateSvgFromFeatures(width: number, height: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  // Create defs for markers if needed
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  
  return svg;
}

function addRouteToSvg(svg: SVGSVGElement, coordinates: number[][], color: string, width: number = 4) {
  if (!map || coordinates.length < 2) return;
  
  const pathData: string[] = [];
  coordinates.forEach((coord, index) => {
    const pixel = map!.getPixelFromCoordinate(fromLonLat(coord));
    if (pixel) {
      const command = index === 0 ? 'M' : 'L';
      pathData.push(`${command} ${pixel[0]} ${pixel[1]}`);
    }
  });
  
  if (pathData.length > 0) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData.join(' '));
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', width.toString());
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }
}

function addPlaceToSvg(svg: SVGSVGElement, lon: number, lat: number, name: string, color: string, radius: number = 8) {
  if (!map) return;
  
  const pixel = map.getPixelFromCoordinate(fromLonLat([lon, lat]));
  if (!pixel) return;
  
  // Add circle marker
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', pixel[0].toString());
  circle.setAttribute('cy', pixel[1].toString());
  circle.setAttribute('r', radius.toString());
  circle.setAttribute('fill', color);
  circle.setAttribute('stroke', '#ffffff');
  circle.setAttribute('stroke-width', '2');
  svg.appendChild(circle);
  
  // Add text label
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', pixel[0].toString());
  text.setAttribute('y', (pixel[1] - radius - 8).toString());
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-family', 'Arial, sans-serif');
  text.setAttribute('font-size', '14');
  text.setAttribute('font-weight', 'bold');
  text.setAttribute('fill', '#1e293b');
  text.setAttribute('stroke', '#ffffff');
  text.setAttribute('stroke-width', '3');
  text.setAttribute('paint-order', 'stroke');
  text.textContent = name;
  svg.appendChild(text);
}

// PDF Map Export with Vector Support
async function exportPdfMap() {
  if (!map) return;
  
  showPdfExportModal.value = false;
  showStatus('Generating PDF...', 'success');
  
  // Check if vector export is requested
  if (pdfOptions.value.vectorExport) {
    // If MapTiler key is available, ensure MapTiler vector tiles are enabled
    await ensureMapTilerForVectorExport();
    await exportVectorPdfMap();
    return;
  }
  
  try {
    // Save current view state
    const originalCenter = map.getView().getCenter();
    const originalZoom = map.getView().getZoom();
    
    // Apply auto-scale if enabled
    await applyAutoScale();
    
    // Save current location marker features before clearing
    const savedLocationFeatures: Feature[] = [];
    if (currentLocationSource) {
      currentLocationSource.getFeatures().forEach(f => {
        savedLocationFeatures.push(f);
      });
      currentLocationSource.clear();
    }
    
    // Wait for the map to re-render without the location marker
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Temporarily filter markers based on export content setting
    const originalMarkersState: Feature[] = [];
    const originalRouteState: Feature[] = [];
    
    if (markersSource && pdfOptions.value.exportContent !== 'both') {
      const featuresToRemove: Feature[] = [];
      markersSource.getFeatures().forEach((f) => {
        const featureType = f.get('type');
        if (pdfOptions.value.exportContent === 'routes' && featureType === 'place') {
          featuresToRemove.push(f);
        }
      });
      featuresToRemove.forEach(f => {
        originalMarkersState.push(f);
        markersSource?.removeFeature(f);
      });
    }
    
    if (routeSource && pdfOptions.value.exportContent === 'places') {
      const featuresToRemove: Feature[] = [];
      routeSource.getFeatures().forEach((f) => {
        featuresToRemove.push(f);
      });
      featuresToRemove.forEach(f => {
        originalRouteState.push(f);
        routeSource?.removeFeature(f);
      });
    }
    
    // Wait for changes to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mapCanvas = map.getViewport().querySelector('canvas');
    if (!mapCanvas) {
      // Restore features before showing error
      originalMarkersState.forEach(f => markersSource?.addFeature(f));
      originalRouteState.forEach(f => routeSource?.addFeature(f));
      savedLocationFeatures.forEach(f => currentLocationSource?.addFeature(f));
      showStatus('Could not capture map', 'error');
      return;
    }
    
    // Create a higher resolution export canvas for better label legibility
    // Use zoom-based scaling: higher zoom = higher resolution for text clarity
    const exportCanvas = document.createElement('canvas');
    const currentZoom = map.getView().getZoom() || 10;
    
    // Enhanced scale calculation for better text readability
    // Base scale increases with zoom level, ensuring labels are always crisp
    let scale = Math.min(PDF_EXPORT_MAX_SCALE, Math.max(PDF_EXPORT_MIN_SCALE, Math.ceil(currentZoom / PDF_EXPORT_ZOOM_DIVISOR)));
    
    // Apply device pixel ratio for even better quality on high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    scale = scale * Math.min(dpr, 2); // Cap DPR contribution at 2x to avoid excessive file sizes
    
    exportCanvas.width = mapCanvas.width * scale;
    exportCanvas.height = mapCanvas.height * scale;
    const ctx = exportCanvas.getContext('2d', { 
      alpha: false, // Disable alpha for better performance and smaller file size
      willReadFrequently: false 
    });
    
    if (!ctx) {
      // Restore features before showing error
      originalMarkersState.forEach(f => markersSource?.addFeature(f));
      originalRouteState.forEach(f => routeSource?.addFeature(f));
      savedLocationFeatures.forEach(f => currentLocationSource?.addFeature(f));
      // Restore original view if autoscale was used
      if (pdfOptions.value.scale === 'auto' && originalCenter && originalZoom) {
        map.getView().setCenter(originalCenter);
        map.getView().setZoom(originalZoom);
      }
      showStatus('Could not create export canvas', 'error');
      return;
    }
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the map canvas onto the export canvas with scaling
    ctx.scale(scale, scale);
    ctx.drawImage(mapCanvas, 0, 0);
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: pdfOptions.value.pageSize,
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    // Add title
    if (pdfOptions.value.title) {
      pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 20 : 16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(pdfOptions.value.title, pageWidth / 2, margin + 5, { align: 'center' });
    }
    
    // Calculate map area
    const titleHeight = pdfOptions.value.title ? (pdfOptions.value.pageSize === 'a3' ? 18 : 15) : 0;
    const legendHeight = pdfOptions.value.showLegend ? (pdfOptions.value.pageSize === 'a3' ? 25 : 20) : 0;
    const mapTop = margin + titleHeight;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2 - titleHeight - legendHeight;
    
    // Calculate proper aspect ratio to prevent deformation
    const canvasAspect = exportCanvas.width / exportCanvas.height;
    let mapWidth = availableWidth;
    let mapHeight = availableWidth / canvasAspect;
    
    if (mapHeight > availableHeight) {
      mapHeight = availableHeight;
      mapWidth = availableHeight * canvasAspect;
    }
    
    // Center the map horizontally
    const mapLeft = margin + (availableWidth - mapWidth) / 2;
    
    // Add map image with proper aspect ratio
    // Use JPEG format with 0.85 quality for basemap images - reduces file size significantly
    // while maintaining good visual quality for map tiles
    const imgData = exportCanvas.toDataURL('image/jpeg', 0.85);
    pdf.addImage(imgData, 'JPEG', mapLeft, mapTop, mapWidth, mapHeight, undefined, 'FAST');
    
    // Add north pointer
    if (pdfOptions.value.showNorthPointer) {
      const npX = mapLeft + mapWidth - 10;
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
      if (resolution && resolution > 0) {
        const center = view.getCenter();
        if (center) {
          const centerLonLat = toLonLat(center);
          // Calculate distance per pixel at map center
          const pixelDistance = 100; // pixels
          const offsetPoint = toLonLat([center[0] + resolution * pixelDistance, center[1]]);
          const distanceFor100px = getDistance(centerLonLat, offsetPoint);
          
          // Choose a nice round number for the scale bar
          const niceScaleValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
          let selectedScale = niceScaleValues[0];
          let scaleBarPixels = 100;
          
          // Find the best scale value that fits approximately 100 pixels (30mm on PDF)
          for (const niceValue of niceScaleValues) {
            const pixelsNeeded = (niceValue / distanceFor100px) * pixelDistance;
            if (pixelsNeeded >= 50 && pixelsNeeded <= 200) {
              selectedScale = niceValue;
              scaleBarPixels = pixelsNeeded;
              break;
            }
          }
          
          // Format the scale label
          let scaleLabel: string;
          if (selectedScale >= 1000) {
            scaleLabel = `${selectedScale / 1000} km`;
          } else {
            scaleLabel = `${selectedScale} m`;
          }
          
          // Convert pixel width to PDF mm width (approximately)
          const pdfScaleBarWidth = (scaleBarPixels / mapCanvas.width) * mapWidth;
          const sbX = mapLeft + 5;
          const sbY = mapTop + mapHeight - 5;
          const sbWidth = Math.max(15, Math.min(60, pdfScaleBarWidth));
          
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
    
    // Add legend based on export content
    if (pdfOptions.value.showLegend) {
      const legendY = pageHeight - margin - legendHeight + 5;
      pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 12 : 10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Legend:', margin, legendY);
      
      let legendX = margin + 25;
      pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 10 : 8);
      pdf.setFont('helvetica', 'normal');
      
      const showPlaces = (pdfOptions.value.exportContent === 'both' || pdfOptions.value.exportContent === 'places') && savedPlaces.value.length > 0;
      const showRoutes = (pdfOptions.value.exportContent === 'both' || pdfOptions.value.exportContent === 'routes') && (savedRoutes.value.length > 0 || currentRouteCoordinates.value.length > 0);
      
      if (showPlaces) {
        pdf.setFillColor(239, 68, 68);
        pdf.circle(legendX, legendY - 1, 2, 'F');
        pdf.text('Places', legendX + 5, legendY);
        legendX += 35;
      }
      
      if (showRoutes) {
        pdf.setDrawColor(34, 197, 94);
        pdf.setLineWidth(1);
        pdf.line(legendX, legendY - 1, legendX + 10, legendY - 1);
        pdf.text('Routes', legendX + 15, legendY);
      }
    }
    
    // Add date
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated with ronBureau by ${auth.user?.userId ?? 'unknown user'} on ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - margin, { align: 'right' });
    // Credits required by OpenStreetMap license
    const creditsText = 'Map data © OpenStreetMap contributors — https://osmfoundation.org/Licence';
    pdf.text(creditsText, margin, pageHeight - margin, { align: 'left' });
    
    // Restore hidden features
    originalMarkersState.forEach((f) => {
      markersSource?.addFeature(f);
    });
    originalRouteState.forEach((f) => {
      routeSource?.addFeature(f);
    });
    
    // Restore current location features
    savedLocationFeatures.forEach((f) => {
      currentLocationSource?.addFeature(f);
    });
    
    // Restore original view if autoscale was used
    if (pdfOptions.value.scale === 'auto' && originalCenter && originalZoom) {
      map.getView().setCenter(originalCenter);
      map.getView().setZoom(originalZoom);
    }
    
    pdf.save(`map-${new Date().toISOString().split('T')[0]}.pdf`);
    showStatus('PDF exported successfully!', 'success');
  } catch (error) {
    console.error('PDF export failed:', error);
    showStatus('Failed to export PDF', 'error');
  }
}

// Vector PDF Export (SVG → PDF)
async function exportVectorPdfMap() {
  if (!map) return;
  
  try {
    // Save current view state
    const originalCenter = map.getView().getCenter();
    const originalZoom = map.getView().getZoom();
    
    // Apply auto-scale if enabled
    await applyAutoScale();
    
    // Get map size
    const mapSize = map.getSize();
    if (!mapSize) {
      showStatus('Could not get map size', 'error');
      return;
    }
    
    const [mapWidth, mapHeight] = mapSize;
    // If user requested a fully vector basemap (no raster) ensure vector tiles are available.
    if (!pdfOptions.value.includeBasemap) {
      // Try to enable MapTiler vector tiles (or existing vector provider)
      const ok = await ensureMapTilerForVectorExport();
      if (!ok && (!useVectorTiles.value || !vectorTileProvider.value)) {
        // Could not enable vector basemap — fallback to raster basemap to avoid exporting empty basemap
        pdfOptions.value.includeBasemap = true;
        showStatus('MapTiler/OpenFreeMap vector tiles unavailable — falling back to raster basemap for PDF export', 'error');
      }
    }
    
    // Create SVG
    const svg = generateSvgFromFeatures(mapWidth, mapHeight);
    
    // Optionally add basemap as raster background
    if (pdfOptions.value.includeBasemap) {
      const mapCanvas = map.getViewport().querySelector('canvas') as HTMLCanvasElement;
      if (mapCanvas) {
        // Use JPEG format with 0.85 quality for smaller file size
        const imgData = mapCanvas.toDataURL('image/jpeg', 0.85);
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('href', imgData);
        image.setAttribute('x', '0');
        image.setAttribute('y', '0');
        image.setAttribute('width', mapWidth.toString());
        image.setAttribute('height', mapHeight.toString());
        svg.insertBefore(image, svg.firstChild);
      }
    }
    
    // Add routes to SVG
    if (pdfOptions.value.exportContent !== 'places') {
      // Add saved routes
      savedRoutes.value.forEach((route) => {
        if (route.coordinates.length > 0) {
          addRouteToSvg(svg, route.coordinates, customization.value.routeColor, 4);
        }
      });
      
      // Add current route
      if (currentRouteCoordinates.value.length > 0) {
        addRouteToSvg(svg, currentRouteCoordinates.value, customization.value.routeColor, 4);
      }
    }
    
    // Add places to SVG
    if (pdfOptions.value.exportContent !== 'routes') {
      savedPlaces.value.forEach((place) => {
        addPlaceToSvg(svg, place.lon, place.lat, place.name, place.color || customization.value.placeMarkerColor, 8);
      });
    }
    
    // Add direction markers (origin, destination, stops)
    if (pdfOptions.value.exportContent !== 'places') {
      if (origin.value) {
        addPlaceToSvg(svg, origin.value.lon, origin.value.lat, 'A', '#22c55e', 10);
      }
      if (destination.value) {
        addPlaceToSvg(svg, destination.value.lon, destination.value.lat, 'B', '#ef4444', 10);
      }
      stops.value.forEach((stop, index) => {
        addPlaceToSvg(svg, stop.lon, stop.lat, (index + 1).toString(), '#f59e0b', 10);
      });
    }
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: pdfOptions.value.pageSize,
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    // Add title
    if (pdfOptions.value.title) {
      pdf.setFontSize(pdfOptions.value.pageSize === 'a3' ? 20 : 16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(pdfOptions.value.title, pageWidth / 2, margin + 5, { align: 'center' });
    }
    
    // Calculate map area
    const titleHeight = pdfOptions.value.title ? (pdfOptions.value.pageSize === 'a3' ? 18 : 15) : 0;
    const legendHeight = pdfOptions.value.showLegend ? (pdfOptions.value.pageSize === 'a3' ? 25 : 20) : 0;
    const mapTop = margin + titleHeight;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2 - titleHeight - legendHeight;
    
    // Calculate SVG scale to fit in PDF
    const svgAspect = mapWidth / mapHeight;
    let pdfMapWidth = availableWidth;
    let pdfMapHeight = availableWidth / svgAspect;
    
    if (pdfMapHeight > availableHeight) {
      pdfMapHeight = availableHeight;
      pdfMapWidth = availableHeight * svgAspect;
    }
    
    const mapLeft = margin + (availableWidth - pdfMapWidth) / 2;
    
    // Convert SVG to PDF using svg2pdf
    document.body.appendChild(svg);
    await svg2pdf(svg, pdf, {
      x: mapLeft,
      y: mapTop,
      width: pdfMapWidth,
      height: pdfMapHeight,
    });
    document.body.removeChild(svg);
    
    // Add decorations (north pointer, scale bar, legend, credits)
    addPdfDecorations(pdf, mapLeft, mapTop, pdfMapWidth, pdfMapHeight, pageWidth, pageHeight, margin);
    
    // Restore view if modified
    if (pdfOptions.value.scale === 'auto' && originalCenter && originalZoom) {
      map.getView().setCenter(originalCenter);
      map.getView().setZoom(originalZoom);
    }
    
    pdf.save(`map-vector-${new Date().toISOString().split('T')[0]}.pdf`);
    showStatus('Vector PDF exported successfully!', 'success');
  } catch (error) {
    console.error('Vector PDF export failed:', error);
    showStatus('Failed to export vector PDF', 'error');
  }
}

// GeoJSON Import
function importGeoJSON(eventOrFile: Event | File) {
  let file: File | undefined;
  
  if (eventOrFile instanceof File) {
    file = eventOrFile;
  } else {
    const input = (eventOrFile.target as HTMLInputElement);
    file = input.files?.[0];
  }
  
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

      // Fit map to imported features - combine all extents
      if (map && routesImported > 0) {
        // If routes were imported, fit to the route source extent
        if (routeSource && routeSource.getFeatures().length > 0) {
          const extent = routeSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
          }
        }
      } else if (map && placesImported > 0) {
        // Otherwise fit to markers
        if (markersSource && markersSource.getFeatures().length > 0) {
          const extent = markersSource.getExtent();
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
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
}

// Handle map click
function handleMapClick(event: { coordinate: number[] }) {
  const coords = toLonLat(event.coordinate);
  const lon = coords[0];
  const lat = coords[1];
  
  // Handle pick point mode for directions
  if (pickPointMode.value) {
    reverseGeocode(lon, lat).then((name) => {
      const place: PlaceResult = {
        name,
        address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        lon,
        lat,
      };
      
      if (pickPointMode.value === 'origin') {
        selectOrigin(place);
        showStatus('Origin set from map!', 'success');
      } else if (pickPointMode.value === 'stop') {
        const newStop: Stop = {
          id: generateId(),
          name,
          lon,
          lat,
        };
        stops.value.push(newStop);
        addDirectionMarker(lon, lat, 'stop', stops.value.length - 1);
        showStatus('Stop added from map!', 'success');
      } else if (pickPointMode.value === 'destination') {
        selectDestination(place);
        showStatus('Destination set from map!', 'success');
      }
      
      pickPointMode.value = null;
    });
    return;
  }
  
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
  }
}

// Handle map style change - automatically enables vector tiles when a style is selected
async function onMapStyleChange() {
  // Always use vector tiles when MapTiler style is selected
  if (!useVectorTiles.value) {
    useVectorTiles.value = true;
  }
  
  // If already using vector tiles, just switch the style
  if (map) {
    const layers = map.getLayers();
    if (vectorTileLayer) {
      layers.remove(vectorTileLayer);
      vectorTileLayer = null;
    }
    await toggleVectorTiles();
  }
}

// Toggle between raster and vector tiles
async function toggleVectorTiles() {
  if (!map) return;
  
  const layers = map.getLayers();
  
  if (useVectorTiles.value) {
    // Switch to vector tiles
    if (!vectorTileLayer) {
      showStatus('Loading vector tiles...', 'success');
      
      try {
        // Try MapTiler first if API key is available
        const maptilerKey = config.public.maptilerApiKey;
        
        if (maptilerKey && maptilerKey !== 'get_your_free_key_at_https://maptiler.com' && maptilerKey.length > 10) {
          // Use MapTiler vector tiles (high quality, with labels)
          vectorTileLayer = new VectorTileLayer({
            declutter: true,
            source: new VectorTileSource({
              format: new MVT(),
              url: `https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=${maptilerKey}`,
              maxZoom: 14,
            }),
          });
          
          // Apply selected MapTiler style
          const styleUrl = `https://api.maptiler.com/maps/${maptilerStyle.value}/style.json?key=${maptilerKey}`;
          await applyStyle(vectorTileLayer, styleUrl);
          vectorTileProvider.value = 'maptiler';
          const selectedStyle = maptilerStyles.find(s => s.id === maptilerStyle.value);
          showStatus(`✨ ${selectedStyle?.name || 'MapTiler'} style loaded`, 'success');
        } else {
          // Fallback to OpenFreeMap (free, no key required)
          vectorTileLayer = new VectorTileLayer({
            declutter: true,
            source: new VectorTileSource({
              format: new MVT(),
              url: 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf',
              maxZoom: 14,
            }),
          });
          
          // Apply OpenFreeMap Liberty style
          const styleUrl = 'https://tiles.openfreemap.org/styles/liberty';
          await applyStyle(vectorTileLayer, styleUrl);
          vectorTileProvider.value = 'openfreemap';
          showStatus('🌍 Vector tiles loaded (OpenFreeMap - Free)', 'success');
        }
      } catch (error) {
        console.error('Failed to load vector tiles:', error);
        showStatus('Failed to load vector tiles, using raster', 'error');
        useVectorTiles.value = false;
        vectorTileProvider.value = null;
        return;
      }
    }
    
    layers.setAt(0, vectorTileLayer);
  } else {
    // Switch back to raster tiles
    layers.setAt(0, new TileLayer({ source: new OSM() }));
    vectorTileProvider.value = null;
    showStatus('Switched to raster tiles', 'success');
  }
}

// Initialize map
onMounted(() => {
  loadFromLocalStorage();
  recordLastAccessed();
  
  // Load map preferences from API if authenticated
  loadMapPreferencesFromAPI();
  
  // Load lists from API if authenticated
  loadPlaceListsFromAPI();
  loadRouteListsFromAPI();

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
    
    // Auto-enable vector tiles if MapTiler API key is available
    if (vectorTilesAvailable.value) {
      useVectorTiles.value = true;
      toggleVectorTiles();
    }
  }
});

// Load place lists from API
async function loadPlaceListsFromAPI() {
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    const response = await $fetch<{ id: string; name: string; description?: string; places?: SavedPlace[] }[]>(
      `${config.public.apiBase}/maps/place-lists`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );
    placeLists.value = response;
  } catch (error) {
    console.error('Failed to load place lists:', error);
  }
}

// Load route lists from API
async function loadRouteListsFromAPI() {
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    const response = await $fetch<{ id: string; name: string; description?: string; routes?: SavedRoute[] }[]>(
      `${config.public.apiBase}/maps/route-lists`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    );
    routeLists.value = response;
  } catch (error) {
    console.error('Failed to load route lists:', error);
  }
}

// Create place list
async function createPlaceList() {
  if (!newPlaceListName.value.trim()) return;
  if (!auth.isAuthenticated || !auth.token) {
    showStatus('Please log in to create lists', 'error');
    return;
  }
  
  try {
    await $fetch(`${config.public.apiBase}/maps/place-lists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: newPlaceListName.value.trim() },
    });
    
    newPlaceListName.value = '';
    await loadPlaceListsFromAPI();
    showStatus('Place list created!', 'success');
  } catch (error) {
    console.error('Failed to create place list:', error);
    showStatus('Failed to create list', 'error');
  }
}

// Create route list
async function createRouteList() {
  if (!newRouteListName.value.trim()) return;
  if (!auth.isAuthenticated || !auth.token) {
    showStatus('Please log in to create lists', 'error');
    return;
  }
  
  try {
    await $fetch(`${config.public.apiBase}/maps/route-lists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: newRouteListName.value.trim() },
    });
    
    newRouteListName.value = '';
    await loadRouteListsFromAPI();
    showStatus('Route list created!', 'success');
  } catch (error) {
    console.error('Failed to create route list:', error);
    showStatus('Failed to create list', 'error');
  }
}

// Delete place list
async function deletePlaceList(listId: string) {
  if (!confirm('Are you sure you want to delete this list? Places in the list will not be deleted.')) return;
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    await $fetch(`${config.public.apiBase}/maps/place-lists/${listId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });
    
    await loadPlaceListsFromAPI();
    showStatus('List deleted!', 'success');
  } catch (error) {
    console.error('Failed to delete place list:', error);
    showStatus('Failed to delete list', 'error');
  }
}

// Delete route list
async function deleteRouteList(listId: string) {
  if (!confirm('Are you sure you want to delete this list? Routes in the list will not be deleted.')) return;
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    await $fetch(`${config.public.apiBase}/maps/route-lists/${listId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });
    
    await loadRouteListsFromAPI();
    showStatus('List deleted!', 'success');
  } catch (error) {
    console.error('Failed to delete route list:', error);
    showStatus('Failed to delete list', 'error');
  }
}

// Edit place list name
async function editPlaceListName(list: { id: string; name: string }) {
  const newName = prompt('Enter new name for the list:', list.name);
  if (!newName || newName.trim() === list.name) return;
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    await $fetch(`${config.public.apiBase}/maps/place-lists/${list.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: newName.trim() },
    });
    
    await loadPlaceListsFromAPI();
    showStatus('List renamed!', 'success');
  } catch (error) {
    console.error('Failed to rename place list:', error);
    showStatus('Failed to rename list', 'error');
  }
}

// Edit route list name
async function editRouteListName(list: { id: string; name: string }) {
  const newName = prompt('Enter new name for the list:', list.name);
  if (!newName || newName.trim() === list.name) return;
  if (!auth.isAuthenticated || !auth.token) return;
  
  try {
    await $fetch(`${config.public.apiBase}/maps/route-lists/${list.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: newName.trim() },
    });
    
    await loadRouteListsFromAPI();
    showStatus('List renamed!', 'success');
  } catch (error) {
    console.error('Failed to rename route list:', error);
    showStatus('Failed to rename list', 'error');
  }
}

// Load place list
function loadPlaceList(list: { id: string; name: string; places?: SavedPlace[] }) {
  if (!list.places || list.places.length === 0) {
    showStatus('This list is empty', 'error');
    return;
  }
  
  // Clear current places
  savedPlaces.value = [];
  if (markersSource) {
    const features = markersSource.getFeatures();
    features.forEach((f) => {
      if (f.get('type') === 'place') {
        markersSource?.removeFeature(f);
      }
    });
  }
  
  // Load places from list
  list.places.forEach((place) => {
    savedPlaces.value.push({
      id: place.id,
      name: place.name,
      lon: place.lon,
      lat: place.lat,
      icon: place.icon,
      color: place.color,
    });
    addMarker(place.lon, place.lat, place.name, place.color);
  });
  
  saveToLocalStorage();
  showPlaceListsModal.value = false;
  showStatus(`Loaded list: ${list.name}`, 'success');
}

// Load route list
function loadRouteList(list: { id: string; name: string; routes?: SavedRoute[] }) {
  if (!list.routes || list.routes.length === 0) {
    showStatus('This list is empty', 'error');
    return;
  }
  
  // Clear current routes
  savedRoutes.value = [];
  if (routeSource) {
    routeSource.clear();
  }
  
  // Load routes from list and draw them on the map
  list.routes.forEach((route) => {
    const coordinates = JSON.parse(route.coordinates);
    const newRoute: SavedRoute = {
      id: route.id,
      name: route.name,
      origin: { name: route.originName, address: '', lon: route.originLon, lat: route.originLat },
      destination: { name: route.destName, address: '', lon: route.destLon, lat: route.destLat },
      stops: route.stops ? JSON.parse(route.stops) : [],
      distance: route.distance,
      duration: route.duration,
      coordinates: coordinates,
    };
    savedRoutes.value.push(newRoute);
    
    // Draw route on map
    if (coordinates.length > 0 && routeSource) {
      const projectedCoords = coordinates.map((coord: number[]) => fromLonLat(coord));
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
      routeSource.addFeature(routeFeature);
    }
  });
  
  // Fit map to show all routes
  if (map && routeSource && routeSource.getFeatures().length > 0) {
    const extent = routeSource.getExtent();
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
  }
  
  saveToLocalStorage();
  showRouteListsModal.value = false;
  showStatus(`Loaded list: ${list.name}`, 'success');
}

// Save current places to a new list
async function saveCurrentPlacesToList() {
  if (savedPlaces.value.length === 0) {
    showStatus('No places to save', 'error');
    return;
  }
  
  const listName = prompt('Enter a name for the new list:');
  if (!listName || !listName.trim()) return;
  
  if (!auth.isAuthenticated || !auth.token) {
    showStatus('Please log in to save lists', 'error');
    return;
  }
  
  try {
    // Create the list
    const listResponse = await $fetch<{ id: string }>(`${config.public.apiBase}/maps/place-lists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: listName.trim() },
    });
    
    // Add all current places to the list in parallel
    await Promise.all(savedPlaces.value.map(place => 
      $fetch(`${config.public.apiBase}/maps/places`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: {
          name: place.name,
          lon: place.lon,
          lat: place.lat,
          icon: place.icon,
          color: place.color,
          listId: listResponse.id,
        },
      })
    ));
    
    await loadPlaceListsFromAPI();
    showStatus(`Saved ${savedPlaces.value.length} places to list: ${listName}`, 'success');
  } catch (error) {
    console.error('Failed to save places to list:', error);
    showStatus('Failed to save places', 'error');
  }
}

// Save current routes to a new list
async function saveCurrentRoutesToList() {
  if (savedRoutes.value.length === 0) {
    showStatus('No routes to save', 'error');
    return;
  }
  
  const listName = prompt('Enter a name for the new list:');
  if (!listName || !listName.trim()) return;
  
  if (!auth.isAuthenticated || !auth.token) {
    showStatus('Please log in to save lists', 'error');
    return;
  }
  
  try {
    // Create the list
    const listResponse = await $fetch<{ id: string }>(`${config.public.apiBase}/maps/route-lists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: { name: listName.trim() },
    });
    
    // Add all current routes to the list in parallel
    await Promise.all(savedRoutes.value.map(route =>
      $fetch(`${config.public.apiBase}/maps/routes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: {
          name: route.name,
          originName: route.origin.name,
          originLon: route.origin.lon,
          originLat: route.origin.lat,
          destName: route.destination.name,
          destLon: route.destination.lon,
          destLat: route.destination.lat,
          stops: JSON.stringify(route.stops),
          distance: route.distance,
          duration: route.duration,
          coordinates: JSON.stringify(route.coordinates),
          listId: listResponse.id,
        },
      })
    ));
    
    await loadRouteListsFromAPI();
    showStatus(`Saved ${savedRoutes.value.length} routes to list: ${listName}`, 'success');
  } catch (error) {
    console.error('Failed to save routes to list:', error);
    showStatus('Failed to save routes', 'error');
  }
}

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

.vector-tiles-status {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  width: fit-content;
}

.status-badge.premium {
  background: linear-gradient(135deg, #fef3c7 0%, #fde047 100%);
  color: #854d0e;
  border: 1px solid #fbbf24;
}

.status-badge.free {
  background: linear-gradient(135deg, #dcfce7 0%, #86efac 100%);
  color: #14532d;
  border: 1px solid #22c55e;
}

.sidebar-style-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.sidebar-style-selector label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0;
}

.sidebar-style-selector .select {
  flex: 1;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
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

.stop-reorder-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reorder-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0;
  width: 18px;
  height: 14px;
  font-size: 8px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.reorder-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stops-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.route-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.route-actions .btn {
  flex: 1;
}

/* Route profile selector */
.route-profile-selector {
  margin-bottom: 0.75rem;
}

.route-profile-selector label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
  display: block;
}

.profile-buttons {
  display: flex;
  gap: 0.25rem;
}

.profile-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.profile-btn:hover {
  border-color: var(--color-primary);
}

.profile-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Input with actions wrapper */
.input-with-actions {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-actions .input {
  flex: 1;
  padding-right: 2rem;
}

.clear-input-btn {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-input-btn:hover {
  color: var(--color-error);
}

/* Field action buttons - shown on focus */
.field-action-buttons {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
  padding: 0.25rem;
  background: var(--color-background);
  border-radius: var(--radius);
}

.field-action-buttons .action-btn-sm {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.7rem;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.field-action-buttons .action-btn-sm:hover {
  border-color: var(--color-primary);
  background: var(--color-background);
}

.field-action-buttons .action-btn-sm.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.field-action-buttons .action-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.edit-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.edit-btn:hover {
  color: var(--color-primary);
}

/* Action buttons row */
.action-buttons-row {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.7rem;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}

.action-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-background);
}

.action-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn-sm {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.action-btn-sm:hover {
  border-color: var(--color-primary);
  background: var(--color-background);
}

.action-btn-sm.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stops header with action buttons */
.stops-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stop-action-buttons {
  display: flex;
  gap: 0.25rem;
}

/* Pick mode input highlight */
.input.pick-mode {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Customization header */
.customization-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.customization-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0;
}

/* Modal description */
.modal-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

/* Picker list for saved places selection */
.picker-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: var(--transition);
}

.picker-item:hover {
  background: var(--color-background);
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

.modal-content.modal-large {
  max-width: 600px;
}

.modal-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* List management styles */
.list-search-form {
  margin-bottom: 1rem;
}

.list-search-form .input {
  width: 100%;
}

.list-create-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.list-create-form .input {
  flex: 1;
}

.lists-container {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.list-item {
  background: var(--color-background);
  border-radius: var(--radius);
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.list-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
}

.list-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.list-items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.preview-item {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius);
}

.preview-more {
  font-size: 0.75rem;
  color: var(--color-primary);
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
