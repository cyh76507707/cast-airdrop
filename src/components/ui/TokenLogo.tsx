'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getTokenLogoCached } from '@/lib/mintclub';

interface TokenLogoProps {
  tokenAddress: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackText?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

// Component-level cache to prevent unnecessary re-fetching
const componentLogoCache = new Map<string, { url: string | null; loading: boolean; error: boolean }>();

export function TokenLogo({ 
  tokenAddress, 
  size = 'md', 
  className = '',
  fallbackText = '?'
}: TokenLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Memoize the logo fetching logic
  const logoData = useMemo(() => {
    if (!tokenAddress) {
      return { url: null, loading: false, error: false };
    }

    // Check component-level cache first
    if (componentLogoCache.has(tokenAddress)) {
      const cached = componentLogoCache.get(tokenAddress)!;
      return cached;
    }

    // If not in cache, return loading state
    return { url: null, loading: true, error: false };
  }, [tokenAddress]);

  useEffect(() => {
    const fetchLogo = async () => {
      if (!tokenAddress) {
        setLoading(false);
        return;
      }

      // Check if we already have cached data
      if (componentLogoCache.has(tokenAddress)) {
        const cached = componentLogoCache.get(tokenAddress)!;
        setLogoUrl(cached.url);
        setLoading(cached.loading);
        setError(cached.error);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const url = await getTokenLogoCached(tokenAddress);
        console.log(`TokenLogo: Got URL for ${tokenAddress}:`, url);
        
        // Cache the result
        componentLogoCache.set(tokenAddress, { url, loading: false, error: false });
        
        setLogoUrl(url);
      } catch (err) {
        console.error('Error fetching token logo:', err);
        setError(true);
        
        // Cache the error state
        componentLogoCache.set(tokenAddress, { url: null, loading: false, error: true });
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, [tokenAddress]);

  if (loading) {
    return (
      <div 
        className={`${sizeClasses[size]} ${className} bg-gray-200 rounded-full animate-pulse flex items-center justify-center`}
      >
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
      </div>
    );
  }

  if (error || !logoUrl) {
    return (
      <div 
        className={`${sizeClasses[size]} ${className} bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs font-medium`}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt="Token logo"
      className={`${sizeClasses[size]} ${className} rounded-full object-cover`}
      onError={() => setError(true)}
    />
  );
}
