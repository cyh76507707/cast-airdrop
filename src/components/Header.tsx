'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-3 py-3">
        <div className="flex items-center justify-between">
          <div></div>
          
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">Cast Airdrop</h1>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
    </header>
  );
}
