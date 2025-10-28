"use client";
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getDistance } from 'geolib';
import ThemeToggle from '../components/ThemeToggle';

const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });

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
  const [isTyping, setIsTyping] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [browseResults, setBrowseResults] = useState([]);

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
        
        setBrowseResults(posts);
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
        (position) => setUserLocation({ 
          lat: position.coords.latitude, 
          lon: position.coords.longitude 
        }),
        (error) => setLocationError("Location access denied. Search results may be limited.")
      );
    } else {
      setLocationError("Geolocation is not supported.");
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (query.trim() === '') {
      setSearchResults([]);
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
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/posts/hybrid-search/?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lon=${userLocation.lon}&radius_km=500`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const posts = Array.isArray(data) ? data : (data.results || data.posts || []);
      
      setSearchResults(posts);
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
      setSearchResults([]);
      setResults([]);
      setSelectedPost(null);
    } finally {
      setIsLoading(false);
    }
  }, [query, userLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() !== '') handleSearch();
      setIsTyping(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setIsTyping(true);
  };

  const resetBrowse = () => {
    setSelectedState(null);
    setSelectedDistrict(null);
    setDistricts([]);
    setBrowseResults([]);
  };

  const handleViewChange = (newView) => {
    setView(newView);
    
    if (newView === 'search') {
      setResults(searchResults);
      if (searchResults.length > 0) {
        setSelectedPost(searchResults[0]);
      } else {
        setSelectedPost(null);
      }
      setSelectedState(null);
      setSelectedDistrict(null);
      setDistricts([]);
    } else if (newView === 'browse') {
      setResults(browseResults);
      if (browseResults.length > 0) {
        setSelectedPost(browseResults[0]);
      } else {
        setSelectedPost(null);
      }
    }
    setError(null);
  };

  const ListItem = ({ text, onClick }) => (
    <div
      onClick={onClick}
      className="p-3 cursor-pointer transition-all duration-200 hover:bg-blue-100 dark:hover:bg-gray-700 hover:translate-x-1 hover:shadow-md rounded-lg border border-transparent hover:border-blue-300 dark:hover:border-blue-600 text-gray-900 dark:text-gray-100"
      style={{ willChange: 'transform' }}
    >
      {text}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white dark:bg-gray-900">
      {/* Left Panel */}
      <div className="md:w-1/3 w-full overflow-auto p-4 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {/* Header with Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            📮 Delivery Post Office Finder
          </h1>
          <ThemeToggle />
        </div>

        {/* View Toggle Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleViewChange('search')}
            className={`px-4 py-2 rounded transition-all duration-200 transform active:scale-95 font-medium ${
              view === 'search'
                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 hover:shadow-md'
            }`}
          >
            🔍 Search
          </button>
          <button
            onClick={() => handleViewChange('browse')}
            className={`px-4 py-2 rounded transition-all duration-200 transform active:scale-95 font-medium ${
              view === 'browse'
                ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 hover:shadow-md'
            }`}
          >
            📂 Browse
          </button>
        </div>

        {/* Search View */}
        {view === 'search' && (
          <div>
            <input
              type="text"
              placeholder="Search post offices..."
              value={query}
              onChange={handleQueryChange}
              className={`w-full p-2 border rounded mb-4 transition-all duration-200 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 ${
                isTyping ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-300 dark:border-gray-600'
              }`}
            />

            {isLoading && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-800 dark:text-blue-300 font-medium">Loading...</span>
              </div>
            )}

            {locationError && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded text-yellow-900 dark:text-yellow-300">
                {locationError}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded text-red-900 dark:text-red-300">
                {error}
              </div>
            )}

            {!isLoading && results.length === 0 && query && (
              <p className="text-gray-600 dark:text-gray-400">No results found</p>
            )}
            
            {results.map((post, index) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className={`p-4 mb-2 border rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
                  selectedPost?.id === post.id
                    ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/30 shadow-md text-gray-900 dark:text-gray-100'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700'
                }`}
                style={{ 
                  animationName: 'fadeInUp',
                  animationDuration: '0.3s',
                  animationTimingFunction: 'ease',
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'forwards',
                  opacity: 0
                }}
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{post.name}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">Pincode: {post.pincode}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{post.district}, {post.state_name || post.state}</p>
                {post.distance_km && (
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mt-1">
                    📍 {post.distance_km.toFixed(2)} km away
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Browse View */}
        {view === 'browse' && (
          <div>
            {isLoading && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-800 dark:text-blue-300 font-medium">Loading...</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-600 rounded text-red-900 dark:text-red-300">
                {error}
              </div>
            )}

            {!selectedState && states.map(s => (
              <ListItem key={s} text={s} onClick={() => setSelectedState(s)} />
            ))}

            {selectedState && !selectedDistrict && (
              <>
                <button
                  onClick={() => setSelectedState(null)}
                  className="mb-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 transform active:scale-95 font-medium"
                >
                  ← Back to States
                </button>
                <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{selectedState}</h2>
                {districts.map(d => (
                  <ListItem key={d} text={d} onClick={() => setSelectedDistrict(d)} />
                ))}
              </>
            )}

            {selectedDistrict && (
              <>
                <button
                  onClick={() => setSelectedDistrict(null)}
                  className="mb-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 transform active:scale-95 font-medium"
                >
                  ← Back to Districts
                </button>
                <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{selectedDistrict}</h2>
                {results.map((post, index) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className={`p-4 mb-2 border rounded-lg cursor-pointer transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
                      selectedPost?.id === post.id
                        ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/30 shadow-md text-gray-900 dark:text-gray-100'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-gray-700'
                    }`}
                    style={{ 
                      animationName: 'fadeInUp',
                      animationDuration: '0.3s',
                      animationTimingFunction: 'ease',
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'forwards',
                      opacity: 0
                    }}
                  >
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{post.name}</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Pincode: {post.pincode}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right Panel - Map */}
      <div className="md:w-2/3 w-full">
        <MapComponent
          searchResults={results}
          selectedPost={selectedPost}
        />
      </div>
    </div>
  );
}
