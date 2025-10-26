"use client";
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getDistance } from 'geolib';

const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false
});

export default function Home() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [view, setView] = useState('search');
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/states/`);
        const data = await response.json();
        setStates(data);
      } catch (error) { console.error("Failed to fetch states:", error); }
    };
    fetchStates();
  }, []);

  useEffect(() => {
    if (!selectedState) return;
    const fetchDistricts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/districts/?state=${encodeURIComponent(selectedState)}`);
        const data = await response.json();
        setDistricts(data);
      } catch (error) { console.error("Failed to fetch districts:", error); }
      finally { setIsLoading(false); }
    };
    fetchDistricts();
  }, [selectedState]);

  useEffect(() => {
    if (!selectedDistrict) return;
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/posts/?district=${encodeURIComponent(selectedDistrict)}`);
        let data = await response.json();
        
        if (userLocation && data.length > 0) {
          data = data.map(post => {
            if (post.latitude && post.longitude) {
              const distanceInMeters = getDistance(
                { latitude: userLocation.lat, longitude: userLocation.lon },
                { latitude: post.latitude, longitude: post.longitude }
              );
              return { ...post, distance_km: distanceInMeters / 1000 };
            }
            return post;
          });
        }
        
        setResults(data);
        if (data.length > 0) setSelectedPost(data[0]);

      } catch (error) { console.error("Failed to fetch posts:", error); }
      finally { setIsLoading(false); }
    };
    fetchPosts();
  }, [selectedDistrict, userLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude }),
        (error) => setLocationError("Location access denied.")
      );
    } else {
      setLocationError("Geolocation is not supported.");
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (query.trim() === '' || !userLocation) return;
    setIsLoading(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/posts/hybrid-search/?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lon=${userLocation.lon}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setResults(data);
      if (data.length > 0) setSelectedPost(data[0]);
      else setSelectedPost(null);
    } catch (error) { console.error('Search failed:', error); }
    finally { setIsLoading(false); }
  }, [query, userLocation]);

  useEffect(() => {
    const timer = setTimeout(() => { if (query.trim() !== '') handleSearch(); }, 500);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);
  
  const resetBrowse = () => {
    setSelectedState(null);
    setSelectedDistrict(null);
    setDistricts([]);
    setResults([]);
    setSelectedPost(null);
  };

  const ListItem = ({ text, onClick }) => (
    <div onClick={onClick} style={{ padding: '12px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', fontWeight: '500', color: '#1a1a1a' }}>
      {text}
    </div>
  );
  
  const backButtonStyle = {
    marginBottom: '15px', padding: '8px 12px', background: '#f0f0f0', color: '#333',
    border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
  };

  const PostResultCard = ({ post }) => (
    <div 
      key={post.id} 
      onClick={() => setSelectedPost(post)} 
      style={{ background: '#ffffff', border: selectedPost?.id === post.id ? '2px solid #007bff' : '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '12px', cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: '#1a1a1a', paddingRight: '10px' }}>{post.office_name}</strong>
        {post.distance_km !== undefined && (
          <span style={{ color: '#007bff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {post.distance_km.toFixed(1)} km
          </span>
        )}
      </div>
      <p style={{ margin: '8px 0 0', color: '#4a4a4a' }}>{post.address}</p>
    </div>
  );

  return (
    <main style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '400px', padding: '20px', overflowY: 'auto', background: '#f7f7f7' }}>
        <h1 style={{ color: '#1a1a1a', marginBottom: '20px' }}>Delivery Post Office Finder</h1>
        <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
          <button onClick={() => { setView('search'); resetBrowse(); }} style={{ flex: 1, padding: '10px', background: view === 'search' ? '#007bff' : 'transparent', color: view === 'search' ? '#fff' : '#333', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Search</button>
          <button onClick={() => { setView('browse'); setQuery(''); setResults([]); setSelectedPost(null); }} style={{ flex: 1, padding: '10px', background: view === 'browse' ? '#007bff' : 'transparent', color: view === 'browse' ? '#fff' : '#333', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Browse</button>
        </div>
        {view === 'search' ? (
          <>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by area..." style={{ width: '100%', padding: '12px', fontSize: '16px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '8px', boxSizing: 'border-box', color: '#1a1a1a' }} />
            {/* --- THIS IS THE FIX --- */}
            {isLoading && <p style={{ color: '#4a4a4a', margin: '10px 0', fontWeight: 'bold' }}>Loading...</p>}
            {locationError && <p style={{color: 'red'}}>{locationError}</p>}
            <div>
              {results.map((post) => <PostResultCard key={post.id} post={post} />)}
            </div>
          </>
        ) : (
          <>
            {/* --- AND HERE AS WELL --- */}
            {isLoading && <p style={{ color: '#4a4a4a', margin: '10px 0', fontWeight: 'bold' }}>Loading...</p>}
            {!selectedState && states.map(s => <ListItem key={s} text={s} onClick={() => setSelectedState(s)} />)}
            {selectedState && !selectedDistrict && (
              <>
                <button onClick={() => { setSelectedState(null); setDistricts([]); }} style={backButtonStyle}>&larr; Back to States</button>
                {districts.map(d => <ListItem key={d} text={d} onClick={() => setSelectedDistrict(d)} />)}
              </>
            )}
            {selectedDistrict && (
              <>
                <button onClick={() => { setSelectedDistrict(null); setResults([]); setSelectedPost(null); }} style={backButtonStyle}>&larr; Back to Districts</button>
                {results.map((post) => <PostResultCard key={post.id} post={post} />)}
              </>
            )}
          </>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <MapComponent searchResults={results} selectedPost={selectedPost} />
      </div>
    </main>
  );
}