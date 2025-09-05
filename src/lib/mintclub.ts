import { mintclub } from 'mint.club-v2-sdk';
import { encodeFunctionData } from 'viem';
import { NETWORK, MERKLE_DISTRIBUTOR_ADDRESS } from './constants';

// Initialize SDK with Base network
let isSDKInitialized = false;

// Function to initialize SDK
export async function initializeSDK() {
  if (isSDKInitialized) return;
  
  try {
    console.log('Initializing Mint.club SDK...');
    
    // Set network to Base Mainnet
    mintclub.network(NETWORK.BASE);
    
    console.log('Mint.club SDK initialized with Base network');
    isSDKInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Mint.club SDK:', error);
    throw error;
  }
}

// Function to check SDK initialization status
export function checkSDKStatus() {
  console.log('=== Mint.club SDK Status Check ===');
  console.log('mintclub object:', mintclub);
  console.log('mintclub type:', typeof mintclub);
  console.log('mintclub keys:', mintclub ? Object.keys(mintclub) : 'undefined');
  console.log('isSDKInitialized:', isSDKInitialized);
  
  if (mintclub && mintclub.network) {
    console.log('mintclub.network type:', typeof mintclub.network);
    console.log('mintclub.network keys:', Object.keys(mintclub.network));
    
    try {
      const baseNetwork = mintclub.network(NETWORK.BASE);
      if (baseNetwork) {
        console.log('Base network available');
        console.log('Base network keys:', Object.keys(baseNetwork));
        if (baseNetwork.airdrop) {
          console.log('Base network airdrop methods:', Object.keys(baseNetwork.airdrop));
        }
      } else {
        console.log('Base network NOT available');
      }
    } catch (error) {
      console.log('Error accessing Base network:', error);
    }
  } else {
    console.log('mintclub.network is NOT available');
  }
  console.log('================================');
}

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

// Upload wallet list to IPFS via server-side API
export async function uploadWalletsToIPFS(wallets: string[]): Promise<string> {
  try {
    console.log('Uploading wallets to IPFS via server API:', wallets.length, 'wallets');
    
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallets }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload to IPFS');
    }
    
    const data = await response.json();
    console.log('Uploaded to IPFS with CID:', data.ipfsCID);
    
    return data.ipfsCID;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error('Failed to upload wallet list to IPFS');
  }
}

// Generate Merkle Root for airdrop via server-side API
export async function generateMerkleRoot(wallets: string[]): Promise<string> {
  try {
    if (!wallets || wallets.length === 0) {
      throw new Error('No wallets provided');
    }

    console.log('Generating merkle root via server API for:', wallets.length, 'wallets');
    
    const response = await fetch('/api/merkle/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallets }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate merkle root');
    }
    
    const data = await response.json();
    console.log('Generated merkle root:', data.merkleRoot, 'for', wallets.length, 'wallets');
    
    return data.merkleRoot;
    
  } catch (error) {
    console.error('Error generating merkle root:', error);
    throw new Error('Failed to generate merkle root');
  }
}

// Approve token spending for airdrop using Mint.club SDK
export async function approveTokenForAirdrop(
  tokenAddress: string,
  totalAmount: bigint,
  callbacks?: {
    onSignatureRequest?: () => void;
    onSigned?: (txHash: `0x${string}`) => void;
    onSuccess?: (receipt: any) => void;
    onError?: (error: unknown) => void;
  }
) {
  try {
    console.log('Approving token for airdrop:', { tokenAddress, totalAmount: totalAmount.toString() });
    
    // Initialize SDK first
    await initializeSDK();
    
    // Check if we're in a browser environment with wallet connection
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet not connected or not in browser environment');
    }

    // Get the connected account
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet account found');
    }
    
    const userAddress = accounts[0];
    console.log('Using wallet address for approval:', userAddress);

    // Check if mintclub SDK is properly loaded
    if (!mintclub || !mintclub.network) {
      throw new Error('Mint.club SDK not properly loaded');
    }
    
    console.log('Mint.club SDK loaded successfully');
    
    // Get base network and token instance
    const baseNetwork = mintclub.network(NETWORK.BASE);
    if (!baseNetwork) {
      throw new Error('Base network not available in Mint.club SDK');
    }
    
    // Get token instance for approval
    const tokenInstance = baseNetwork.token(tokenAddress);
    if (!tokenInstance || !tokenInstance.approve) {
      throw new Error('Token approval not available in Mint.club SDK');
    }
    
    console.log('Token instance available for approval');

    // Call approval signature request callback
    if (callbacks?.onSignatureRequest) {
      callbacks.onSignatureRequest();
    }

    console.log('Requesting token approval...');
    
    // Use the actual MerkleDistributor contract address on Base
    const airdropContractAddress = MERKLE_DISTRIBUTOR_ADDRESS;
    
    // Approve token spending using Mint.club SDK
    const receipt = await tokenInstance.approve({
      spender: airdropContractAddress as `0x${string}`,
      amount: totalAmount,
      onSignatureRequest: () => {
        console.log('Token approval signature requested');
        if (callbacks?.onSignatureRequest) {
          callbacks.onSignatureRequest();
        }
      },
      onSigned: (txHash: `0x${string}`) => {
        console.log('Token approval signed:', txHash);
        if (callbacks?.onSigned) {
          callbacks.onSigned(txHash);
        }
      },
    });
    
    console.log('Token approval completed:', receipt);
    
    if (callbacks?.onSuccess) {
      callbacks.onSuccess(receipt);
    }
    
    return receipt;
    
  } catch (error) {
    console.error('Error approving token:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    if (callbacks?.onError) {
      callbacks.onError(error);
    }
    
    throw error;
  }
}

// Check token allowance using Mint.club SDK
export async function checkTokenAllowance(tokenAddress: string, requiredAmount: bigint): Promise<boolean> {
  try {
    console.log('Checking token allowance:', { tokenAddress, requiredAmount: requiredAmount.toString() });
    
    // Initialize SDK first
    await initializeSDK();
    
    // Get base network and token instance
    const baseNetwork = mintclub.network(NETWORK.BASE);
    if (!baseNetwork) {
      throw new Error('Base network not available in Mint.club SDK');
    }
    
    const tokenInstance = baseNetwork.token(tokenAddress);
    if (!tokenInstance || !tokenInstance.getAllowance) {
      throw new Error('Token allowance check not available in Mint.club SDK');
    }
    
    // Get current allowance using Mint.club SDK
    let allowance;
    
    // First, get the user address
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet account found');
    }
    const userAddress = accounts[0];
    console.log('Using user address for allowance check:', userAddress);
    
    // Try different parameter combinations for getAllowance
    try {
      // Try 1: With owner and spender object
      const airdropContractAddress = MERKLE_DISTRIBUTOR_ADDRESS;
      allowance = await tokenInstance.getAllowance({
        owner: userAddress,
        spender: airdropContractAddress
      });
      console.log('Current allowance (with owner and spender):', allowance, 'Required:', requiredAmount.toString());
    } catch (error1) {
      console.log('getAllowance with owner and spender failed:', error1);
      
      // If all attempts fail, assume no allowance and proceed with approval
      console.log('All getAllowance attempts failed, assuming no allowance');
      allowance = '0';
    }
    
    // Check if allowance is sufficient
    const isSufficient = BigInt(allowance) >= requiredAmount;
    console.log('Allowance sufficient:', isSufficient);
    
    return isSufficient;
    
  } catch (error) {
    console.error('Error checking token allowance:', error);
    // If allowance check fails, assume no allowance and proceed with approval
    console.log('Allowance check failed, assuming no allowance');
    return false;
  }
}

// Create airdrop by directly calling the MerkleDistributor contract
export async function createAirdrop(config: AirdropConfig, callbacks?: {
  onAllowanceSignatureRequest?: () => void;
  onAllowanceSigned?: (txHash: `0x${string}`) => void;
  onAllowanceSuccess?: (receipt: any) => void;
  onSignatureRequest?: () => void;
  onSigned?: (txHash: `0x${string}`) => void;
  onSuccess?: (receipt: any) => void;
  onError?: (error: unknown) => void;
}) {
  try {
    console.log('Creating airdrop with config:', config);
    
    // Check if we're in a browser environment with wallet connection
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Wallet not connected or not in browser environment');
    }

    // Get the connected account
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet account found');
    }
    
    const userAddress = accounts[0];
    console.log('Using wallet address:', userAddress);

    // MerkleDistributor contract address on Base
    const merkleDistributorAddress = MERKLE_DISTRIBUTOR_ADDRESS;
    
    console.log('Preparing direct contract call to MerkleDistributor...');
    console.log('Contract address:', merkleDistributorAddress);
    
    // Step 1: Check and handle token approval
    console.log('Checking token approval...');
    
    // Check if approval is needed
    const totalAmount = config.amountPerClaim * BigInt(config.walletCount);
    const isApproved = await checkTokenAllowance(config.token, totalAmount);
    
    if (!isApproved) {
      console.log('Token approval needed, requesting approval...');
      if (callbacks?.onAllowanceSignatureRequest) {
        callbacks.onAllowanceSignatureRequest();
      }
      
      // Request token approval
      await approveTokenForAirdrop(config.token, totalAmount, {
        onSignatureRequest: () => {
          console.log('Token approval signature requested');
          if (callbacks?.onAllowanceSignatureRequest) {
            callbacks.onAllowanceSignatureRequest();
          }
        },
        onSigned: (txHash) => {
          console.log('Token approval signed:', txHash);
          if (callbacks?.onAllowanceSigned) {
            callbacks.onAllowanceSigned(txHash);
          }
        },
        onSuccess: (receipt) => {
          console.log('Token approval completed:', receipt);
          if (callbacks?.onAllowanceSuccess) {
            callbacks.onAllowanceSuccess(receipt);
          }
        },
        onError: (error) => {
          console.error('Token approval failed:', error);
          if (callbacks?.onError) {
            callbacks.onError(error);
          }
        }
      });
    } else {
      console.log('Token already approved, proceeding...');
      if (callbacks?.onAllowanceSuccess) {
        callbacks.onAllowanceSuccess({ status: 'already_approved' });
      }
    }
    
    // Step 2: Create airdrop by directly calling the MerkleDistributor contract
    console.log('Creating airdrop by calling MerkleDistributor contract...');
    
    // MerkleDistributor ABI for createDistribution function
    const MERKLE_DISTRIBUTOR_ABI = [
      {
        name: 'createDistribution',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'isERC20', type: 'bool' },
          { name: 'amountPerClaim', type: 'uint176' },
          { name: 'walletCount', type: 'uint40' },
          { name: 'startTime', type: 'uint40' },
          { name: 'endTime', type: 'uint40' },
          { name: 'merkleRoot', type: 'bytes32' },
          { name: 'title', type: 'string' },
          { name: 'ipfsCID', type: 'string' }
        ],
        outputs: []
      }
    ] as const;
    
    // Encode createDistribution function call
    const functionData = encodeFunctionData({
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: 'createDistribution',
      args: [
        config.token as `0x${string}`,
        config.isERC20,
        config.amountPerClaim,
        config.walletCount,
        config.startTime,
        config.endTime,
        config.merkleRoot as `0x${string}`,
        config.title,
        config.ipfsCID,
      ]
    });
    
    console.log('Function data prepared:', functionData);
    
    // Call callbacks for user experience
    if (callbacks?.onSignatureRequest) {
      callbacks.onSignatureRequest();
    }
    
    console.log('Sending transaction to MerkleDistributor contract...');
    
    // Send the transaction
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        to: merkleDistributorAddress,
        from: userAddress,
        data: functionData,
        gas: '0x1e8480', // 2,000,000 gas limit
      }],
    });
    
    console.log('Transaction sent:', txHash);
    
    if (callbacks?.onSigned) {
      callbacks.onSigned(txHash as `0x${string}`);
    }
    
    // Wait for transaction confirmation
    console.log('Waiting for transaction confirmation...');
    const receipt = await waitForTransactionConfirmation(txHash);
    
    console.log('Airdrop transaction completed:', receipt);
    
    if (callbacks?.onSuccess) {
      callbacks.onSuccess(receipt);
    }
    
    return receipt;
    
  } catch (error) {
    console.error('Error creating airdrop:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    if (callbacks?.onError) {
      callbacks.onError(error);
    }
    
    throw error;
  }
}


// Helper function to wait for transaction confirmation
async function waitForTransactionConfirmation(txHash: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const checkConfirmation = async () => {
      try {
        const receipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        });
        
        if (receipt) {
          resolve(receipt);
        } else {
          setTimeout(checkConfirmation, 2000);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    checkConfirmation();
  });
}

// Get the latest airdrop ID (useful after creating a new airdrop)
export async function getLatestAirdropId(): Promise<number> {
  try {
    console.log('Getting latest airdrop ID...');
    
    // Initialize SDK first
    await initializeSDK();
    
    // Check if mintclub SDK is properly loaded
    if (!mintclub || !mintclub.network) {
      throw new Error('Mint.club SDK not properly loaded');
    }
    
    console.log('Mint.club SDK loaded successfully');
    
    // Get base network
    const baseNetwork = mintclub.network(NETWORK.BASE);
    if (!baseNetwork || !baseNetwork.airdrop) {
      throw new Error('Base network or airdrop module not available in Mint.club SDK');
    }
    
    console.log('Base network airdrop module available');
    console.log('Available airdrop methods:', Object.keys(baseNetwork.airdrop));
    
    console.log('Calling getTotalAirdropCount...');
    const totalCount = await baseNetwork.airdrop.getTotalAirdropCount();
    console.log('Total airdrop count received:', totalCount, 'Type:', typeof totalCount);
    
    // The latest airdrop ID is totalCount - 1 (since IDs are 0-indexed)
    const latestId = Number(totalCount) - 1;
    console.log('Calculated latest airdrop ID:', latestId);
    
    return latestId;
  } catch (error) {
    console.error('Error getting latest airdrop ID:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// 에어드랍 정보 조회
export async function getAirdropById(airdropId: number) {
  try {
    // Initialize SDK first
    await initializeSDK();
    
    // Get base network
    const baseNetwork = mintclub.network(NETWORK.BASE);
    if (!baseNetwork || !baseNetwork.airdrop) {
      throw new Error('Base network or airdrop module not available in Mint.club SDK');
    }
    
    const airdrop = await baseNetwork.airdrop.getAirdropById(airdropId);
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
