'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-3 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">DropCast</h1>
          
          <div className="flex items-center">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
    </header>
  );
}
