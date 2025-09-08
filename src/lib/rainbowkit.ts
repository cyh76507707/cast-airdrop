import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { NETWORK } from './constants';

export const config = getDefaultConfig({
  appName: 'Cast Airdrop',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [base],
  transports: {
    [base.id]: http(NETWORK.RPC_URL),
  },
  ssr: true,
});
