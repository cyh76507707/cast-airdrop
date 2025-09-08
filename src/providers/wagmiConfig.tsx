'use client';

import { createConfig, http } from 'wagmi';
import { base } from 'viem/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { NETWORK } from '../lib/constants';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: 'Cast Airdrop',
      appLogoUrl: '/icon.png',
    }),
  ],
  transports: {
    [base.id]: http(NETWORK.RPC_URL),
  },
  ssr: false,
});
