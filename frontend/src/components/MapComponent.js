'use client';
import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapTiler style URLs - NO TOKEN NEEDED FOR MAPLIBRE!
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

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: currentStyle,
      center: [78.4867, 17.3850], // Default center (Hyderabad, India)
      zoom: 10,
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
  }, []);

  // Handle style changes
  useEffect(() => {
    if (!map.current) return;
    
    map.current.setStyle(currentStyle);
  }, [currentStyle]);

  // Update markers when search results change
  useEffect(() => {
    if (!map.current || !searchResults) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add new markers
    searchResults.forEach((post) => {
      if (post.latitude && post.longitude) {
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = selectedPost?.id === post.id ? '#ff0000' : '#007bff';
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([post.longitude, post.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 25 })
              .setHTML(
                `<div style="padding: 10px;">
                  <strong>${post.office_name || post.name}</strong><br/>
                  <span style="color: #666;">Pincode: ${post.pincode}</span><br/>
                  <span style="color: #666;">${post.district}, ${post.state_name || post.state}</span>
                  ${post.distance_km ? `<br/><span style="color: #007bff; font-weight: bold;">${post.distance_km.toFixed(1)} km away</span>` : ''}
                </div>`
              )
          )
          .addTo(map.current);

        markers.current.push(marker);
      }
    });

    // Fit map to show all markers
    if (searchResults.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      searchResults.forEach((post) => {
        if (post.latitude && post.longitude) {
          bounds.extend([post.longitude, post.latitude]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [searchResults, selectedPost]);

  // Center map on selected post
  useEffect(() => {
    if (!map.current || !selectedPost) return;

    if (selectedPost.latitude && selectedPost.longitude) {
      map.current.flyTo({
        center: [selectedPost.longitude, selectedPost.latitude],
        zoom: 14,
        duration: 1000,
      });

      // Update marker colors
      markers.current.forEach((marker, index) => {
        const el = marker.getElement();
        el.style.backgroundColor = searchResults[index]?.id === selectedPost.id ? '#ff0000' : '#007bff';
      });
    }
  }, [selectedPost, searchResults]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      
      {/* Map Style Selector */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '50px',
        background: 'white',
        borderRadius: '4px',
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        zIndex: 1
      }}>
        <select
          value={currentStyle}
          onChange={(e) => setCurrentStyle(e.target.value)}
          style={{
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <option value={mapStyles.streets}>Streets</option>
          <option value={mapStyles.satellite}>Satellite</option>
          <option value={mapStyles.topo}>Topographic</option>
        </select>
      </div>
    </div>
  );
}
