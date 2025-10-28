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
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/states/`);
        if (!response.ok) throw new Error('Failed to fetch states');
        const data = await response.json();
        setStates(data.states || []);
      } catch (error) { 
        console.error("Failed to fetch states:", error);
        setError("Failed to load states");
      }
    };
    fetchStates();
  }, []);

  useEffect(() => {
    if (!selectedState) return;
    const fetchDistricts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/districts/?state=${encodeURIComponent(selectedState)}`);
        if (!response.ok) throw new Error('Failed to fetch districts');
        const data = await response.json();
        setDistricts(data.districts || []);
      } catch (error) { 
        console.error("Failed to fetch districts:", error);
        setError("Failed to load districts");
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchDistricts();
  }, [selectedState]);

  useEffect(() => {
    if (!selectedDistrict) return;
    const fetchPosts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/posts/?district=${encodeURIComponent(selectedDistrict)}`);
        if (!response.ok) throw new Error('Failed to fetch posts');
        let data = await response.json();
        let posts = data.posts || [];
        
        if (userLocation && posts.length > 0) {
          posts = posts.map(post => {
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
        
        setResults(posts);
        if (posts.length > 0) setSelectedPost(posts[0]);

      } catch (error) { 
        console.error("Failed to fetch posts:", error);
        setError("Failed to load post offices");
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchPosts();
  }, [selectedDistrict, userLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude }),
        (error) => setLocationError("Location access denied. Search results may be limited.")
      );
    } else {
      setLocationError("Geolocation is not supported.");
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (query.trim() === '') {
      setResults([]);
      setSelectedPost(null);
      return;
    }
    
    if (!userLocation) {
      setError("Please enable location access for search");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // ✅ CHANGED: Added radius_km=500 parameter
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/posts/hybrid-search/?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lon=${userLocation.lon}&radius_km=500`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle both array response and object with results property
      const posts = Array.isArray(data) ? data : (data.results || data.posts || []);
      
      setResults(posts);
      if (posts.length > 0) {
        setSelectedPost(posts[0]);
      } else {
        setSelectedPost(null);
        setError("No results found. Try a different search term.");
      }
    } catch (error) { 
      console.error('Search failed:', error);
      setError(`Search failed: ${error.message}`);
      setResults([]);
      setSelectedPost(null);
    } finally { 
      setIsLoading(false); 
    }
  }, [query, userLocation]);

  useEffect(() => {
    const timer = setTimeout(() => { 
      if (query.trim() !== '') handleSearch(); 
    }, 500);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);
  
  const resetBrowse = () => {
    setSelectedState(null);
    setSelectedDistrict(null);
    setDistricts([]);
    setResults([]);
    setSelectedPost(null);
    setError(null);
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
        <strong style={{ color: '#1a1a1a', paddingRight: '10px' }}>{post.office_name || post.name}</strong>
        {post.distance_km !== undefined && (
          <span style={{ color: '#007bff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {post.distance_km.toFixed(1)} km
          </span>
        )}
      </div>
      <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
        Pincode: {post.pincode}
      </p>
      <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
        {post.district}, {post.state_name || post.state}
      </p>
    </div>
  );

  return (
    <main style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '400px', padding: '20px', overflowY: 'auto', background: '#f7f7f7' }}>
        <h1 style={{ color: '#1a1a1a', marginBottom: '20px' }}>Delivery Post Office Finder</h1>
        
        <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
          <button onClick={() => { setView('search'); resetBrowse(); }} style={{ flex: 1, padding: '10px', background: view === 'search' ? '#007bff' : 'transparent', color: view === 'search' ? '#fff' : '#333', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Search</button>
          <button onClick={() => { setView('browse'); setQuery(''); setResults([]); setSelectedPost(null); setError(null); }} style={{ flex: 1, padding: '10px', background: view === 'browse' ? '#007bff' : 'transparent', color: view === 'browse' ? '#fff' : '#333', border: 'none', cursor: 'pointer', fontSize: '16px' }}>Browse</button>
        </div>

        {view === 'search' ? (
          <>
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search by area..." 
              style={{ width: '100%', padding: '12px', fontSize: '16px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '8px', boxSizing: 'border-box', color: '#1a1a1a' }} 
            />
            
            {isLoading && <p style={{ color: '#007bff', margin: '10px 0', fontWeight: 'bold' }}>Loading...</p>}
            {locationError && <p style={{color: '#ff6b6b', marginBottom: '15px', padding: '10px', background: '#fff', borderRadius: '8px', fontSize: '14px'}}>{locationError}</p>}
            {error && <p style={{color: '#ff6b6b', marginBottom: '15px', padding: '10px', background: '#fff', borderRadius: '8px', fontSize: '14px'}}>{error}</p>}
            
            <div>
              {results.length === 0 && query && !isLoading && !error && (
                <p style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>No results found</p>
              )}
              {results.map((post) => <PostResultCard key={post.id} post={post} />)}
            </div>
          </>
        ) : (
          <>
            {isLoading && <p style={{ color: '#007bff', margin: '10px 0', fontWeight: 'bold' }}>Loading...</p>}
            {error && <p style={{color: '#ff6b6b', marginBottom: '15px', padding: '10px', background: '#fff', borderRadius: '8px', fontSize: '14px'}}>{error}</p>}
            
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
