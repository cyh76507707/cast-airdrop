import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { NETWORK } from './constants';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { injected, walletConnect } from '@wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(NETWORK.RPC_URL),
  },
  // Farcaster first (auto-connect inside Warpcast), then standard connectors for web
  connectors: [
    farcasterMiniApp(),
    injected({ shimDisconnect: true }),
    walletConnect({ projectId, showQrModal: true }),
  ],
  ssr: true,
});
