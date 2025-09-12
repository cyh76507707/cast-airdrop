'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="bg-gradient-to-r from-pink-500/10 via-orange-400/10 to-yellow-400/10 backdrop-blur-sm border-b border-pink-200/50 shadow-lg shadow-pink-100/30">
      <div className="container mx-auto px-3 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Colorful DropCast Logo */}
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-orange-400 to-yellow-400 flex items-center justify-center shadow-lg shadow-pink-200/50">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-pink-600 font-bold text-sm">💧</span>
                </div>
              </div>
              {/* Floating particles effect */}
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full animate-pulse"></div>
              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-br from-pink-400 to-purple-400 rounded-full animate-pulse delay-300"></div>
            </div>
            
            <div>
              <h1 className="text-xl font-bold font-display bg-gradient-to-r from-pink-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                DropCast
              </h1>
              <p className="text-xs text-gray-600 font-medium">Community Rewards</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
    </header>
  );
}
