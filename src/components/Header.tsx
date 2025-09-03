'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { WalletConnect, WalletInfo } from './WalletConnect';

interface HeaderProps {
  currentWallet?: WalletInfo;
  onWalletConnect: (wallet: WalletInfo) => void;
  onWalletDisconnect: () => void;
}

export function Header({ currentWallet, onWalletConnect, onWalletDisconnect }: HeaderProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);

  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">Cast Airdrop</h1>
              <span className="text-sm text-gray-500">Create airdrops for Farcaster engagement</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {currentWallet?.connected ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{currentWallet.type === 'farcaster' ? 'Farcaster' : 'MetaMask'}</span>
                    <span className="ml-2 text-gray-400">
                      {currentWallet.address.substring(0, 6)}...{currentWallet.address.substring(-4)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowWalletModal(true)}
                  >
                    Change Wallet
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowWalletModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Connect Wallet</h2>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <WalletConnect
                onWalletConnect={(wallet) => {
                  onWalletConnect(wallet);
                  setShowWalletModal(false);
                }}
                onWalletDisconnect={() => {
                  onWalletDisconnect();
                  setShowWalletModal(false);
                }}
                currentWallet={currentWallet}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
