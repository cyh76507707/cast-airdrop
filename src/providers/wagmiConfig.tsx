"use client";

import { fallback, http } from "viem";
import { base } from "viem/chains";
import { createConfig } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { NETWORK } from "../lib/constants";

const baseRpcs: string[] = [
  NETWORK.RPC_URL,
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://base-pokt.nodies.app",
  "https://base.rpc.subquery.network/public",
  "https://endpoints.omniatech.io/v1/base/mainnet/public",
  "https://gateway.tenderly.co/public/base",
  "https://base.blockpi.network/v1/rpc/public",
  "https://1rpc.io/base",
  "https://base-mainnet.public.blastapi.io",
  "https://base.meowrpc.com",
  "https://base.llamarpc.com",
];

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: "Cast Airdrop",
      appLogoUrl: "/icon.png",
    }),
  ],
  transports: {
    [base.id]: fallback(
      baseRpcs.map((rpc) => http(rpc)),
      {
        retryCount: 2,
        rank: false,
      }
    ),
  },
  ssr: false,
});
