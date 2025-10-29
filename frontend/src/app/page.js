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

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/posts/fulltext-search?q=${encodeURIComponent(query)}&limit=20`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const posts = data.results || [];
      
      if (userLocation && posts.length > 0) {
        const postsWithDistance = posts.map(post => {
          if (post.latitude && post.longitude) {
            const distanceInMeters = getDistance(
              { latitude: userLocation.lat, longitude: userLocation.lon },
              { latitude: post.latitude, longitude: post.longitude }
            );
            return { ...post, distance_km: distanceInMeters / 1000 };
          }
          return post;
        });
        
        postsWithDistance.sort((a, b) => (a.distance_km || 999999) - (b.distance_km || 999999));
        
        setSearchResults(postsWithDistance);
        setResults(postsWithDistance);
        if (postsWithDistance.length > 0) {
          setSelectedPost(postsWithDistance[0]);
        }
      } else {
        setSearchResults(posts);
        setResults(posts);
        if (posts.length > 0) {
          setSelectedPost(posts[0]);
        } else {
          setSelectedPost(null);
          setError("No results found. Try a different search term.");
        }
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

  // Skeleton loader component
  const SkeletonLoader = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse bg-white dark:bg-gray-800">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );

  // Post card component - NO STATUS BADGE
  const PostCard = ({ post, isSelected, onClick }) => (
    <div
      onClick={onClick}
      className={`group relative p-4 mb-3 border rounded-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 ${
        isSelected
          ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.office_name || post.name || 'Post Office'}
        </h3>
        {isSelected && (
          <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
        )}
      </div>
      
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">📮</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{post.pincode}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>📍</span>
          <span>{post.district}, {post.state_name || post.state}</span>
        </div>

        {post.distance_km && userLocation && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lon}&destination=${post.latitude},${post.longitude}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span>🗺️</span>
            <span>{post.distance_km.toFixed(2)} km away</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );

  const ListItem = ({ text, onClick }) => (
    <div
      onClick={onClick}
      className="p-3.5 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 hover:translate-x-1 rounded-lg border border-transparent hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md text-gray-900 dark:text-gray-100 font-medium"
    >
      {text}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-950">
      {/* Left Panel - Enhanced */}
      <div className="md:w-[420px] w-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl">📮</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Post Office Finder
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Find nearby delivery points</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* View Toggle - Modern Pills */}
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              onClick={() => handleViewChange('search')}
              className={`flex-1 px-4 py-2.5 rounded-md transition-all duration-200 font-medium text-sm ${
                view === 'search'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              🔍 Search
            </button>
            <button
              onClick={() => handleViewChange('browse')}
              className={`flex-1 px-4 py-2.5 rounded-md transition-all duration-200 font-medium text-sm ${
                view === 'browse'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📂 Browse
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {/* Search View */}
          {view === 'search' && (
            <div>
              {/* Enhanced Search Bar */}
              <div className="relative mb-4">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </div>
                <input
                  type="text"
                  placeholder="Search by name, pincode, city..."
                  value={query}
                  onChange={handleQueryChange}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl transition-all duration-200 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none ${
                    isTyping 
                      ? 'border-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/30 shadow-lg' 
                      : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                />
                {isTyping && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Info Banner */}
              {locationError && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</span>
                  <p className="text-sm text-blue-900 dark:text-blue-300 flex-1">
                    {locationError} Search will work without distance calculations.
                  </p>
                </div>
              )}

              {/* Loading State */}
              {isLoading && <SkeletonLoader />}

              {/* Error State */}
              {error && !isLoading && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                  <p className="text-red-900 dark:text-red-300 font-medium">❌ {error}</p>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && results.length === 0 && query && !error && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No results found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
                </div>
              )}

              {/* Results */}
              {!isLoading && results.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Found {results.length} result{results.length !== 1 ? 's' : ''}
                  </p>
                  {results.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isSelected={selectedPost?.id === post.id}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Browse View */}
          {view === 'browse' && (
            <div>
              {isLoading && <SkeletonLoader />}

              {error && !isLoading && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                  <p className="text-red-900 dark:text-red-300 font-medium">❌ {error}</p>
                </div>
              )}

              {!selectedState && !isLoading && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">Select a state:</p>
                  <div className="space-y-2">
                    {states.map(s => (
                      <ListItem key={s} text={s} onClick={() => setSelectedState(s)} />
                    ))}
                  </div>
                </div>
              )}

              {selectedState && !selectedDistrict && !isLoading && (
                <>
                  <button
                    onClick={() => setSelectedState(null)}
                    className="mb-4 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 font-medium inline-flex items-center gap-2"
                  >
                    <span>←</span> Back to States
                  </button>
                  <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100">{selectedState}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">Select a district:</p>
                  <div className="space-y-2">
                    {districts.map(d => (
                      <ListItem key={d} text={d} onClick={() => setSelectedDistrict(d)} />
                    ))}
                  </div>
                </>
              )}

              {selectedDistrict && !isLoading && (
                <>
                  <button
                    onClick={() => setSelectedDistrict(null)}
                    className="mb-4 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 font-medium inline-flex items-center gap-2"
                  >
                    <span>←</span> Back to Districts
                  </button>
                  <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100">{selectedDistrict}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Found {results.length} post office{results.length !== 1 ? 's' : ''}
                  </p>
                  {results.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      isSelected={selectedPost?.id === post.id}
                      onClick={() => setSelectedPost(post)}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative">
        <MapComponent
          searchResults={results}
          selectedPost={selectedPost}
        />
      </div>
    </div>
  );
}
