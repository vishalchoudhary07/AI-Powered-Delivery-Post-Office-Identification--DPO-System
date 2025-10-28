'use client';
import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapStyles = {
  streets: `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
  topo: `https://api.maptiler.com/maps/topo-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
};

export default function MapComponent({ searchResults, selectedPost }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [currentStyle, setCurrentStyle] = useState('streets');

  const isValidCoordinate = (lat, lng) => {
    return (
      lat !== null &&
      lat !== undefined &&
      lng !== null &&
      lng !== undefined &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyles[currentStyle],
      center: [78.4867, 17.3850],
      zoom: 10,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyles[currentStyle]);
  }, [currentStyle]);

  useEffect(() => {
    if (!map.current || !searchResults) return;

    markers.current.forEach(markerData => markerData.marker.remove());
    markers.current = [];

    const validPosts = searchResults.filter(post => 
      isValidCoordinate(post.latitude, post.longitude)
    );

    if (validPosts.length === 0) return;

    validPosts.forEach((post) => {
      const isSelected = selectedPost?.id === post.id;
      
      const wrapper = document.createElement('div');
      wrapper.className = 'marker-wrapper';
      wrapper.style.width = '30px';
      wrapper.style.height = '40px';
      wrapper.style.cursor = 'pointer';
      
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.transition = 'transform 0.2s ease';
      
      el.innerHTML = `
        <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25c0-8.284-6.716-15-15-15z" 
                fill="${isSelected ? '#ef4444' : '#3b82f6'}" 
                stroke="#ffffff" 
                stroke-width="2"/>
          <circle cx="15" cy="15" r="5" fill="#ffffff"/>
        </svg>
      `;
      
      if (isSelected) {
        el.style.animation = 'pulse 2s infinite';
      }

      wrapper.onmouseenter = function() {
        el.style.transform = 'scale(1.1)';
      };

      wrapper.onmouseleave = function() {
        el.style.transform = 'scale(1)';
      };

      wrapper.appendChild(el);

      // ✅ Enhanced popup with state information
      const stateName = post.state_name || post.state || '';
      
      const popup = new maplibregl.Popup({ 
        offset: 25, 
        className: 'custom-popup',
        closeButton: true,
        closeOnClick: false
      }).setHTML(
        `<div style="padding: 12px; min-width: 220px;">
          <h3 style="margin: 0 0 10px 0; font-weight: 600; color: #1f2937; font-size: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">${post.name}</h3>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <p style="margin: 0; color: #4b5563; font-size: 14px;">
              <strong style="color: #1f2937;">📮 Pincode:</strong> ${post.pincode}
            </p>
            <p style="margin: 0; color: #4b5563; font-size: 14px;">
              <strong style="color: #1f2937;">🏛️ District:</strong> ${post.district}
            </p>
            ${stateName ? `<p style="margin: 0; color: #4b5563; font-size: 14px;">
              <strong style="color: #1f2937;">🗺️ State:</strong> ${stateName}
            </p>` : ''}
            ${post.distance_km ? `<p style="margin: 6px 0 0 0; color: #2563eb; font-size: 14px; font-weight: 600; padding-top: 6px; border-top: 1px solid #e5e7eb;">
              📍 ${post.distance_km.toFixed(2)} km away
            </p>` : ''}
          </div>
        </div>`
      );

      const marker = new maplibregl.Marker({ 
        element: wrapper,
        anchor: 'bottom'
      })
        .setLngLat([post.longitude, post.latitude])
        .setPopup(popup)
        .addTo(map.current);

      markers.current.push({
        id: post.id,
        marker: marker,
        popup: popup
      });
    });

    if (validPosts.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      
      validPosts.forEach(post => {
        bounds.extend([post.longitude, post.latitude]);
      });

      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
        duration: 1000
      });
    }
  }, [searchResults, selectedPost]);

  useEffect(() => {
    if (!map.current || !selectedPost) return;
    
    if (isValidCoordinate(selectedPost.latitude, selectedPost.longitude)) {
      map.current.flyTo({
        center: [selectedPost.longitude, selectedPost.latitude],
        zoom: 14,
        duration: 1500,
        essential: true
      });

      const selectedMarkerData = markers.current.find(m => m.id === selectedPost.id);
      if (selectedMarkerData) {
        markers.current.forEach(m => {
          if (m.id !== selectedPost.id && m.marker.getPopup().isOpen()) {
            m.marker.togglePopup();
          }
        });
        
        if (!selectedMarkerData.marker.getPopup().isOpen()) {
          selectedMarkerData.marker.togglePopup();
        }
      }
    }
  }, [selectedPost]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 flex gap-2 z-10">
        <button
          onClick={() => setCurrentStyle('streets')}
          className={`px-4 py-2 rounded font-medium transition-all duration-200 transform active:scale-95 ${
            currentStyle === 'streets'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          🗺️ Streets
        </button>
        <button
          onClick={() => setCurrentStyle('satellite')}
          className={`px-4 py-2 rounded font-medium transition-all duration-200 transform active:scale-95 ${
            currentStyle === 'satellite'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          🛰️ Satellite
        </button>
        <button
          onClick={() => setCurrentStyle('topo')}
          className={`px-4 py-2 rounded font-medium transition-all duration-200 transform active:scale-95 ${
            currentStyle === 'topo'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          ⛰️ Topo
        </button>
      </div>
    </div>
  );
}
