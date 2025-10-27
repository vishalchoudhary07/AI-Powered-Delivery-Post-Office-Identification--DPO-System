'use client';

import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
//mapboxgl.accessToken = 'YOUR_DUMMY_TOKEN';

const mapStyles = {
  streets: `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
  topo: `https://api.maptiler.com/maps/topo-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
};

export default function MapComponent({ searchResults, selectedPost }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [currentStyle, setCurrentStyle] = useState(mapStyles.streets);

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: currentStyle,
      center: [78.4867, 17.3850],
      zoom: 10,
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(currentStyle);
  }, [currentStyle]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    if (searchResults?.length > 0) {
      searchResults.forEach(post => {
        if (post.latitude && post.longitude) {
          const isSelected = post.id === selectedPost?.id;
          const markerColor = isSelected ? '#d9534f' : '#007bff';

          // --- NEW: Build a detailed HTML string for the popup ---
          let detailsHTML = '';
          Object.entries(post).forEach(([key, value]) => {
            if (!['id', 'latitude', 'longitude', 'embedding', 'distance_km'].includes(key)) {
              const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              detailsHTML += `<li style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee;">
                                <strong style="margin-right: 10px;">${formattedKey}:</strong>
                                <span>${value || 'N/A'}</span>
                              </li>`;
            }
          });

          const popupHTML = `
            <div style="color: #333; font-family: sans-serif; max-width: 280px;">
              <h3 style="margin: 0 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #007bff;">${post.office_name}</h3>
              <ul style="list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto;">
                ${detailsHTML}
              </ul>
            </div>
          `;
          
          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);
          
          const marker = new mapboxgl.Marker({ color: markerColor })
            .setLngLat([post.longitude, post.latitude])
            .setPopup(popup)
            .addTo(map.current);

          if (isSelected) {
            marker.togglePopup();
          }

          markers.current.push(marker);
        }
      });
    }
  }, [searchResults, selectedPost]);

  useEffect(() => {
    if (map.current && selectedPost?.latitude && selectedPost?.longitude) {
      map.current.flyTo({
        center: [selectedPost.longitude, selectedPost.latitude],
        zoom: 14,
        essential: true,
      });
    }
  }, [selectedPost]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
        <select
          onChange={(e) => setCurrentStyle(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            color: '#333',
          }}
        >
          <option value={mapStyles.streets}>Streets</option>
          <option value={mapStyles.satellite}>Satellite</option>
          <option value={mapStyles.topo}>Terrain</option>
        </select>
      </div>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}