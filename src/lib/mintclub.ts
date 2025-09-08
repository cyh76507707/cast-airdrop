import {
  createPublicClient,
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
import { wagmiConfig } from "~/providers/wagmiConfig";
import { EMPTY_ROOT, MERKLE_DISTRIBUTOR_ADDRESS, NETWORK } from "./constants";

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

// Custom wait for transaction function (similar to mint.club-v2-web)
export async function customWaitForTransaction(
  chainId: number,
  tx: Hash
): Promise<any> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(NETWORK.RPC_URL),
  });

  let receipt: any;
  let attempts = 0;
  const MAX_TRIES = 30;

  // Little buffer to make sure the transaction is mined
  await new Promise((resolve) => setTimeout(resolve, 2000));

  while (!receipt && attempts < MAX_TRIES) {
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: tx });
      if (receipt) {
        break;
      }
    } catch (error) {
      // Transaction not found yet, continue waiting
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

// Create public client for read operations
const publicClient = createPublicClient({
  chain: base,
  transport: http(NETWORK.RPC_URL),
});

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
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    name: "Coinbase Wrapped Staked ETH",
    symbol: "cbETH",
    decimals: 18,
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
];

// Upload wallet list to IPFS via server-side API
export async function uploadWalletsToIPFS(wallets: string[]): Promise<string> {
  try {
    console.log(
      "Uploading wallets to IPFS via server API:",
      wallets.length,
      "wallets"
    );

    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallets }),
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
    const currentChainId = await getChainId(wagmiConfig);
    console.log(
      "Current chain ID:",
      currentChainId,
      "Expected:",
      NETWORK.CHAIN_ID
    );
    if (currentChainId !== NETWORK.CHAIN_ID) {
      console.log("Switching to Base network via wagmi...");
      await switchChain(wagmiConfig, { chainId: base.id });
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
  const account = await getAccount(wagmiConfig);
  if (!account.address) {
    throw new Error("No wallet account found");
  }
  return account.address as Address;
}

// Get token decimals
export async function getTokenDecimals(tokenAddress: Address): Promise<number> {
  try {
    const publicClient = createPublicClient({
      chain: base,
      transport: http(NETWORK.RPC_URL),
    });

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

// Check token allowance
export async function checkTokenAllowance(
  userAddress: Address,
  tokenAddress: Address,
  requiredAmount: bigint
): Promise<boolean> {
  try {
    console.log("Checking token allowance:", {
      userAddress,
      tokenAddress,
      requiredAmount: requiredAmount.toString(),
    });

    const publicClient = createPublicClient({
      chain: base,
      transport: http(NETWORK.RPC_URL),
    });

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
    const { request } = await simulateContract(wagmiConfig, {
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MERKLE_DISTRIBUTOR_ADDRESS, totalAmount],
    });
    console.log("Approval simulation successful, gas estimate:", request.gas);
    console.log("Sending approval transaction...");
    hash = (await Promise.race([
      writeContract(wagmiConfig, request),
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
    const receipt = await customWaitForTransaction(hash);

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
  config: AirdropConfig,
  callbacks?: {
    onAllowanceSignatureRequest?: () => void;
    onAllowanceSigned?: (txHash: Hash) => void;
    onAllowanceSuccess?: (receipt: any) => void;
    onSignatureRequest?: () => void;
    onSigned?: (txHash: Hash) => void;
    onSuccess?: (receipt: any) => void;
    onError?: (error: unknown) => void;
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
      const publicClient = createPublicClient({
        chain: base,
        transport: http(NETWORK.RPC_URL),
      });

      const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
        publicClient.readContract({
          address: config.token as Address,
          abi: ERC20_ABI,
          functionName: "name",
        }),
        publicClient.readContract({
          address: config.token as Address,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: config.token as Address,
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
        `Invalid token address: ${config.token}. Please check if this is a valid ERC20 token on Base network.`
      );
    }

    // Get token decimals for proper amount calculation
    const tokenDecimals = await getTokenDecimals(config.token as Address);
    console.log("Token decimals:", tokenDecimals);

    // Calculate amounts (exactly like mint.club)
    // config.amountPerClaim is the total amount for the entire airdrop
    // We need to calculate the amount per user for the contract call
    const totalAmountWei = wei(
      config.amountPerClaim.toString(),
      config.isERC20 ? tokenDecimals : 0
    );
    const amountPerClaimWei = totalAmountWei / BigInt(config.walletCount);

    console.log("Amount calculations:", {
      amountPerClaimWei: amountPerClaimWei.toString(),
      totalAmountWei: totalAmountWei.toString(),
      walletCount: config.walletCount,
      tokenDecimals: tokenDecimals,
    });

    // Step 1: Always request token approval (to ensure sufficient allowance)
    console.log("Requesting token approval...");
    if (callbacks?.onAllowanceSignatureRequest) {
      callbacks.onAllowanceSignatureRequest();
    }

    // Always request token approval to ensure sufficient allowance
    await approveTokenForAirdrop(config.token as Address, totalAmountWei, {
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

    // Step 2: Create airdrop
    console.log("Creating airdrop by calling MerkleDistributor contract...");

    // Call signature request callback
    if (callbacks?.onSignatureRequest) {
      callbacks.onSignatureRequest();
    }

    console.log("Creating wallet client and sending transaction...");

    console.log("Preparing airdrop transaction...");
    let tx: Hash;
    console.log("Simulating airdrop transaction...");
    const { request } = await simulateContract(wagmiConfig, {
      address: MERKLE_DISTRIBUTOR_ADDRESS,
      abi: MERKLE_DISTRIBUTOR_ABI,
      functionName: "createDistribution",
      args: [
        config.token as Address,
        config.isERC20,
        amountPerClaimWei,
        config.walletCount,
        config.startTime,
        config.endTime,
        (config.merkleRoot as `0x${string}`) || EMPTY_ROOT,
        config.title,
        config.ipfsCID,
      ],
    });
    console.log("Airdrop simulation successful, gas estimate:", request.gas);
    tx = (await Promise.race([
      writeContract(wagmiConfig, request),
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
    const receipt = await customWaitForTransaction(tx);

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

// Get the latest airdrop ID
export async function getLatestAirdropId(): Promise<number> {
  try {
    console.log("Getting latest airdrop ID...");

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

// Get airdrop information by ID
export async function getAirdropById(airdropId: number): Promise<Distribution> {
  try {
    console.log("Getting airdrop by ID:", airdropId);

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

// Get token info from contract
export async function getTokenInfo(
  address: Address
): Promise<TokenInfo | null> {
  try {
    if (!isValidTokenAddress(address)) {
      return null;
    }

    const [name, symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "name",
      }),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    return {
      address,
      name,
      symbol,
      decimals,
      isERC20: true,
    };
  } catch (error) {
    console.error("Error getting token info:", error);
    return null;
  }
}

// Get token balance for a specific wallet
export async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address,
  tokenInfo: TokenInfo
): Promise<TokenBalance | null> {
  try {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    return {
      token: tokenInfo,
      balance,
      formattedBalance: (Number(balance) / 10 ** tokenInfo.decimals).toFixed(4),
    };
  } catch (error) {
    console.error("Error getting token balance:", error);
    return null;
  }
}

// Check if a wallet has claimed tokens for a specific distribution
export async function isClaimed(
  distributionId: number,
  wallet: Address
): Promise<boolean> {
  try {
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

// Check if a distribution is whitelist-only
export async function isWhitelistOnly(
  distributionId: number
): Promise<boolean> {
  try {
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

// Check if a wallet is whitelisted for a distribution
export async function isWhitelisted(
  distributionId: number,
  wallet: Address,
  merkleProof: Hash[]
): Promise<boolean> {
  try {
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

// Get amount left for a distribution
export async function getAmountLeft(distributionId: number): Promise<bigint> {
  try {
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

// Get amount claimed for a distribution
export async function getAmountClaimed(
  distributionId: number
): Promise<bigint> {
  try {
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
