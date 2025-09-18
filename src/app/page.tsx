"use client";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/LoadingSpinner";
import { Select } from "@/components/ui/Select";
import { ShareButton } from "@/components/ui/Share";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { prefetchNeynarFromUrl } from "@/hooks/neynar";
import { APP_URL } from "@/lib/constants";
import {
  createAirdrop,
  generateAirdropLink,
  generateMerkleRoot,
  getLatestAirdropId,
  getTokenBalance,
  PREDEFINED_TOKENS,
  TokenBalance,
  uploadWalletsToIPFS,
} from "@/lib/mintclub";
import {
  CastEngagement,
  CastInfo,
  CastUser,
  transformCastToInfo,
} from "@/lib/neynar";
import { sdk } from "@farcaster/miniapp-sdk";
import React, { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useFrame } from "~/components/providers/FrameProvider";

type Step =
  | "url-input"
  | "user-analysis"
  | "airdrop-form"
  | "summary"
  | "completion";

interface AirdropForm {
  title: string;
  tokenAddress: string;
  totalAmount: string;
  endTime: string;
}

export default function CastAirdropPage() {
  const { isSDKLoaded } = useFrame();
  const { address, isConnected } = useAccount();

  console.log("🔍 CastAirdropPage render - isSDKLoaded:", isSDKLoaded);

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (!isSDKLoaded || appReady) return;
    (async () => {
      await sdk.actions.ready();

      // Automatically show add mini app popup (following clap-web pattern)
      // NOTE: we shouldn't await this because it stops the context from being read
      // we also catch it separately because it throws an error when user rejects the prompt
      sdk.actions.addMiniApp().catch(() => {
        // Silently ignore mini app addition errors (e.g., user rejection)
      });

      setAppReady(true);

      // App is ready for use
      console.log("App initialized successfully");
    })();
  }, [isSDKLoaded, appReady]);

  // (Removed intermediate loader to keep hook order stable; FrameProvider gates rendering)

  const [currentStep, setCurrentStep] = useState<Step>("url-input");
  const [castUrl, setCastUrl] = useState("");
  const [castHash, setCastHash] = useState<string | null>(null);
  const [users, setUsers] = useState<CastUser[]>([]);
  const [engagement, setEngagement] = useState<CastEngagement | null>(null);
  const [castInfo, setCastInfo] = useState<CastInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track completion status for each step
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(
    new Set(["url-input"])
  );
  // Set default end time to 1 week from now
  const getDefaultEndTime = () => {
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    return oneWeekLater.toISOString().slice(0, 16); // Format for datetime-local input
  };

  const [airdropForm, setAirdropForm] = useState<AirdropForm>({
    title: "",
    tokenAddress: "",
    totalAmount: "",
    endTime: getDefaultEndTime(),
  });
  const [airdropLink, setAirdropLink] = useState<string | null>(null);
  const [tokenBalance, _setTokenBalance] = useState<TokenBalance | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<
    | "idle"
    | "preparing"
    | "approval-signing"
    | "approval-confirming"
    | "approval-completed"
    | "airdrop-signing"
    | "airdrop-confirming"
    | "completed"
    | "error"
    | "id-fetch-failed"
  >("idle");
  const [progressMessage, setProgressMessage] = useState<{
    type: string;
    message: string;
    details?: string;
  } | null>(null);

  // Note: Removed handleTokenInfoUpdate to prevent infinite loops
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(
    null
  );
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | null>(null);

  // Airdrop Whitelist related state
  const [selectedActions, setSelectedActions] = useState({
    likes: true,
    recasts: true,
    quotes: true,
    comments: true,
  });
  const [excludedUsers, setExcludedUsers] = useState<Set<string>>(new Set());

  // Check if user can proceed to review based on wallet connection and balance
  const canProceedToReview = (): boolean => {
    if (!isConnected) return false;
    if (
      !airdropForm.tokenAddress ||
      !airdropForm.totalAmount ||
      !airdropForm.endTime
    )
      return false;

    // Check if user has sufficient balance
    if (tokenBalance && airdropForm.totalAmount) {
      const requiredAmount = parseFloat(airdropForm.totalAmount);
      const userBalance = Number(tokenBalance.formattedBalance);
      return userBalance >= requiredAmount;
    }

    return true;
  };

  // TokenBalanceDisplay component
  const TokenBalanceDisplay = ({
    tokenAddress,
    walletAddress,
    totalAmount,
    userCount,
  }: {
    tokenAddress: string;
    walletAddress: string;
    totalAmount: string;
    userCount: number;
  }) => {
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<TokenBalance | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState<{
      type: string;
      message: string;
      details?: string;
    } | null>(null);
    const hasFetchedRef = useRef<string | null>(null);
    const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Reset cache when token address changes
    useEffect(() => {
      hasFetchedRef.current = null;
    }, [tokenAddress]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (progressTimeoutRef.current) {
          clearTimeout(progressTimeoutRef.current);
        }
      };
    }, []);

    // Auto-fetch balance when component mounts or tokenAddress changes
    useEffect(() => {
      const fetchBalance = async () => {
        if (!tokenAddress || tokenAddress === "custom" || !walletAddress)
          return;

        // Prevent duplicate calls for the same token address within the same session
        if (hasFetchedRef.current === tokenAddress) {
          console.log(
            `Already fetched balance for ${tokenAddress}, skipping...`
          );
          return;
        }

        console.log(`Starting to fetch balance for ${tokenAddress}`);
        setLoading(true);
        setError(null);
        setProgressMessage(null);
        hasFetchedRef.current = tokenAddress;

        try {
          // First try to find in predefined tokens
          let currentTokenInfo = PREDEFINED_TOKENS.find(
            (token) => token.address === tokenAddress
          );

          // If not found in predefined tokens, create a basic token info
          if (!currentTokenInfo) {
            console.log(
              "Token not found in predefined list, using default token info..."
            );
            currentTokenInfo = {
              address: tokenAddress as `0x${string}`,
              name: "Custom Token",
              symbol: "CUSTOM",
              decimals: 18,
              isERC20: true,
            };
            console.log(
              "Using default token info for custom token:",
              currentTokenInfo
            );
          }

          if (currentTokenInfo) {
            console.log(
              `Fetching balance for token: ${currentTokenInfo.symbol}`
            );
            const balanceData = await getTokenBalance(
              tokenAddress as `0x${string}`,
              walletAddress as `0x${string}`,
              currentTokenInfo,
              {
                onProgress: (message) => {
                  // Clear existing timeout
                  if (progressTimeoutRef.current) {
                    clearTimeout(progressTimeoutRef.current);
                  }

                  setProgressMessage({
                    type: message.type,
                    message: message.message,
                    details: message.details,
                  });

                  // Auto-hide message after 3 seconds for success messages
                  if (message.type === "success") {
                    progressTimeoutRef.current = setTimeout(() => {
                      setProgressMessage(null);
                    }, 3000);
                  }
                },
              }
            );
            setBalance(balanceData);
            console.log(`Successfully fetched balance for ${tokenAddress}`);
          } else {
            setError("Token not found or invalid address");
          }
        } catch (err) {
          setError("Failed to fetch token balance");
          console.error("Error fetching token balance:", err);
          hasFetchedRef.current = null; // Reset on error to allow retry
        } finally {
          setLoading(false);
          // Don't reset progressMessage here - let it show the final result
        }
      };

      fetchBalance();
    }, [tokenAddress, walletAddress]);

    // Show progress message even when not loading (for success/error states)
    const showProgressMessage = progressMessage && (
      <div
        className={`text-xs p-2 rounded-md mb-2 ${
          progressMessage.type === "info"
            ? "bg-blue-50 text-blue-700"
            : progressMessage.type === "success"
            ? "bg-green-50 text-green-700"
            : progressMessage.type === "warning"
            ? "bg-yellow-50 text-yellow-700"
            : progressMessage.type === "error"
            ? "bg-red-50 text-red-700"
            : "bg-gray-50 text-gray-700"
        }`}
      >
        <div className="font-medium">{progressMessage.message}</div>
        {progressMessage.details && (
          <div className="text-xs opacity-75 mt-1">
            {progressMessage.details}
          </div>
        )}
      </div>
    );

    if (loading) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Loading balance...</div>
          {showProgressMessage}
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-red-600">Error: {error}</div>
          {showProgressMessage}
        </div>
      );
    }

    if (!balance) {
      return <div className="text-sm text-gray-600">Balance not available</div>;
    }

    const requiredAmount = totalAmount ? parseFloat(totalAmount) : 0;
    const userBalance = Number(balance.formattedBalance);
    const hasSufficientBalance =
      requiredAmount > 0 && userBalance >= requiredAmount;

    return (
      <div className="mt-3 space-y-2">
        {showProgressMessage}
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Your Balance:</span>
          <span className="font-semibold text-gray-900">
            {balance.formattedBalance} {balance.token.symbol}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Required Amount:</span>
          <span className="font-semibold text-gray-900">
            {requiredAmount} {balance.token.symbol}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Per User:</span>
          <span className="font-semibold text-gray-900">
            {userCount > 0 ? (requiredAmount / userCount).toFixed(4) : "0"}{" "}
            {balance.token.symbol}
          </span>
        </div>

        {!hasSufficientBalance && requiredAmount > 0 && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            ⚠️ Insufficient balance. You need{" "}
            {(requiredAmount - userBalance).toFixed(4)} more{" "}
            {balance.token.symbol}
          </div>
        )}
      </div>
    );
  };

  // SDK initialization is handled only in FrameProvider (same pattern as Clap)

  // Keep splash visible until app is ready to display
  if (!appReady) {
    return null;
  }

  // Show wallet connection requirement message if wallet is not connected
  const _showWalletRequirement = !isConnected && currentStep === "airdrop-form";

  const handleUrlSubmit = async () => {
    if (!castUrl.trim()) {
      setError("Please enter a valid Farcaster post URL");
      return;
    }

    // Basic URL format validation
    if (
      !castUrl.includes("farcaster.xyz") &&
      !castUrl.includes("warpcast.com")
    ) {
      setError("Please enter a valid Farcaster post URL");
      return;
    }

    // Continue button always loads new data (refresh)
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Starting analysis for URL:", castUrl);

      // Prefetch with SWR to seed cache and fetch data once
      const { castData, engagementData } = await prefetchNeynarFromUrl(
        castUrl,
        "url"
      );
      const castInfoData = transformCastToInfo(castData);

      if (engagementData) setEngagement(engagementData);
      setCastInfo(castInfoData);
      if (engagementData) setUsers(engagementData.totalUsers);
      setCastHash(castData?.cast?.hash || castUrl);

      // Reset Airdrop Whitelist state for new data
      setSelectedActions({
        likes: true,
        recasts: true,
        quotes: true,
        comments: true,
      });
      setExcludedUsers(new Set());

      // Mark step 2 as completed
      setCompletedSteps((prev) => new Set([...prev, "user-analysis"]));

      if (engagementData) {
        console.log("✅ Analysis completed:", {
          totalUsers: engagementData.totalUsers.length,
          likes: engagementData.likes.length,
          recasts: engagementData.recasts.length,
          quotes: engagementData.quotes.length,
          comments: engagementData.comments.length,
        });
      } else {
        console.log(
          "✅ Analysis completed: engagement data unavailable at prefetch time"
        );
      }
    } catch (err) {
      console.error("❌ Error in handleUrlSubmit:", err);
      setError("Failed to analyze the post. Please try again.");
    } finally {
      setLoading(false);
    }

    setCurrentStep("user-analysis");
  };

  const handleAirdropFormSubmit = () => {
    if (
      !airdropForm.tokenAddress ||
      !airdropForm.totalAmount ||
      !airdropForm.endTime
    ) {
      setError("Please fill in all required fields");
      return;
    }

    // Set auto-generated title
    const autoGeneratedTitle = generateAirdropTitle();
    setAirdropForm((prev) => ({ ...prev, title: autoGeneratedTitle }));

    setCompletedSteps((prev) => new Set([...prev, "airdrop-form"]));
    setCurrentStep("summary");
  };

  // Airdrop Whitelist related functions
  const getAllEligibleUsers = () => {
    if (!engagement) return []; // Return empty array if engagement is not loaded

    const allUsers: CastUser[] = [];

    if (selectedActions.likes) {
      allUsers.push(...engagement.likes);
    }
    if (selectedActions.recasts) {
      allUsers.push(...engagement.recasts);
    }
    if (selectedActions.quotes) {
      allUsers.push(...engagement.quotes);
    }
    if (selectedActions.comments) {
      allUsers.push(...engagement.comments);
    }

    // Remove duplicates
    const uniqueUsers = allUsers.filter(
      (user, index, self) => index === self.findIndex((u) => u.fid === user.fid)
    );

    return uniqueUsers;
  };

  const getFinalUserList = () => {
    const allEligibleUsers = getAllEligibleUsers();

    // Return only users that are NOT excluded (i.e., checked users)
    return allEligibleUsers.filter(
      (user) => !excludedUsers.has(user.fid.toString())
    );
  };

  const toggleUserExclusion = (fid: number) => {
    const newExcludedUsers = new Set(excludedUsers);
    if (newExcludedUsers.has(fid.toString())) {
      newExcludedUsers.delete(fid.toString());
    } else {
      newExcludedUsers.add(fid.toString());
    }
    setExcludedUsers(newExcludedUsers);
  };

  const openUserProfile = (username: string) => {
    window.open(`https://warpcast.com/${username}`, "_blank");
  };

  // Auto-generate title function
  const generateAirdropTitle = () => {
    if (!castInfo) return "DropCast";

    const authorName = castInfo.author.displayName || castInfo.author.username;
    const castHash = castInfo.hash.substring(0, 10); // Use only first 10 characters of hash

    // Capitalize first letter of username
    const capitalizedName =
      authorName.charAt(0).toUpperCase() + authorName.slice(1);

    return `${capitalizedName}'s DropCast (${castHash})`;
  };

  const handleCreateAirdrop = async () => {
    if (!getFinalUserList().length) {
      setError("No eligible users found");
      return;
    }

    if (!isConnected) {
      setError("Wallet is not connected. Please connect your wallet.");
      return;
    }

    setCompletedSteps((prev) => new Set([...prev, "summary"]));
    setLoading(true);
    setError(null);
    setTransactionStatus("preparing");

    try {
      // Step 1: Get final user list from step 2 (whitelist selection)
      const finalUserList = getFinalUserList();
      console.log(
        "Final user list for airdrop:",
        finalUserList.length,
        "users"
      );

      // Step 2: Extract primary wallet addresses from selected users
      const primaryWalletAddresses = finalUserList.map(
        (user) => user.walletAddress
      );
      console.log("Primary wallet addresses:", primaryWalletAddresses);

      // Step 3: Calculate amounts (using mint.club's approach)
      const totalAmount = parseFloat(airdropForm.totalAmount);
      console.log("Total amount for airdrop:", totalAmount);
      console.log("Number of users:", finalUserList.length);

      // Step 4: Generate merkle root and upload to IPFS
      setTransactionStatus("preparing");
      const merkleRoot = await generateMerkleRoot(primaryWalletAddresses);
      const ipfsCID = await uploadWalletsToIPFS(primaryWalletAddresses);
      console.log("Merkle root:", merkleRoot);
      console.log("IPFS CID:", ipfsCID);

      // Step 5: Create airdrop using mint.club's verified approach
      const endTime = Math.floor(
        new Date(airdropForm.endTime).getTime() / 1000
      );
      const startTime = Math.floor(Date.now() / 1000);

      console.log("Creating airdrop with mint.club approach...");
      setTransactionStatus("airdrop-signing");

      const _receipt = await createAirdrop(
        {
          title: airdropForm.title,
          token: airdropForm.tokenAddress as `0x${string}`,
          isERC20: true,
          amountPerClaim: totalAmount, // Total amount for the entire airdrop
          walletCount: finalUserList.length,
          startTime,
          endTime,
          merkleRoot,
          ipfsCID,
        },
        {
          // Token approval callbacks
          onAllowanceSignatureRequest: () => {
            setTransactionStatus("approval-signing");
            console.log("Token approval signature requested");
          },
          onAllowanceSigned: (txHash: `0x${string}`) => {
            setApprovalHash(txHash);
            setTransactionStatus("approval-confirming");
            console.log("Token approval signed:", txHash);
          },
          onAllowanceSuccess: (receipt: any) => {
            setTransactionStatus("approval-completed");
            console.log("Token approval completed:", receipt);
          },
          // Airdrop transaction callbacks
          onSignatureRequest: () => {
            setTransactionStatus("airdrop-signing");
            console.log("Airdrop transaction signature requested");
          },
          onSigned: (txHash: `0x${string}`) => {
            setTransactionHash(txHash);
            setTransactionStatus("airdrop-confirming");
            console.log("Airdrop transaction signed:", txHash);
          },
          onSuccess: (receipt: any) => {
            setTransactionStatus("completed");
            console.log("Airdrop transaction successful:", receipt);
          },
          onError: (error: unknown) => {
            setTransactionStatus("error");
            console.error("Transaction failed:", error);

            // Provide user-friendly error messages
            if (error instanceof Error) {
              if (error.message.includes("Base network")) {
                setError(
                  "Please switch to Base network in MetaMask and try again."
                );
              } else if (error.message.includes("User denied")) {
                setError("Transaction was cancelled. Please try again.");
              } else if (error.message.includes("insufficient funds")) {
                setError(
                  "Insufficient funds for transaction. Please check your balance."
                );
              } else {
                setError(`Transaction failed: ${error.message}`);
              }
            } else {
              setError("Transaction failed. Please try again.");
            }

            throw error;
          },
          // Progress callback for RPC connection status
          onProgress: (message) => {
            console.log("Airdrop progress:", message);
            setProgressMessage({
              type: message.type,
              message: message.message,
              details: message.details,
            });
          },
        }
      );

      // Step 7: Wait for blockchain confirmation and get airdrop ID
      console.log("Waiting for blockchain confirmation...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      let airdropId: number | null = null;

      try {
        // Get the latest airdrop ID from the blockchain
        airdropId = await getLatestAirdropId();
        console.log("Got actual airdrop ID:", airdropId);

        // Step 8: Generate MintClub airdrop page link
        const link = generateAirdropLink(airdropId);
        setAirdropLink(link);
        setCompletedSteps((prev) => new Set([...prev, "completion"]));
        setCurrentStep("completion");
        setTransactionStatus("completed");

        console.log("Airdrop created successfully! Link:", link);
      } catch (error) {
        console.warn("Could not get actual airdrop ID:", error);
        setTransactionStatus("id-fetch-failed");
        setCompletedSteps((prev) => new Set([...prev, "completion"]));
        setCurrentStep("completion");

        // Show progress message about the issue
        setProgressMessage({
          type: "warning",
          message: "Airdrop created but ID retrieval failed",
          details:
            "Due to network rate limiting, we could not fetch the airdrop ID",
        });
      }
    } catch (err) {
      console.error("Error in handleCreateAirdrop:", err);
      setTransactionStatus("error");

      if (err instanceof Error) {
        setError(`Failed to create airdrop: ${err.message}`);
      } else {
        setError("Failed to create airdrop. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (airdropLink) {
      try {
        await navigator.clipboard.writeText(airdropLink);
        // You could add a toast notification here
      } catch (_err) {
        console.error("Failed to copy to clipboard");
      }
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "url-input", label: "Post URL" },
      { key: "user-analysis", label: "Analyze Users" },
      { key: "airdrop-form", label: "Configure Airdrop" },
      { key: "summary", label: "Review" },
      { key: "completion", label: "Complete" },
    ];

    const currentStepData = steps.find((step) => step.key === currentStep);

    return (
      <div className="mb-6">
        {/* Step numbers */}
        <div className="flex items-center justify-center mb-4 px-4">
          <div className="flex items-center space-x-1 w-full max-w-md justify-between">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.has(step.key as Step);
              const isCurrent = currentStep === step.key;

              return (
                <React.Fragment key={step.key}>
                  <div
                    className={cn(
                      "transition-colors",
                      isCompleted
                        ? "cursor-pointer hover:opacity-80"
                        : "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => {
                      if (isCompleted) {
                        setCurrentStep(step.key as Step);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold font-display transition-all duration-200 shadow-lg",
                        isCurrent
                          ? "bg-gradient-to-br from-pink-500 to-orange-500 text-white shadow-pink-200/50 transform scale-110"
                          : isCompleted
                          ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-green-200/50"
                          : "bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600 shadow-gray-100/50"
                      )}
                    >
                      {index + 1}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-4 h-1 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Current step title */}
        {currentStepData && (
          <div className="text-center">
            <h2 className="text-xl font-bold font-display bg-gradient-to-r from-pink-600 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              {currentStepData.label}
            </h2>
          </div>
        )}
      </div>
    );
  };

  const renderUrlInput = () => (
    <div className="space-y-4">
      {/* URL Input Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enter Farcaster Post URL</CardTitle>
          <CardDescription>
            Paste the URL of the Farcaster post you want to create an airdrop
            for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Post URL"
            placeholder="https://farcaster.xyz/project7/0xcfc31437..."
            value={castUrl}
            onChange={(e) => setCastUrl(e.target.value)}
            error={error ?? undefined}
          />
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUrlSubmit}
            loading={loading}
            className="w-full"
          >
            Continue
          </Button>
        </CardFooter>
      </Card>

      {/* What is DropCast? Info Box */}
      <Card className="w-full card-colorful">
        <CardHeader>
          <CardTitle className="text-gray-800 font-display font-bold">
            What is DropCast?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mt-2">
            <p className="text-sm text-gray-700 font-medium">
              DropCast allows you to reward Farcaster users who engage with your
              posts through likes, recasts, quotes, and comments.
            </p>
          </div>
          <div className="p-3 bg-gradient-to-r from-pink-100 to-orange-100 rounded-2xl border border-pink-200/50">
            <p className="text-xs text-gray-700 font-medium">
              <strong className="text-pink-600">💡 Tip:</strong> This tool helps
              you build stronger communities by rewarding active participants in
              your Farcaster discussions.
            </p>
          </div>
          <div className="p-3 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border border-orange-200/50">
            <p className="text-xs text-gray-700 font-medium">
              <strong className="text-orange-600">🔗 Powered by:</strong>{" "}
              DropCast is using{" "}
              <a
                href="https://mint.club/airdrops"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-600 hover:text-pink-700 underline font-semibold transition-colors"
              >
                Mint Club Airdrop
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderUserAnalysis = () => {
    if (loading) {
      return (
        <LoadingCard message="Analyzing users who engaged with this post..." />
      );
    }

    if (!engagement || !castInfo) {
      return (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load engagement data.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    // Generate user summary info
    const formatUserList = (users: CastUser[], maxShow: number = 2) => {
      if (users.length === 0) return "None";
      if (users.length <= maxShow) {
        return users.map((u) => u.username).join(", ");
      }
      return `${users
        .slice(0, maxShow)
        .map((u) => u.username)
        .join(", ")}, and ${users.length - maxShow} others`;
    };

    return (
      <div className="w-full space-y-4">
        {/* Cast Information */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => window.open(castUrl, "_blank")}
        >
          <CardContent>
            <div className="flex items-start space-x-3">
              <img
                src={castInfo.author.pfpUrl || "/default-avatar.png"}
                alt={castInfo.author.displayName}
                className="w-10 h-10 rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium text-gray-900 text-sm">
                    {castInfo.author.displayName}
                  </span>
                  <span className="text-gray-500 text-xs">
                    @{castInfo.author.username}
                  </span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {castInfo.text.length > 120
                    ? `${castInfo.text.substring(0, 120)}...`
                    : castInfo.text}
                </p>
                {castInfo.embeds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {castInfo.embeds.slice(0, 2).map((embed, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg px-2 py-1 text-xs"
                      >
                        {embed.url && (
                          <span className="text-blue-600 truncate block max-w-[150px]">
                            {embed.url.includes("stream.farcaster.xyz")
                              ? "📹 Video"
                              : "🔗 Link"}
                          </span>
                        )}
                      </div>
                    ))}
                    {castInfo.embeds.length > 2 && (
                      <div className="bg-gray-50 rounded-lg px-2 py-1 text-xs text-gray-500">
                        +{castInfo.embeds.length - 2} more
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                  <span>❤️ {engagement.likes.length}</span>
                  <span>🔄 {engagement.recasts.length}</span>
                  <span>💬 {engagement.quotes.length}</span>
                  <span>💭 {engagement.comments.length}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-right">
              <span className="text-xs text-purple-600 font-medium">
                Click to view full post →
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display font-bold">
              Engagement Summary
            </CardTitle>
            <CardDescription>
              Found {users.length} unique users who engaged with this post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-pink-100 to-red-100 rounded-2xl border border-pink-200/50 shadow-sm">
                <span className="font-bold text-pink-700 text-sm">❤️ Like</span>
                <span className="text-pink-600 text-xs text-right max-w-[60%] font-medium">
                  {formatUserList(engagement.likes)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border border-orange-200/50 shadow-sm">
                <span className="font-bold text-orange-700 text-sm">
                  🔄 Recast
                </span>
                <span className="text-orange-600 text-xs text-right max-w-[60%] font-medium">
                  {formatUserList(engagement.recasts)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border border-purple-200/50 shadow-sm">
                <span className="font-bold text-purple-700 text-sm">
                  💬 Quote
                </span>
                <span className="text-purple-600 text-xs text-right max-w-[60%] font-medium">
                  {formatUserList(engagement.quotes)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl border border-yellow-200/50 shadow-sm">
                <span className="font-bold text-yellow-700 text-sm">
                  💭 Comment
                </span>
                <span className="text-yellow-600 text-xs text-right max-w-[60%] font-medium">
                  {formatUserList(engagement.comments)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Airdrop Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle>Airdrop Whitelist</CardTitle>
            <CardDescription>
              Select which actions to include and manage the final user list
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Action Selection */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 text-sm">
                Include Users Who:
              </h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.likes}
                    onChange={(e) =>
                      setSelectedActions({
                        ...selectedActions,
                        likes: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-700">
                    ❤️ Liked the post ({engagement.likes.length} users)
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.recasts}
                    onChange={(e) =>
                      setSelectedActions({
                        ...selectedActions,
                        recasts: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-700">
                    🔄 Recasted the post ({engagement.recasts.length} users)
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.quotes}
                    onChange={(e) =>
                      setSelectedActions({
                        ...selectedActions,
                        quotes: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-700">
                    💬 Quoted the post ({engagement.quotes.length} users)
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.comments}
                    onChange={(e) =>
                      setSelectedActions({
                        ...selectedActions,
                        comments: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-xs text-gray-700">
                    💭 Commented on the post ({engagement.comments.length}{" "}
                    users)
                  </span>
                </label>
              </div>
            </div>

            {/* Final User List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 text-sm">
                Final User List ({getFinalUserList().length} users)
              </h4>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {getAllEligibleUsers().length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No users found. Please check at least one action type above.
                  </p>
                ) : (
                  getAllEligibleUsers().map((user) => (
                    <div
                      key={user.fid}
                      className={`flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg ${
                        excludedUsers.has(user.fid.toString())
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!excludedUsers.has(user.fid.toString())}
                        onChange={() => toggleUserExclusion(user.fid)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <img
                        src={user.pfpUrl || "/default-avatar.png"}
                        alt={user.username}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                      />
                      <span
                        className="text-xs text-gray-700 cursor-pointer hover:text-blue-600 truncate"
                        onClick={() => openUserProfile(user.username)}
                      >
                        {user.username}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Make Airdrop Button */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={() => {
              setCompletedSteps((prev) => new Set([...prev, "airdrop-form"]));
              setCurrentStep("airdrop-form");
            }}
            className="w-full btn-colorful text-base font-display font-bold"
            disabled={getFinalUserList().length === 0}
          >
            🎉 Make Airdrop for them ({getFinalUserList().length} users)
          </Button>
        </div>
      </div>
    );
  };

  const renderAirdropForm = () => {
    // Check if wallet is connected
    if (!isConnected) {
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Wallet Connection Required</CardTitle>
            <CardDescription>
              You need to connect your wallet to configure the airdrop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Please connect your wallet using the &quot;Connect Wallet&quot;
                button in the header.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Page
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Configure Airdrop</CardTitle>
          <CardDescription>
            Set up your airdrop parameters and token distribution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            label="Token"
            options={[
              ...PREDEFINED_TOKENS.map((token) => ({
                value: token.address,
                label: `${token.name} (${token.symbol})`,
                tokenAddress: token.address,
              })),
              { value: "custom", label: "Custom Token Address" },
            ]}
            value={airdropForm.tokenAddress}
            onChange={(value) =>
              setAirdropForm({ ...airdropForm, tokenAddress: value })
            }
            placeholder="Select a token"
          />

          {airdropForm.tokenAddress === "custom" && (
            <Input
              label="Custom Token Address"
              placeholder="0x..."
              onChange={(e) =>
                setAirdropForm({ ...airdropForm, tokenAddress: e.target.value })
              }
            />
          )}

          {/* Display token information and balance */}
          {airdropForm.tokenAddress &&
            airdropForm.tokenAddress !== "custom" && (
              <div
                className={`p-3 border rounded-lg ${
                  PREDEFINED_TOKENS.find(
                    (token) => token.address === airdropForm.tokenAddress
                  )
                    ? "bg-blue-50 border-blue-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div
                  className="flex items-center space-x-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() =>
                    window.open(
                      `https://basescan.org/token/${airdropForm.tokenAddress}`,
                      "_blank"
                    )
                  }
                >
                  {airdropForm.tokenAddress && (
                    <TokenLogo
                      tokenAddress={airdropForm.tokenAddress}
                      size="sm"
                      className="flex-shrink-0"
                    />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      PREDEFINED_TOKENS.find(
                        (token) => token.address === airdropForm.tokenAddress
                      )
                        ? "text-blue-900"
                        : "text-green-900"
                    }`}
                  >
                    {(() => {
                      const predefinedToken = PREDEFINED_TOKENS.find(
                        (token) => token.address === airdropForm.tokenAddress
                      );
                      if (predefinedToken) {
                        return `${
                          predefinedToken.symbol
                        }: ${airdropForm.tokenAddress.slice(
                          0,
                          6
                        )}...${airdropForm.tokenAddress.slice(-6)}`;
                      } else {
                        return `Custom Token: ${airdropForm.tokenAddress.slice(
                          0,
                          6
                        )}...${airdropForm.tokenAddress.slice(-6)}`;
                      }
                    })()}
                  </p>
                  <span className="text-xs text-gray-500 ml-1">🔗</span>
                </div>
                <TokenBalanceDisplay
                  tokenAddress={airdropForm.tokenAddress}
                  walletAddress={address || ""}
                  totalAmount={airdropForm.totalAmount}
                  userCount={getFinalUserList().length}
                />
              </div>
            )}

          <Input
            label="Total Amount"
            type="number"
            placeholder="1000"
            value={airdropForm.totalAmount}
            onChange={(e) =>
              setAirdropForm({ ...airdropForm, totalAmount: e.target.value })
            }
            helperText={`Each user will receive ${
              airdropForm.totalAmount && getFinalUserList().length
                ? (
                    parseFloat(airdropForm.totalAmount) /
                    getFinalUserList().length
                  ).toFixed(2)
                : "0"
            } tokens`}
          />

          <Input
            label="End Date"
            type="datetime-local"
            value={airdropForm.endTime}
            onChange={(e) =>
              setAirdropForm({ ...airdropForm, endTime: e.target.value })
            }
          />
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleAirdropFormSubmit}
            className="w-full"
            disabled={!canProceedToReview()}
          >
            Review Airdrop
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const renderSummary = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Review Airdrop</CardTitle>
        <CardDescription>
          Please review your airdrop configuration before creating.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mt-4 space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-green-600">Title:</span>
            <span className="text-sm text-gray-700 break-words text-right max-w-[70%]">
              {airdropForm.title.split(" (")[0]}
              {airdropForm.title.includes("(") && (
                <span className="text-blue-600">
                  {" ("}
                  <a
                    href={castUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {airdropForm.title.split("(")[1].split(")")[0]}
                  </a>
                  {")"}
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-green-600">Token:</span>
            <span className="text-sm text-gray-700 text-right max-w-[70%]">
              {(() => {
                const tokenInfo = PREDEFINED_TOKENS.find(
                  (token) => token.address === airdropForm.tokenAddress
                );
                if (tokenInfo) {
                  const shortAddress = `${airdropForm.tokenAddress.slice(
                    0,
                    6
                  )}...${airdropForm.tokenAddress.slice(-6)}`;
                  return (
                    <span>
                      {tokenInfo.symbol} (
                      <a
                        href={`https://basescan.org/token/${airdropForm.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {shortAddress}
                      </a>
                      )
                    </span>
                  );
                }
                return airdropForm.tokenAddress;
              })()}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-green-600">
              Total Amount:
            </span>
            <span className="text-sm text-gray-700">
              {airdropForm.totalAmount}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-green-600">Users:</span>
            <span className="text-sm text-gray-700">
              {getFinalUserList().length}
            </span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-sm font-medium text-green-600">
              Per User:
            </span>
            <span className="text-sm text-gray-700">
              {airdropForm.totalAmount && getFinalUserList().length
                ? (
                    parseFloat(airdropForm.totalAmount) /
                    getFinalUserList().length
                  ).toFixed(2)
                : "0"}{" "}
              tokens
            </span>
          </div>
        </div>

        {/* Transaction Status Display */}
        {transactionStatus !== "idle" && (
          <div className="mt-4 p-3 border rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              {transactionStatus === "preparing" && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
              {transactionStatus === "approval-signing" && (
                <div className="w-4 h-4 text-yellow-500">✍️</div>
              )}
              {transactionStatus === "approval-confirming" && (
                <div className="w-4 h-4 text-blue-500">⏳</div>
              )}
              {transactionStatus === "approval-completed" && (
                <div className="w-4 h-4 text-green-500">✅</div>
              )}
              {transactionStatus === "airdrop-signing" && (
                <div className="w-4 h-4 text-yellow-500">✍️</div>
              )}
              {transactionStatus === "airdrop-confirming" && (
                <div className="w-4 h-4 text-blue-500">⏳</div>
              )}
              {transactionStatus === "completed" && (
                <div className="w-4 h-4 text-green-500">✅</div>
              )}
              {transactionStatus === "id-fetch-failed" && (
                <div className="w-4 h-4 text-yellow-500">⚠️</div>
              )}
              {transactionStatus === "error" && (
                <div className="w-4 h-4 text-red-500">❌</div>
              )}

              <span className="text-sm font-medium text-green-600">
                {transactionStatus === "preparing" &&
                  "Preparing Transaction..."}
                {transactionStatus === "approval-signing" &&
                  "Approving Token Spending..."}
                {transactionStatus === "approval-confirming" &&
                  "Confirming Token Approval..."}
                {transactionStatus === "approval-completed" &&
                  "Token Approved! Creating Airdrop..."}
                {transactionStatus === "airdrop-signing" &&
                  "Creating Airdrop..."}
                {transactionStatus === "airdrop-confirming" &&
                  "Confirming Airdrop Creation..."}
                {transactionStatus === "completed" &&
                  "Airdrop Created Successfully!"}
                {transactionStatus === "id-fetch-failed" &&
                  "Airdrop Created (ID Retrieval Failed)"}
                {transactionStatus === "error" && "Transaction Failed"}
              </span>
            </div>

            {/* Progress Message Display */}
            {progressMessage && (
              <div
                className={`text-xs p-3 rounded-md mt-2 ${
                  progressMessage.type === "info"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : progressMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : progressMessage.type === "warning"
                    ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                    : progressMessage.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-gray-50 text-gray-700 border border-gray-200"
                }`}
              >
                <div className="font-medium">{progressMessage.message}</div>
                {progressMessage.details && (
                  <div className="text-xs opacity-75 mt-1">
                    {progressMessage.details}
                  </div>
                )}
              </div>
            )}

            {approvalHash && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-2xl shadow-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-green-600 font-semibold text-xs">
                    ✅ Approval TX:
                  </span>
                </div>
                <div className="text-xs text-gray-700 break-all font-mono bg-white/50 p-2 rounded-lg">
                  {approvalHash}
                </div>
              </div>
            )}

            {transactionHash && (
              <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200/50 rounded-2xl shadow-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-blue-600 font-semibold text-xs">
                    🚀 Airdrop TX:
                  </span>
                </div>
                <div className="text-xs text-gray-700 break-all font-mono bg-white/50 p-2 rounded-lg">
                  {transactionHash}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        <Button
          onClick={handleCreateAirdrop}
          loading={loading}
          disabled={
            transactionStatus === "approval-signing" ||
            transactionStatus === "approval-confirming" ||
            transactionStatus === "airdrop-signing" ||
            transactionStatus === "airdrop-confirming"
          }
          className="w-full"
        >
          {transactionStatus === "preparing" && "Preparing..."}
          {transactionStatus === "approval-signing" && "Approve Token"}
          {transactionStatus === "approval-confirming" &&
            "Confirming Approval..."}
          {transactionStatus === "approval-completed" && "Creating Airdrop..."}
          {transactionStatus === "airdrop-signing" &&
            "Sign Airdrop Transaction"}
          {transactionStatus === "airdrop-confirming" &&
            "Confirming Airdrop..."}
          {transactionStatus === "completed" && "Completed!"}
          {transactionStatus === "error" && "Retry"}
          {transactionStatus === "idle" && "Create Airdrop"}
        </Button>
        <button
          onClick={() => setCurrentStep("airdrop-form")}
          disabled={loading}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors self-center"
        >
          ← Back
        </button>
      </CardFooter>
    </Card>
  );

  const renderCompletion = () => (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>🎉 Airdrop Created!</CardTitle>
        <CardDescription>
          Your airdrop has been successfully created on Mint Club.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactionStatus === "id-fetch-failed" ? (
          // ID fetch failed - show dashboard link instead
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 mb-2">
              ⚠️ Airdrop ID Retrieval Failed
            </p>
            <p className="text-sm text-yellow-700 mb-3">
              Your airdrop was successfully created, but we couldn&apos;t
              retrieve the airdrop ID due to network rate limiting.
            </p>
            <p className="text-sm text-yellow-700 mb-3">
              Please visit the Mint Club creator dashboard to find your airdrop:
            </p>
            <a
              href="https://mint.club/dashboard/airdrops"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
            >
              Go to Creator Dashboard
            </a>
          </div>
        ) : airdropLink ? (
          // Normal success case
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 mb-2">Airdrop Link:</p>
            <a
              href={airdropLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-green-700 break-all hover:underline"
            >
              {airdropLink}
            </a>
          </div>
        ) : null}

        {/* Tip Box */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Copy this airdrop link and paste it in
            Farcaster app to let eligible users claim their tokens directly!
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button
          onClick={copyToClipboard}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-300/50 transform hover:-translate-y-0.5"
        >
          Copy Link
        </Button>
        {transactionStatus === "id-fetch-failed" ? (
          <Button
            onClick={() =>
              window.open("https://mint.club/dashboard/airdrops", "_blank")
            }
            className="flex-1 btn-colorful"
          >
            Go to Dashboard
          </Button>
        ) : (
          (() => {
            const userCount = getFinalUserList().length;
            const perUserAmount =
              airdropForm.totalAmount && userCount
                ? (parseFloat(airdropForm.totalAmount) / userCount).toFixed(5)
                : "0";

            let tokenSymbol = "TOKENS";
            const tokenInfo = PREDEFINED_TOKENS.find(
              (token) =>
                token.address.toLowerCase() ===
                airdropForm.tokenAddress.toLowerCase()
            );
            if (tokenInfo) {
              tokenSymbol = tokenInfo.symbol;
            } else {
              const summaryTokenInfo = PREDEFINED_TOKENS.find(
                (token) => token.address === airdropForm.tokenAddress
              );
              if (summaryTokenInfo) tokenSymbol = summaryTokenInfo.symbol;
            }

            const shareText = `🎉 Just airdropped ${tokenSymbol} to the amazing people who reacted to my cast!\n\n${userCount} casters will earn ${perUserAmount} ${tokenSymbol} each via ${airdropLink}\n\n🚀 Created with dropcast.xyz - the easiest way to reward your Farcaster community!`;

            return (
              <ShareButton
                buttonText="Share"
                className="flex-1 btn-colorful"
                cast={{
                  text: shareText,
                  embeds: [airdropLink!, APP_URL] as [string, string],
                }}
              />
            );
          })()
        )}
      </CardFooter>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "url-input":
        return renderUrlInput();
      case "user-analysis":
        return renderUserAnalysis();
      case "airdrop-form":
        return renderAirdropForm();
      case "summary":
        return renderSummary();
      case "completion":
        return renderCompletion();
      default:
        return renderUrlInput();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50">
      <Header />

      <div className="py-6 px-3">
        <div className="container mx-auto max-w-2xl">
          {renderStepIndicator()}
          {renderCurrentStep()}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl shadow-lg shadow-red-100/50">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
