'use client';

import React, { useState, useEffect } from 'react';
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

export function TokenLogo({ 
  tokenAddress, 
  size = 'md', 
  className = '',
  fallbackText = '?'
}: TokenLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchLogo = async () => {
      if (!tokenAddress) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const url = await getTokenLogoCached(tokenAddress);
        console.log(`TokenLogo: Got URL for ${tokenAddress}:`, url);
        setLogoUrl(url);
      } catch (err) {
        console.error('Error fetching token logo:', err);
        setError(true);
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
