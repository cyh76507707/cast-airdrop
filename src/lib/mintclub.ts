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

// 사전 정의된 토큰 목록 (Base 네트워크)
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

// 사용자 정의 토큰 정보 가져오기 (실제로는 토큰 컨트랙트에서 가져와야 함)
export async function getTokenInfo(address: string): Promise<TokenInfo | null> {
  if (!isValidTokenAddress(address)) {
    return null;
  }
  
  // 실제 구현에서는 토큰 컨트랙트의 name(), symbol(), decimals() 함수를 호출해야 함
  // 여기서는 기본값을 반환
  return {
    address,
    name: 'Custom Token',
    symbol: 'CUSTOM',
    decimals: 18,
    isERC20: true,
  };
}
