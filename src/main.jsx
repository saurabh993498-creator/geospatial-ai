import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import exifr from 'exifr';
import {
  Crosshair,
  Layers3,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { CircleMarker, ImageOverlay, MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const DEFAULT_LOCATION = {
  name: 'Delhi, India',
  center: [28.6139, 77.209],
};

const studyArea = [
  [28.795, 76.84],
  [28.88, 77.12],
  [28.86, 77.38],
  [28.48, 77.38],
  [28.40, 77.04],
  [28.53, 76.82],
];

const imagery2024 = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/52930/{z}/{y}/{x}';
const imagery2026 = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/64001/{z}/{y}/{x}';

function MapControls({ onFullscreen, onLocate }) {
  const map = useMap();

  return (
    <div className="map-controls">
      <button aria-label="Zoom in" onClick={() => map.zoomIn()}><Plus size={17} /></button>
      <button aria-label="Zoom out" onClick={() => map.zoomOut()}><Minus size={17} /></button>
      <button aria-label="Locate result" onClick={() => onLocate(map)}><LocateFixed size={16} /></button>
      <button aria-label="Fullscreen map" onClick={onFullscreen}><Maximize2 size={16} /></button>
    </div>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [activeLayer, setActiveLayer] = useState('satellite');
  const [showBoundary, setShowBoundary] = useState(true);
  const [compare, setCompare] = useState(true);
  const [historicalOpacity, setHistoricalOpacity] = useState(0.55);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageOpacity, setImageOpacity] = useState(0.5);
  const mapCardRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadedImageRef = useRef(null);

  useEffect(() => () => {
    if (uploadedImageRef.current?.url) URL.revokeObjectURL(uploadedImageRef.current.url);
  }, []);

  const searchLocation = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(value)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error('Location search failed');
      const results = await response.json();
      if (!results.length) {
        setMessage('No matching place found. Try a city, region, address, or coordinate.');
        return;
      }
      const result = results[0];
      const nextLocation = {
        name: result.display_name,
        center: [Number(result.lat), Number(result.lon)],
      };
      setLocation(nextLocation);
      if (uploadedImage && !uploadedImage.hasGps) {
        const nextImage = { ...uploadedImage, center: nextLocation.center };
        uploadedImageRef.current = nextImage;
        setUploadedImage(nextImage);
      }
    } catch (error) {
      setMessage('The place search is unavailable right now. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      setMessage('Unsupported image format. Upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Image is too large. Upload an image smaller than 10 MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        replaceUploadedImage({ name: file.name, url, center: location.center, hasGps: false });
        setMessage(`No GPS data found in ${file.name}. Comparing it at the selected map location: ${location.name}.`);
        return;
      }
      const imageLocation = {
        name: `Image location (${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)})`,
        center: [gps.latitude, gps.longitude],
      };
      setLocation(imageLocation);
      replaceUploadedImage({ name: file.name, url, center: imageLocation.center, hasGps: true });
      setMessage('Image location found from GPS metadata. The map moved to the image capture location.');
    } catch (error) {
      replaceUploadedImage({ name: file.name, url, center: location.center, hasGps: false });
      setMessage(`The image location could not be read. Comparing it at the selected map location: ${location.name}.`);
    }
  };

  const replaceUploadedImage = (nextImage) => {
    if (uploadedImageRef.current?.url) URL.revokeObjectURL(uploadedImageRef.current.url);
    uploadedImageRef.current = nextImage;
    setUploadedImage(nextImage);
  };

  const removeUploadedImage = () => {
    if (uploadedImageRef.current?.url) URL.revokeObjectURL(uploadedImageRef.current.url);
    uploadedImageRef.current = null;
    setUploadedImage(null);
  };

  const locateResult = (map) => map.flyTo(location.center, 12, { duration: 0.8 });

  return (
    <main className="map-app">
      <header className="map-header">
        <div className="brand">
          <div className="brand-mark"><Layers3 size={19} /></div>
          <div><strong>TerraScope</strong><span>GEOSPATIAL LAYER</span></div>
        </div>
        <div className="header-location"><Crosshair size={15} /> {location.name}</div>
      </header>

      <section className="map-workspace">
        <form className="query-bar" onSubmit={searchLocation}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask for a place, address, region, or coordinates"
            aria-label="Search for a place"
          />
          {query && <button type="button" aria-label="Clear query" onClick={() => setQuery('')}><X size={15} /></button>}
          <button className="search-submit" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Show on map'}</button>
        </form>
        <div className="image-query">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleImageUpload}
            hidden
          />
          <button type="button" className="upload-button" onClick={() => fileInputRef.current?.click()}>
            Compare an image
          </button>
          <span>Upload JPG, PNG, or WebP (max 10 MB)</span>
          {uploadedImage && (
            <>
              <strong title={uploadedImage.name}>{uploadedImage.name}</strong>
              <button type="button" className="remove-image" onClick={removeUploadedImage} aria-label="Remove uploaded image"><X size={14} /></button>
            </>
          )}
        </div>
        {message && <div className="query-message" role="status">{message}</div>}

        <div className="map-card" ref={mapCardRef}>
          <MapContainer center={DEFAULT_LOCATION.center} zoom={12} zoomControl={false} attributionControl={false} className="map">
            <MapViewport center={location.center} />
            <TileLayer
              url={activeLayer === 'satellite' ? imagery2026 : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
            />
            {activeLayer === 'satellite' && compare && (
              <TileLayer url={imagery2024} opacity={historicalOpacity} />
            )}
            {uploadedImage && (
              <ImageComparisonOverlay imageUrl={uploadedImage.url} center={uploadedImage.center} opacity={imageOpacity} />
            )}
            {showBoundary && location === DEFAULT_LOCATION && (
              <Polygon positions={studyArea} pathOptions={{ color: '#b9f36a', weight: 2, fillColor: '#a7e959', fillOpacity: 0.08, dashArray: '6 6' }} />
            )}
            <CircleMarker center={location.center} radius={8} pathOptions={{ color: '#173b2c', weight: 3, fillColor: '#b9f36a', fillOpacity: 1 }} />
            <MapControls
              onLocate={locateResult}
              onFullscreen={() => mapCardRef.current?.requestFullscreen?.()}
            />
          </MapContainer>
          <div className="map-label"><span /> {location.name} · 2024 ↔ 2026</div>
          <div className="map-attribution">© Esri, Vantor, Earthstar Geographics</div>
          <div className="map-legend">
            <button className={activeLayer === 'satellite' ? 'active' : ''} onClick={() => setActiveLayer('satellite')}>Satellite</button>
            <button className={activeLayer === 'street' ? 'active' : ''} onClick={() => setActiveLayer('street')}>Street map</button>
            <label><i className="boundary-key" /> Study boundary <input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)} /></label>
            <label className="compare-toggle">Compare 2024 / 2026 <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /></label>
            {compare && activeLayer === 'satellite' && (
              <label className="opacity-control">
                <span>2024 layer</span>
                <input type="range" min="0" max="1" step="0.05" value={historicalOpacity} onChange={(event) => setHistoricalOpacity(Number(event.target.value))} />
                <span>2026</span>
              </label>
            )}
            {uploadedImage && (
              <label className="opacity-control">
                <span>Uploaded image</span>
                <input type="range" min="0.1" max="1" step="0.05" value={imageOpacity} onChange={(event) => setImageOpacity(Number(event.target.value))} />
              </label>
            )}
          </div>
        </div>
        <div className="comparison-note">
          <strong>Visual change comparison</strong>
          <span>{uploadedImage ? (uploadedImage.hasGps ? 'Uploaded image is positioned using its GPS metadata. Adjust opacity to compare it with the current map.' : 'Uploaded image has no GPS metadata, so it is positioned at the selected map location. Adjust opacity for a visual comparison.') : '2024 imagery is overlaid on the 26 Feb 2026 World Imagery snapshot. Upload an image to compare it with the selected location.'}</span>
        </div>
      </section>
    </main>
  );
}

function MapViewport({ center }) {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(center, 12, { duration: 0.8 });
  }, [center, map]);
  return null;
}

function ImageComparisonOverlay({ imageUrl, center, opacity }) {
  const map = useMap();
  const mapSize = map.getSize();
  const metersPerPixel = (40075016.686 * Math.cos((center[0] * Math.PI) / 180)) / (256 * 2 ** map.getZoom());
  const widthMeters = mapSize.x * metersPerPixel * 0.45;
  const heightMeters = mapSize.y * metersPerPixel * 0.45;
  const bounds = [
    [center[0] - heightMeters / 111320, center[1] - widthMeters / (111320 * Math.cos((center[0] * Math.PI) / 180))],
    [center[0] + heightMeters / 111320, center[1] + widthMeters / (111320 * Math.cos((center[0] * Math.PI) / 180))],
  ];
  return <ImageOverlay url={imageUrl} bounds={bounds} opacity={opacity} />;
}

createRoot(document.getElementById('root')).render(<App />);
