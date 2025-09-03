import { mintclub } from 'mint.club-v2-sdk';

export interface AirdropConfig {
  title: string;
  token: string;
  isERC20: boolean;
  amountPerClaim: bigint;
  walletCount: number;
  startTime: number;
  endTime: number;
  merkleRoot: string;
  ipfsCID: string;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  isERC20: boolean;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formattedBalance: string;
}

// Predefined token list (Base network)
export const PREDEFINED_TOKENS: TokenInfo[] = [
  {
    address: '0x4200000000000000000000000000000000000006',
    name: 'Wrapped Ether',
    symbol: 'WETH',
    decimals: 18,
    isERC20: true,
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    isERC20: true,
  },
  {
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    name: 'Coinbase Wrapped Staked ETH',
    symbol: 'cbETH',
    decimals: 18,
    isERC20: true,
  },
  {
    address: '0x37f0c2915CeCC7e977183B8543Fc0864d03E064C',
    name: 'HUNT',
    symbol: 'HUNT',
    decimals: 18,
    isERC20: true,
  },
  {
    address: '0xFf45161474C39cB00699070Dd49582e417b57a7E',
    name: 'MT',
    symbol: 'MT',
    decimals: 18,
    isERC20: true,
  },
];

// IPFS에 지갑 목록 업로드
export async function uploadWalletsToIPFS(wallets: string[], apiKey: string): Promise<string> {
  const json = JSON.stringify(wallets, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  
  try {
    const ipfsCID = await mintclub.ipfs.add(apiKey, blob);
    return ipfsCID;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error('Failed to upload wallet list to IPFS');
  }
}

// Merkle Root 생성
export async function generateMerkleRoot(wallets: string[]): Promise<string> {
  try {
    const merkleRoot = await mintclub.utils.generateMerkleRoot(wallets as `0x${string}`[]);
    return merkleRoot;
  } catch (error) {
    console.error('Error generating merkle root:', error);
    throw new Error('Failed to generate merkle root');
  }
}

// 에어드랍 생성
export async function createAirdrop(config: AirdropConfig, callbacks?: {
  onAllowanceSignatureRequest?: () => void;
  onAllowanceSigned?: (txHash: string) => void;
  onAllowanceSuccess?: (receipt: any) => void;
  onSignatureRequest?: () => void;
  onSigned?: (txHash: string) => void;
  onSuccess?: (receipt: any) => void;
  onError?: (error: unknown) => void;
}) {
  try {
    const receipt = await mintclub.network('base').airdrop.createAirdrop({
      title: config.title,
      token: config.token as `0x${string}`,
      isERC20: config.isERC20,
      amountPerClaim: config.amountPerClaim,
      walletCount: config.walletCount,
      startTime: config.startTime,
      endTime: config.endTime,
      merkleRoot: config.merkleRoot as `0x${string}`,
      ipfsCID: config.ipfsCID,
      ...callbacks,
    });
    
    return receipt;
  } catch (error) {
    console.error('Error creating airdrop:', error);
    throw error;
  }
}

// 에어드랍 정보 조회
export async function getAirdropById(airdropId: number) {
  try {
    const airdrop = await mintclub.network('base').airdrop.getAirdropById(airdropId);
    return airdrop;
  } catch (error) {
    console.error('Error fetching airdrop:', error);
    throw error;
  }
}

// 에어드랍 링크 생성
export function generateAirdropLink(airdropId: number): string {
  return `https://mint.club/airdrops/base/${airdropId}`;
}

// 토큰 주소 검증
export function isValidTokenAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get custom token info (in real implementation, should fetch from token contract)
export async function getTokenInfo(address: string): Promise<TokenInfo | null> {
  if (!isValidTokenAddress(address)) {
    return null;
  }
  
  // In real implementation, should call name(), symbol(), decimals() functions from token contract
  // Here returning default values
  return {
    address,
    name: 'Custom Token',
    symbol: 'CUSTOM',
    decimals: 18,
    isERC20: true,
  };
}

// Get token balance for a specific wallet
export async function getTokenBalance(
  tokenAddress: string, 
  walletAddress: string,
  tokenInfo: TokenInfo
): Promise<TokenBalance | null> {
  try {
    // For demo purposes, return a fixed balance for HUNT token
    // In real implementation, this should call the token contract's balanceOf function
    let demoBalance: bigint;
    
    if (tokenInfo.symbol === 'HUNT') {
      demoBalance = BigInt(Math.floor(150.1 * 10 ** tokenInfo.decimals)); // 150.1 HUNT
    } else if (tokenInfo.symbol === 'MT') {
      demoBalance = BigInt(Math.floor(100 * 10 ** tokenInfo.decimals)); // 100 MT
    } else {
      // For other tokens, use a reasonable demo balance
      demoBalance = BigInt(Math.floor(1000 * 10 ** tokenInfo.decimals));
    }
    
    return {
      token: tokenInfo,
      balance: demoBalance,
      formattedBalance: (Number(demoBalance) / 10 ** tokenInfo.decimals).toFixed(4)
    };
  } catch (error) {
    console.error('Error getting token balance:', error);
    return null;
  }
}
