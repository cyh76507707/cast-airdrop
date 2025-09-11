import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import {
  getAccount,
  getChainId,
  simulateContract,
  switchChain,
  writeContract,
} from "wagmi/actions";
import { config } from "~/lib/rainbowkit";
import { EMPTY_ROOT, MERKLE_DISTRIBUTOR_ADDRESS, NETWORK } from "./constants";

// User-friendly progress message types
export interface ProgressMessage {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface ProgressCallback {
  onProgress?: (message: ProgressMessage) => void;
}

// RPC rotation system for rate limit mitigation
let currentRpcIndex = 0;

function getNextRpcUrl(): string {
  const rpcUrl = NETWORK.RPC_ENDPOINTS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % NETWORK.RPC_ENDPOINTS.length;
  console.log(`Using RPC endpoint: ${rpcUrl}`);
  return rpcUrl;
}

function createPublicClientWithRotation() {
  return createPublicClient({
    chain: base,
    transport: http(getNextRpcUrl()),
  });
}

// Enhanced RPC client with automatic fallback, faster timeout, and user-friendly messages
async function createPublicClientWithFallback(progressCallback?: ProgressCallback) {
  const maxRetries = NETWORK.RPC_ENDPOINTS.length;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = getNextRpcUrl();
    const rpcName = getRpcDisplayName(rpcUrl);
    
    try {
      // Show progress message
      progressCallback?.onProgress?.({
        type: 'info',
        message: `Connecting to ${rpcName}...`,
        details: `Attempt ${attempt + 1} of ${maxRetries}`
      });
      
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, {
          timeout: 5000, // 5초 타임아웃으로 단축
          retryCount: 1, // 재시도 횟수 줄임
          retryDelay: 1000, // 재시도 간격 단축
        }),
      });
      
      // Test the connection with a simple call and timeout
      const chainIdPromise = client.getChainId();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      );
      
      await Promise.race([chainIdPromise, timeoutPromise]);
      
      // Success message
      progressCallback?.onProgress?.({
        type: 'success',
        message: `Connected to ${rpcName}`,
        details: 'Ready to process your request'
      });
      
      console.log(`Successfully connected to RPC: ${rpcUrl}`);
      return client;
    } catch (error) {
      lastError = error as Error;
      console.warn(`RPC attempt ${attempt + 1} failed:`, error);
      
      // Show failure message with countdown
      const remainingAttempts = maxRetries - attempt - 1;
      if (remainingAttempts > 0) {
        progressCallback?.onProgress?.({
          type: 'warning',
          message: `${rpcName} connection failed`,
          details: `Trying next RPC in 1 second... (${remainingAttempts} attempts remaining)`
        });
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If it's a CORS error, network error, or timeout, try next RPC immediately
      if (error instanceof Error && (
        error.message.includes('CORS') || 
        error.message.includes('Failed to fetch') ||
        error.message.includes('rate limited') ||
        error.message.includes('HTTP request failed') ||
        error.message.includes('timeout') ||
        error.message.includes('Connection timeout')
      )) {
        console.log('Network/CORS/timeout error detected, trying next RPC...');
        continue;
      }
    }
  }
  
  // All RPCs failed
  progressCallback?.onProgress?.({
    type: 'error',
    message: 'All RPC endpoints failed',
    details: `Last error: ${lastError?.message}`
  });
  
  throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
}

// Helper function to get user-friendly RPC names
function getRpcDisplayName(rpcUrl: string): string {
  if (rpcUrl.includes('mainnet.base.org')) return 'Base Official';
  if (rpcUrl.includes('blockpi.network')) return 'BlockPI';
  if (rpcUrl.includes('llamarpc.com')) return 'LlamaRPC';
  if (rpcUrl.includes('drpc.org')) return 'DRPC';
  if (rpcUrl.includes('meowrpc.com')) return 'MeowRPC';
  if (rpcUrl.includes('publicnode.com')) return 'PublicNode';
  return 'Unknown RPC';
}

// Wei conversion function (similar to mint.club implementation)
export function wei(num: number | string, decimals = 18): bigint {
  const stringified = num.toString();
  try {
    return parseUnits(stringified, decimals);
  } catch (error) {
    console.error(`Failed to convert ${stringified} to BigInt: ${error}`);
    return BigInt(0);
  }
}

// Custom wait for transaction function with RPC fallback for rate limit mitigation
export async function customWaitForTransaction(
  chainId: number,
  tx: Hash
): Promise<any> {
  let receipt: any;
  let attempts = 0;
  const MAX_TRIES = 30;

  // Little buffer to make sure the transaction is mined
  await new Promise((resolve) => setTimeout(resolve, 2000));

  while (!receipt && attempts < MAX_TRIES) {
    try {
      // Use RPC fallback for each attempt to avoid rate limits and CORS issues
      const publicClient = await createPublicClientWithFallback();
      receipt = await publicClient.getTransactionReceipt({ hash: tx });
      if (receipt) {
        break;
      }
    } catch (error) {
      console.log(`Attempt ${attempts + 1} failed, retrying with different RPC...`);
      // If it's a rate limit or CORS error, try with next RPC immediately
      if (error instanceof Error && (
        error.message.includes('rate limited') ||
        error.message.includes('CORS') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('HTTP request failed')
      )) {
        console.log('Network error detected, switching to next RPC endpoint');
        // Don't wait, try immediately with next RPC
        continue;
      }
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!receipt) {
    throw new Error("Transaction confirmation timeout");
  }

  return receipt;
}

// MerkleDistributor contract ABI
const MERKLE_DISTRIBUTOR_ABI = [
  {
    name: "createDistribution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "isERC20", type: "bool" },
      { name: "amountPerClaim", type: "uint176" },
      { name: "walletCount", type: "uint40" },
      { name: "startTime", type: "uint40" },
      { name: "endTime", type: "uint40" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "title", type: "string" },
      { name: "ipfsCID", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "distributionId", type: "uint256" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
  },
  {
    name: "distributions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "token", type: "address" },
      { name: "isERC20", type: "bool" },
      { name: "walletCount", type: "uint40" },
      { name: "claimedCount", type: "uint40" },
      { name: "amountPerClaim", type: "uint176" },
      { name: "startTime", type: "uint40" },
      { name: "endTime", type: "uint40" },
      { name: "owner", type: "address" },
      { name: "refundedAt", type: "uint40" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "title", type: "string" },
      { name: "ipfsCID", type: "string" },
    ],
  },
  {
    name: "distributionCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "distributionId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isWhitelistOnly",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "distributionId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isWhitelisted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "distributionId", type: "uint256" },
      { name: "wallet", type: "address" },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getAmountLeft",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "distributionId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAmountClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "distributionId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// Create public client for read operations with RPC rotation
const publicClient = createPublicClientWithRotation();

// Create wallet client for write operations
async function createWalletClientFromWindow() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Wallet not connected or not in browser environment");
  }

  // Get the user's address first
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No wallet account found");
  }

  const userAddress = accounts[0] as Address;

  return createWalletClient({
    chain: base,
    transport: custom(window.ethereum), // Use MetaMask directly
    account: userAddress,
  });
}

export interface AirdropConfig {
  title: string;
  token: string;
  isERC20: boolean;
  amountPerClaim: number; // Total amount for the entire airdrop (will be divided by walletCount)
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

export interface Distribution {
  token: Address;
  isERC20: boolean;
  walletCount: number;
  claimedCount: number;
  amountPerClaim: bigint;
  startTime: number;
  endTime: number;
  owner: Address;
  refundedAt: number;
  merkleRoot: Hash;
  title: string;
  ipfsCID: string;
}

// Predefined token list (Base network)
export const PREDEFINED_TOKENS: TokenInfo[] = [
  {
    address: "0x4200000000000000000000000000000000000006",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    isERC20: true,
  },
  {
    address: "0x37f0c2915CeCC7e977183B8543Fc0864d03E064C",
    name: "HUNT",
    symbol: "HUNT",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0xFf45161474C39cB00699070Dd49582e417b57a7E",
    name: "MT",
    symbol: "MT",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x13c2Bc9B3b8427791F700cB153314b487fFE8F5e",
    name: "CHICKEN",
    symbol: "CHICKEN",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0xE3086852A4B125803C815a158249ae468A3254Ca",
    name: "mfer",
    symbol: "mfer",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x2D57C47BC5D2432FEEEdf2c9150162A9862D3cCf",
    name: "DICKBUTT",
    symbol: "DICKBUTT",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    name: "DEGEN",
    symbol: "DEGEN",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0xcbD06E5A2B0C65597161de254AA074E489dEb510",
    name: "cbDOGE",
    symbol: "cbDOGE",
    decimals: 8,
    isERC20: true,
  },
  {
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    name: "cbBTC",
    symbol: "cbBTC",
    decimals: 8,
    isERC20: true,
  },
  {
    address: "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b",
    name: "BNKR",
    symbol: "BNKR",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x1111111111166b7FE7bd91427724B487980aFc69",
    name: "ZORA",
    symbol: "ZORA",
    decimals: 18,
    isERC20: true,
  },
  {
    address: "0x59f0199Eb19394e7748c004d7b393bb460766b07",
    name: "MM",
    symbol: "MM",
    decimals: 18,
    isERC20: true,
  },
];

// Upload wallet list to IPFS via server-side API
export async function uploadWalletsToIPFS(wallets: string[]): Promise<string> {
  try {
    console.log(
      "Uploading wallets to IPFS via server API:",
      wallets.length,
      "wallets"
    );

    // Use FormData format (matching mint.club-v2-web exactly)
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([JSON.stringify(wallets, null, 2)])
    );

    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload to IPFS");
    }

    const data = await response.json();
    console.log("Uploaded to IPFS with CID:", data.ipfsCID);

    return data.ipfsCID;
  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    throw new Error("Failed to upload wallet list to IPFS");
  }
}

// Generate Merkle Root for airdrop via server-side API
export async function generateMerkleRoot(wallets: string[]): Promise<string> {
  try {
    if (!wallets || wallets.length === 0) {
      throw new Error("No wallets provided");
    }

    console.log(
      "Generating merkle root via server API for:",
      wallets.length,
      "wallets"
    );

    const response = await fetch("/api/merkle/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallets }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate merkle root");
    }

    const data = await response.json();
    console.log(
      "Generated merkle root:",
      data.merkleRoot,
      "for",
      wallets.length,
      "wallets"
    );

    return data.merkleRoot;
  } catch (error) {
    console.error("Error generating merkle root:", error);
    throw new Error("Failed to generate merkle root");
  }
}

// Ensure we're on Base network
async function ensureBaseNetwork(): Promise<void> {
  try {
    const currentChainId = await getChainId(config);
    console.log(
      "Current chain ID:",
      currentChainId,
      "Expected:",
      NETWORK.CHAIN_ID
    );
    if (currentChainId !== NETWORK.CHAIN_ID) {
      console.log("Switching to Base network via wagmi...");
      await switchChain(config, { chainId: base.id });
      console.log("Successfully switched to Base network");
    } else {
      console.log("Already on Base network");
    }
  } catch (error) {
    console.error("Network switch error:", error);
    throw new Error(
      `Failed to ensure Base network: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Get user's wallet address
async function getUserAddress(): Promise<Address> {
  const account = await getAccount(config);
  if (!account.address) {
    throw new Error("No wallet account found");
  }
  return account.address as Address;
}

// Get token decimals with RPC fallback
export async function getTokenDecimals(tokenAddress: Address): Promise<number> {
  try {
    const publicClient = await createPublicClientWithFallback();

    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    return Number(decimals);
  } catch (error) {
    console.error("Error getting token decimals:", error);
    return 18; // Default to 18 decimals
  }
}

// Check token allowance with RPC fallback
export async function checkTokenAllowance(
  userAddress: Address,
  tokenAddress: Address,
  requiredAmount: bigint,
  progressCallback?: ProgressCallback
): Promise<boolean> {
  try {
    console.log("Checking token allowance:", {
      userAddress,
      tokenAddress,
      requiredAmount: requiredAmount.toString(),
    });

    const publicClient = await createPublicClientWithFallback(progressCallback);

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [userAddress, MERKLE_DISTRIBUTOR_ADDRESS],
    });

    console.log(
      "Current allowance:",
      allowance.toString(),
      "Required:",
      requiredAmount.toString()
    );

    const isSufficient = allowance >= requiredAmount;
    console.log("Allowance sufficient:", isSufficient);

    return isSufficient;
  } catch (error) {
    console.error("Error checking token allowance:", error);
    return false;
  }
}

// Approve token spending for airdrop
export async function approveTokenForAirdrop(
  tokenAddress: Address,
  totalAmount: bigint,
  callbacks?: {
    onSignatureRequest?: () => void;
    onSigned?: (txHash: Hash) => void;
    onSuccess?: (receipt: any) => void;
    onError?: (error: unknown) => void;
  }
) {
  try {
    console.log("Approving token for airdrop:", {
      tokenAddress,
      totalAmount: totalAmount.toString(),
    });

    // Force network switch to Base before proceeding
    await ensureBaseNetwork();

    const userAddress = await getUserAddress();

    console.log("Using wallet address for approval:", userAddress);

    // Call approval signature request callback
    if (callbacks?.onSignatureRequest) {
      callbacks.onSignatureRequest();
    }

    console.log("Requesting token approval...");

    // Simulate and send approval transaction via wagmi
    let hash: Hash;
    console.log("Simulating approval transaction...");
    const { request } = await simulateContract(config, {
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MERKLE_DISTRIBUTOR_ADDRESS, totalAmount],
    });
    console.log("Approval simulation successful, gas estimate:", request.gas);
    console.log("Sending approval transaction...");
    hash = (await Promise.race([
      writeContract(config, request),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Transaction request timeout")),
          120000
        )
      ),
    ])) as Hash;

    console.log("Token approval transaction sent:", hash);
    if (callbacks?.onSigned) {
      callbacks.onSigned(hash);
    }

    // Wait for transaction confirmation with improved timeout handling
    console.log("Waiting for approval transaction confirmation...");

    // Wait for receipt via wagmi
    const receipt = await customWaitForTransaction(base.id, hash);

    console.log("Token approval completed:", receipt);

    if (callbacks?.onSuccess) {
      callbacks.onSuccess(receipt);
    }

    return receipt;
  } catch (error) {
    console.error("Error approving token:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (callbacks?.onError) {
      callbacks.onError(error);
    }

    throw error;
  }
}

// Create airdrop using mint.club's verified approach
export async function createAirdrop(
  airdropConfig: AirdropConfig,
  callbacks?: {
    onAllowanceSignatureRequest?: () => void;
    onAllowanceSigned?: (txHash: Hash) => void;
    onAllowanceSuccess?: (receipt: any) => void;
    onSignatureRequest?: () => void;
    onSigned?: (txHash: Hash) => void;
    onSuccess?: (receipt: any) => void;
    onError?: (error: unknown) => void;
    onProgress?: (message: ProgressMessage) => void;
  }
) {
  try {
    console.log("Creating airdrop with config:", config);

    // Force network switch to Base before proceeding
    await ensureBaseNetwork();

    const userAddress = await getUserAddress();
    console.log("Using wallet address:", userAddress);

    // Validate token address first
    console.log("Validating token address...");
    try {
      const publicClient = await createPublicClientWithFallback();

      const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
        publicClient.readContract({
          address: airdropConfig.token as Address,
          abi: ERC20_ABI,
          functionName: "name",
        }),
        publicClient.readContract({
          address: airdropConfig.token as Address,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: airdropConfig.token as Address,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
      ]);

      console.log("Token validation successful:", {
        tokenName,
        tokenSymbol,
        tokenDecimals,
      });
    } catch (tokenError) {
      console.error("Token validation failed:", tokenError);
      throw new Error(
        `Invalid token address: ${airdropConfig.token}. Please check if this is a valid ERC20 token on Base network.`
      );
    }

    // Get token decimals for proper amount calculation
    const tokenDecimals = await getTokenDecimals(airdropConfig.token as Address);
    console.log("Token decimals:", tokenDecimals);

    // Calculate amounts (exactly like mint.club)
    // airdropConfig.amountPerClaim is the total amount for the entire airdrop
    // We need to calculate the amount per user for the contract call
    const totalAmountWei = wei(
      airdropConfig.amountPerClaim.toString(),
      airdropConfig.isERC20 ? tokenDecimals : 0
    );
    const amountPerClaimWei = totalAmountWei / BigInt(airdropConfig.walletCount);

    console.log("Amount calculations:", {
      amountPerClaimWei: amountPerClaimWei.toString(),
      totalAmountWei: totalAmountWei.toString(),
      walletCount: airdropConfig.walletCount,
      tokenDecimals: tokenDecimals,
    });

    // Step 1: Check current allowance first, only approve if necessary
    console.log("Checking current token allowance...");
    callbacks?.onProgress?.({
      type: 'info',
      message: 'Checking token allowance...',
      details: 'Verifying spending permissions'
    });
    
    const hasSufficientAllowance = await checkTokenAllowance(
      userAddress,
      airdropConfig.token as Address,
      totalAmountWei,
      callbacks
    );

    if (!hasSufficientAllowance) {
      console.log("Insufficient allowance, requesting token approval...");
      callbacks?.onProgress?.({
        type: 'warning',
        message: 'Insufficient token allowance',
        details: 'Requesting approval for token spending'
      });
      
      if (callbacks?.onAllowanceSignatureRequest) {
        callbacks.onAllowanceSignatureRequest();
      }

      // Only request token approval if allowance is insufficient
      await approveTokenForAirdrop(airdropConfig.token as Address, totalAmountWei, {
        onSignatureRequest: () => {
          console.log("Token approval signature requested");
          if (callbacks?.onAllowanceSignatureRequest) {
            callbacks.onAllowanceSignatureRequest();
          }
        },
        onSigned: (txHash) => {
          console.log("Token approval signed:", txHash);
          if (callbacks?.onAllowanceSigned) {
            callbacks.onAllowanceSigned(txHash);
          }
        },
        onSuccess: (receipt) => {
          console.log("Token approval completed:", receipt);
          if (callbacks?.onAllowanceSuccess) {
            callbacks.onAllowanceSuccess(receipt);
          }
        },
        onError: (error) => {
          console.error("Token approval failed:", error);
          if (callbacks?.onError) {
            callbacks.onError(error);
          }
        },
      });

      // Wait a bit for the approval to be fully processed on the blockchain
      console.log("Waiting for approval to be fully processed...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify allowance after approval
      console.log("Verifying token allowance after approval...");
      const publicClient = await createPublicClientWithFallback();

      const currentAllowance = await publicClient.readContract({
        address: airdropConfig.token as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAddress, MERKLE_DISTRIBUTOR_ADDRESS],
      });

      console.log("Current allowance:", currentAllowance.toString());
      console.log("Required amount:", totalAmountWei.toString());

      if (currentAllowance < totalAmountWei) {
        throw new Error(`Insufficient allowance after approval. Current: ${currentAllowance.toString()}, Required: ${totalAmountWei.toString()}`);
      }
    } else {
      console.log("Sufficient allowance already exists, skipping approval step");
      callbacks?.onProgress?.({
        type: 'success',
        message: 'Token allowance verified',
        details: 'Sufficient spending permissions already exist'
      });
      
      // Call success callback to maintain UI consistency
      if (callbacks?.onAllowanceSuccess) {
        callbacks.onAllowanceSuccess({ status: 'skipped', message: 'Sufficient allowance already exists' });
      }
    }

    // Step 2: Create airdrop
    console.log("Creating airdrop by calling MerkleDistributor contract...");
    callbacks?.onProgress?.({
      type: 'info',
      message: 'Creating airdrop...',
      details: 'Preparing smart contract transaction'
    });

    // Call signature request callback
    if (callbacks?.onSignatureRequest) {
      callbacks.onSignatureRequest();
    }

    console.log("Creating wallet client and sending transaction...");

    console.log("Preparing airdrop transaction...");
    let tx: Hash;
    console.log("Simulating airdrop transaction...");
    const { request } = await simulateContract(config, {
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "createDistribution",
      args: [
        airdropConfig.token as Address,
        airdropConfig.isERC20,
        amountPerClaimWei,
        airdropConfig.walletCount,
        airdropConfig.startTime,
        airdropConfig.endTime,
        (airdropConfig.merkleRoot as `0x${string}`) || EMPTY_ROOT,
        airdropConfig.title,
        airdropConfig.ipfsCID,
      ],
    });
    console.log("Airdrop simulation successful, gas estimate:", request.gas);
    tx = (await Promise.race([
      writeContract(config, request),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Transaction request timeout")),
          120000
        )
      ),
    ])) as Hash;

    console.log("Airdrop transaction sent:", tx);
    if (callbacks?.onSigned) {
      callbacks.onSigned(tx);
    }

    // Wait for transaction confirmation with improved timeout handling
    console.log("Waiting for airdrop transaction confirmation...");

    // Wait for receipt via wagmi
    const receipt = await customWaitForTransaction(base.id, tx);

    console.log("Airdrop transaction completed:", receipt);

    if (callbacks?.onSuccess) {
      callbacks.onSuccess(receipt);
    }

    return receipt;
  } catch (error) {
    console.error("Error creating airdrop:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (callbacks?.onError) {
      callbacks.onError(error);
    }

    throw error;
  }
}

// Get the latest airdrop ID with RPC fallback
export async function getLatestAirdropId(): Promise<number> {
  try {
    console.log("Getting latest airdrop ID...");

    const publicClient = await createPublicClientWithFallback();
    const totalCount = await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "distributionCount",
    });

    console.log(
      "Total airdrop count received:",
      totalCount,
      "Type:",
      typeof totalCount
    );

    // The latest airdrop ID is totalCount - 1 (since IDs are 0-indexed)
    const latestId = Number(totalCount) - 1;
    console.log("Calculated latest airdrop ID:", latestId);

    return latestId;
  } catch (error) {
    console.error("Error getting latest airdrop ID:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Get airdrop information by ID with RPC fallback
export async function getAirdropById(airdropId: number): Promise<Distribution> {
  try {
    console.log("Getting airdrop by ID:", airdropId);

    const publicClient = await createPublicClientWithFallback();
    const distribution = await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "distributions",
      args: [BigInt(airdropId)],
    });

    console.log("Retrieved distribution:", distribution);

    return {
      token: distribution[0],
      isERC20: distribution[1],
      walletCount: Number(distribution[2]),
      claimedCount: Number(distribution[3]),
      amountPerClaim: distribution[4],
      startTime: Number(distribution[5]),
      endTime: Number(distribution[6]),
      owner: distribution[7],
      refundedAt: Number(distribution[8]),
      merkleRoot: distribution[9],
      title: distribution[10],
      ipfsCID: distribution[11],
    };
  } catch (error) {
    console.error("Error fetching airdrop:", error);
    throw error;
  }
}

// Generate airdrop link
export function generateAirdropLink(airdropId: number): string {
  return `https://mint.club/airdrops/base/${airdropId}`;
}

// Validate token address
export function isValidTokenAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Get token info from contract with RPC fallback
export async function getTokenInfo(
  address: Address
): Promise<TokenInfo | null> {
  try {
    if (!isValidTokenAddress(address)) {
      console.log(`Invalid token address format: ${address}`);
      return null;
    }

    console.log(`Fetching token info for: ${address}`);

    // Use a single client for all calls to maintain consistency
    const publicClient = await createPublicClientWithFallback();
    
    // Try to get token info with individual calls for better error handling
    let name: string;
    let symbol: string;
    let decimals: number;

    try {
      name = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "name",
      });
    } catch (error) {
      console.error(`Failed to get name for token ${address}:`, error);
      name = "Unknown Token";
    }

    try {
      symbol = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "symbol",
      });
    } catch (error) {
      console.error(`Failed to get symbol for token ${address}:`, error);
      symbol = "UNKNOWN";
    }

    try {
      decimals = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "decimals",
      });
    } catch (error) {
      console.error(`Failed to get decimals for token ${address}:`, error);
      decimals = 18; // Default to 18 decimals
    }

    const tokenInfo = {
      address,
      name,
      symbol,
      decimals,
      isERC20: true,
    };

    console.log(`Successfully fetched token info:`, tokenInfo);
    return tokenInfo;
  } catch (error) {
    console.error("Error getting token info:", error);
    return null;
  }
}

// Get token balance for a specific wallet with RPC fallback and user-friendly messages
export async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address,
  tokenInfo: TokenInfo,
  progressCallback?: ProgressCallback
): Promise<TokenBalance | null> {
  try {
    console.log(`Starting to fetch balance for ${tokenAddress}`);
    console.log(`Fetching balance for token: ${tokenInfo.symbol}`);
    
    progressCallback?.onProgress?.({
      type: 'info',
      message: `Fetching ${tokenInfo.symbol} balance...`,
      details: 'Connecting to blockchain network'
    });
    
    const publicClient = await createPublicClientWithFallback(progressCallback);
    
    progressCallback?.onProgress?.({
      type: 'info',
      message: `Reading ${tokenInfo.symbol} balance...`,
      details: 'Querying smart contract'
    });
    
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    const formattedBalance = (Number(balance) / 10 ** tokenInfo.decimals).toFixed(4);
    
    progressCallback?.onProgress?.({
      type: 'success',
      message: `Balance loaded: ${formattedBalance} ${tokenInfo.symbol}`,
      details: 'Ready to configure airdrop'
    });

    console.log(`Successfully fetched balance: ${balance.toString()}`);

    return {
      token: tokenInfo,
      balance,
      formattedBalance,
    };
  } catch (error) {
    console.error("Error getting token balance:", error);
    
    progressCallback?.onProgress?.({
      type: 'error',
      message: `Failed to load ${tokenInfo.symbol} balance`,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return null;
  }
}

// Check if a wallet has claimed tokens for a specific distribution with RPC fallback
export async function isClaimed(
  distributionId: number,
  wallet: Address
): Promise<boolean> {
  try {
    const publicClient = await createPublicClientWithFallback();
    return await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "isClaimed",
      args: [BigInt(distributionId), wallet],
    });
  } catch (error) {
    console.error("Error checking if claimed:", error);
    return false;
  }
}

// Check if a distribution is whitelist-only with RPC fallback
export async function isWhitelistOnly(
  distributionId: number
): Promise<boolean> {
  try {
    const publicClient = await createPublicClientWithFallback();
    return await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "isWhitelistOnly",
      args: [BigInt(distributionId)],
    });
  } catch (error) {
    console.error("Error checking if whitelist only:", error);
    return false;
  }
}

// Check if a wallet is whitelisted for a distribution with RPC fallback
export async function isWhitelisted(
  distributionId: number,
  wallet: Address,
  merkleProof: Hash[]
): Promise<boolean> {
  try {
    const publicClient = await createPublicClientWithFallback();
    return await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "isWhitelisted",
      args: [BigInt(distributionId), wallet, merkleProof],
    });
  } catch (error) {
    console.error("Error checking if whitelisted:", error);
    return false;
  }
}

// Get amount left for a distribution with RPC fallback
export async function getAmountLeft(distributionId: number): Promise<bigint> {
  try {
    const publicClient = await createPublicClientWithFallback();
    return await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "getAmountLeft",
      args: [BigInt(distributionId)],
    });
  } catch (error) {
    console.error("Error getting amount left:", error);
    return 0n;
  }
}

// Get amount claimed for a distribution with RPC fallback
export async function getAmountClaimed(
  distributionId: number
): Promise<bigint> {
  try {
    const publicClient = await createPublicClientWithFallback();
    return await publicClient.readContract({
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "getAmountClaimed",
      args: [BigInt(distributionId)],
    });
  } catch (error) {
    console.error("Error getting amount claimed:", error);
    return 0n;
  }
}

// Get token logo with fallback system
export async function getTokenLogo(
  tokenAddress: string,
  chainId: number = 8453 // Base network
): Promise<string | null> {
  // Step 1: Try Mint.club API first
  try {
    const mintClubUrl = `https://mint.club/api/tokens/logo?chainId=${chainId}&address=${tokenAddress}`;
    const response = await fetch(mintClubUrl);
    
    if (response.ok) {
      // Mint.club returns image data directly, so we return the API URL
      console.log(`Found logo from Mint.club for token ${tokenAddress}`);
      return mintClubUrl;
    }
  } catch (error) {
    console.log(`Mint.club API failed for token ${tokenAddress}:`, error);
  }

  // Step 2: Fallback to Hunt.town API
  try {
    const fallbackUrl = `https://fc.hunt.town/tokens/logo/${chainId}/${tokenAddress}/image`;
    const response = await fetch(fallbackUrl);
    
    if (response.ok) {
      console.log(`Found logo from Hunt.town for token ${tokenAddress}`);
      return fallbackUrl;
    }
  } catch (error) {
    console.log(`Hunt.town API failed for token ${tokenAddress}:`, error);
  }

  console.log(`No logo found for token ${tokenAddress} from any source`);
  return null;
}

// Cache for token logos to avoid repeated API calls
const logoCache = new Map<string, string | null>();

// Get token logo with caching
export async function getTokenLogoCached(
  tokenAddress: string,
  chainId: number = 8453
): Promise<string | null> {
  const cacheKey = `${chainId}-${tokenAddress}`;
  
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) || null;
  }
  
  const logoUrl = await getTokenLogo(tokenAddress, chainId);
  logoCache.set(cacheKey, logoUrl);
  
  return logoUrl;
}
