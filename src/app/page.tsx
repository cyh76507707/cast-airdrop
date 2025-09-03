'use client';

import React, { useState, useEffect } from 'react';
import { useFrame } from '~/components/providers/FrameProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/Select';
import { LoadingCard } from '@/components/ui/LoadingSpinner';
import { extractCastHash, getAllCastUsers, getCastByHashOrUrl, transformCastToInfo, CastUser, CastEngagement, CastInfo } from '@/lib/neynar';
import { 
  PREDEFINED_TOKENS, 
  uploadWalletsToIPFS, 
  generateMerkleRoot, 
  createAirdrop, 
  generateAirdropLink,
  TokenInfo,
  TokenBalance,
  getTokenBalance
} from '@/lib/mintclub';
import { sdk } from '@farcaster/miniapp-sdk';
import { Header } from '@/components/Header';
import { WalletInfo } from '@/components/WalletConnect';

type Step = 'url-input' | 'user-analysis' | 'airdrop-form' | 'summary' | 'completion';

interface AirdropForm {
  title: string;
  tokenAddress: string;
  totalAmount: string;
  endTime: string;
}

export default function CastAirdropPage({ title }: { title?: string } = { title: "Cast Airdrop" }) {
  const { isSDKLoaded } = useFrame();

  console.log("🔍 CastAirdropPage render - isSDKLoaded:", isSDKLoaded);

  const [appReady, setAppReady] = useState(false);
  const [currentWallet, setCurrentWallet] = useState<WalletInfo | undefined>();

  // Wallet connection related functions
  const handleWalletConnect = (wallet: WalletInfo) => {
    setCurrentWallet(wallet);
    console.log('Wallet connected:', wallet);
  };

  const handleWalletDisconnect = () => {
    setCurrentWallet(undefined);
    console.log('Wallet disconnected');
  };

  useEffect(() => {
    if (!isSDKLoaded || appReady) return;
    (async () => {
      await sdk.actions.ready();
      setAppReady(true);
    })();
  }, [isSDKLoaded, appReady]);

  // (Removed intermediate loader to keep hook order stable; FrameProvider gates rendering)
  
  const [currentStep, setCurrentStep] = useState<Step>('url-input');
  const [castUrl, setCastUrl] = useState('');
  const [castHash, setCastHash] = useState<string | null>(null);
  const [users, setUsers] = useState<CastUser[]>([]);
  const [engagement, setEngagement] = useState<CastEngagement | null>(null);
  const [castInfo, setCastInfo] = useState<CastInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track completion status for each step
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set(['url-input']));
  const [airdropForm, setAirdropForm] = useState<AirdropForm>({
    title: '',
    tokenAddress: '',
    totalAmount: '',
    endTime: '',
  });
  const [airdropLink, setAirdropLink] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  
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
    if (!currentWallet?.connected) return false;
    if (!airdropForm.tokenAddress || !airdropForm.totalAmount || !airdropForm.endTime) return false;
    
    // Check if user has sufficient balance
    if (tokenBalance && airdropForm.totalAmount) {
      const requiredAmount = parseFloat(airdropForm.totalAmount);
      const userBalance = Number(tokenBalance.formattedBalance);
      return userBalance >= requiredAmount;
    }
    
    return true;
  };

  // TokenBalanceDisplay component
  const TokenBalanceDisplay = React.useCallback(({ 
    tokenAddress, 
    walletAddress, 
    totalAmount, 
    userCount 
  }: { 
    tokenAddress: string; 
    walletAddress: string; 
    totalAmount: string; 
    userCount: number; 
  }) => {
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState<TokenBalance | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const fetchBalance = async () => {
        if (!tokenAddress || tokenAddress === 'custom') return;
        
        setLoading(true);
        setError(null);
        
        try {
          const tokenInfo = PREDEFINED_TOKENS.find(token => token.address === tokenAddress);
          if (tokenInfo) {
            const balanceData = await getTokenBalance(tokenAddress, walletAddress, tokenInfo);
            setBalance(balanceData);
            // Don't update global tokenBalance here to avoid infinite loop
          }
        } catch (err) {
          setError('Failed to fetch token balance');
          console.error('Error fetching token balance:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchBalance();
    }, [tokenAddress, walletAddress]);

    if (loading) {
      return <div className="text-sm text-gray-600">Loading balance...</div>;
    }

    if (error) {
      return <div className="text-sm text-red-600">Error: {error}</div>;
    }

    if (!balance) {
      return <div className="text-sm text-gray-600">Balance not available</div>;
    }

    const requiredAmount = totalAmount ? parseFloat(totalAmount) : 0;
    const userBalance = Number(balance.formattedBalance);
    const hasSufficientBalance = requiredAmount > 0 && userBalance >= requiredAmount;

    return (
      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Your Balance:</span>
          <span className="font-semibold text-gray-900">{balance.formattedBalance} {balance.token.symbol}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Required Amount:</span>
          <span className="font-semibold text-gray-900">{requiredAmount} {balance.token.symbol}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700 font-medium">Per User:</span>
          <span className="font-semibold text-gray-900">
            {userCount > 0 ? (requiredAmount / userCount).toFixed(4) : '0'} {balance.token.symbol}
          </span>
        </div>
        
        {!hasSufficientBalance && requiredAmount > 0 && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            ⚠️ Insufficient balance. You need {(requiredAmount - userBalance).toFixed(4)} more {balance.token.symbol}
          </div>
        )}
      </div>
    );
  }, []);

  // SDK initialization is handled only in FrameProvider (same pattern as Clap)

  // Keep splash visible until app is ready to display
  if (!appReady) {
    return null;
  }

    // Show wallet connection requirement message if wallet is not connected
  const showWalletRequirement = !currentWallet?.connected && currentStep === 'airdrop-form';

  const handleUrlSubmit = async () => {
    if (!castUrl.trim()) {
      setError('Please enter a valid Farcaster post URL');
      return;
    }

    // Basic URL format validation
    if (!castUrl.includes('farcaster.xyz') && !castUrl.includes('warpcast.com')) {
      setError('Please enter a valid Farcaster post URL');
      return;
    }

    // Continue button always loads new data (refresh)
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Starting analysis for URL:', castUrl);
      
      // Get Cast info and user data at once
      const engagementData = await getAllCastUsers(castUrl);
      const castData = await getCastByHashOrUrl(castUrl, 'url');
      const castInfoData = transformCastToInfo(castData);
      
      setEngagement(engagementData);
      setCastInfo(castInfoData);
      setUsers(engagementData.totalUsers);
      setCastHash(castUrl);
      
      // Reset Airdrop Whitelist state for new data
      setSelectedActions({
        likes: true,
        recasts: true,
        quotes: true,
        comments: true,
      });
      setExcludedUsers(new Set());
      
      // Mark step 2 as completed
      setCompletedSteps(prev => new Set([...prev, 'user-analysis']));
      
      console.log('✅ Analysis completed:', {
        totalUsers: engagementData.totalUsers.length,
        likes: engagementData.likes.length,
        recasts: engagementData.recasts.length,
        quotes: engagementData.quotes.length,
        comments: engagementData.comments.length
      });
    } catch (err) {
      console.error('❌ Error in handleUrlSubmit:', err);
      setError('Failed to analyze the post. Please try again.');
    } finally {
      setLoading(false);
    }
    
    setCurrentStep('user-analysis');
  };



  const handleAirdropFormSubmit = () => {
    if (!airdropForm.tokenAddress || !airdropForm.totalAmount || !airdropForm.endTime) {
      setError('Please fill in all required fields');
      return;
    }

          // Set auto-generated title
    const autoGeneratedTitle = generateAirdropTitle();
    setAirdropForm(prev => ({ ...prev, title: autoGeneratedTitle }));

    setCompletedSteps(prev => new Set([...prev, 'airdrop-form']));
    setCurrentStep('summary');
  };



  // Airdrop Whitelist related functions
  const getFinalUserList = () => {
    const finalUsers: CastUser[] = [];
    
    if (selectedActions.likes) {
      finalUsers.push(...engagement!.likes);
    }
    if (selectedActions.recasts) {
      finalUsers.push(...engagement!.recasts);
    }
    if (selectedActions.quotes) {
      finalUsers.push(...engagement!.quotes);
    }
    if (selectedActions.comments) {
      finalUsers.push(...engagement!.comments);
    }
    
          // Remove duplicates and filter excluded users
    const uniqueUsers = finalUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.fid === user.fid) && 
      !excludedUsers.has(user.fid.toString())
    );
    
    return uniqueUsers;
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
    window.open(`https://warpcast.com/${username}`, '_blank');
  };

  // Auto-generate title function
  const generateAirdropTitle = () => {
    if (!castInfo || !selectedActions) return 'Community Airdrop';
    
    const authorName = castInfo.author.displayName || castInfo.author.username;
    const castHash = castInfo.hash.substring(0, 10); // Use only first 10 characters of hash
    
          // Check selected actions
    const selectedActionTypes = [];
    if (selectedActions.likes) selectedActionTypes.push('Like');
    if (selectedActions.recasts) selectedActionTypes.push('Recast');
    if (selectedActions.quotes) selectedActionTypes.push('Quote');
    if (selectedActions.comments) selectedActionTypes.push('Comment');
    
          // Generate title based on action types
    let baseTitle;
    if (selectedActionTypes.length === 0) {
      baseTitle = `${authorName}'s Community Airdrop`;
    } else if (selectedActionTypes.length === 1) {
      baseTitle = `${authorName}'s ${selectedActionTypes[0]} Community Airdrop`;
    } else if (selectedActionTypes.length === 2) {
      baseTitle = `${authorName}'s ${selectedActionTypes[0]} & ${selectedActionTypes[1]} Community Airdrop`;
    } else if (selectedActionTypes.length === 3) {
      baseTitle = `${authorName}'s ${selectedActionTypes[0]}, ${selectedActionTypes[1]} & ${selectedActionTypes[2]} Community Airdrop`;
    } else {
      baseTitle = `${authorName}'s Engagement Community Airdrop`;
    }
    
    return `${baseTitle} (cast: ${castHash})`;
  };

  const handleCreateAirdrop = async () => {
    if (!users.length) {
      setError('No eligible users found');
      return;
    }

    if (!currentWallet?.connected) {
      setError('Wallet is not connected. Please connect your wallet.');
      return;
    }

    setCompletedSteps(prev => new Set([...prev, 'summary']));
    setLoading(true);
    setError(null);

    try {
      // Filter users based on action type (simplified for demo)
      const eligibleUsers = users;
      const walletAddresses = eligibleUsers.map(user => user.walletAddress);

      // Calculate amount per claim
      const totalAmount = parseFloat(airdropForm.totalAmount);
      const amountPerClaim = BigInt(Math.floor((totalAmount / eligibleUsers.length) * 1e18));

      // Generate merkle root and upload to IPFS
      const merkleRoot = await generateMerkleRoot(walletAddresses);
      const ipfsCID = await uploadWalletsToIPFS(walletAddresses, process.env.NEXT_PUBLIC_IPFS_API_KEY || '');

      // Create airdrop
      const endTime = Math.floor(new Date(airdropForm.endTime).getTime() / 1000);
      const startTime = Math.floor(Date.now() / 1000);

      const receipt = await createAirdrop({
        title: airdropForm.title,
        token: airdropForm.tokenAddress as `0x${string}`,
        isERC20: true,
        amountPerClaim,
        walletCount: eligibleUsers.length,
        startTime,
        endTime,
        merkleRoot,
        ipfsCID,
      });

      // Generate airdrop link (in real implementation, you'd extract airdrop ID from receipt)
      const airdropId = Math.floor(Math.random() * 10000); // Placeholder
      const link = generateAirdropLink(airdropId);
      setAirdropLink(link);
      setCompletedSteps(prev => new Set([...prev, 'completion']));
      setCurrentStep('completion');
    } catch (err) {
      setError('Failed to create airdrop. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (airdropLink) {
      try {
        await navigator.clipboard.writeText(airdropLink);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard');
      }
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'url-input', label: 'Post URL' },
      { key: 'user-analysis', label: 'Analyze Users' },
      { key: 'airdrop-form', label: 'Configure Airdrop' },
      { key: 'summary', label: 'Review' },
      { key: 'completion', label: 'Complete' },
    ];

    return (
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(step.key as Step);
            const isCurrent = currentStep === step.key;
            
            return (
              <React.Fragment key={step.key}>
                <div 
                  className={cn(
                    'flex flex-col items-center transition-colors',
                    isCompleted ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'
                  )}
                  onClick={() => {
                    if (isCompleted) {
                      setCurrentStep(step.key as Step);
                    }
                  }}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {index + 1}
                  </div>
                  {/* Show title for current step only, numbers for others */}
                  {isCurrent ? (
                    <span className="mt-1 text-xs sm:text-sm font-medium text-gray-700 text-center max-w-16 sm:max-w-20">
                      {step.label}
                    </span>
                  ) : (
                    <span className="mt-1 text-xs text-gray-400 text-center max-w-8">
                      {index + 1}
                    </span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-4 sm:w-8 h-0.5 bg-gray-300" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUrlInput = () => (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Enter Farcaster Post URL</CardTitle>
        <CardDescription>
          Paste the URL of the Farcaster post you want to create an airdrop for.
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
  );

  const renderUserAnalysis = () => {
    if (loading) {
      return <LoadingCard message="Analyzing users who engaged with this post..." />;
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
      if (users.length === 0) return 'None';
      if (users.length <= maxShow) {
        return users.map(u => u.username).join(', ');
      }
      return `${users.slice(0, maxShow).map(u => u.username).join(', ')}, and ${users.length - maxShow} others`;
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Cast Information */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.open(castUrl, '_blank')}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              <img 
                src={castInfo.author.pfpUrl || '/default-avatar.png'} 
                alt={castInfo.author.displayName}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium text-gray-900">{castInfo.author.displayName}</span>
                  <span className="text-gray-500">@{castInfo.author.username}</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {castInfo.text.length > 150 
                    ? `${castInfo.text.substring(0, 150)}...` 
                    : castInfo.text
                  }
                </p>
                {castInfo.embeds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {castInfo.embeds.slice(0, 2).map((embed, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        {embed.url && (
                          <span className="text-blue-600 truncate block max-w-[200px]">
                            {embed.url.includes('stream.farcaster.xyz') ? '📹 Video' : '🔗 Link'}
                          </span>
                        )}
                      </div>
                    ))}
                    {castInfo.embeds.length > 2 && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                        +{castInfo.embeds.length - 2} more
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Click to view full post →
                  </span>
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>❤️ {engagement.likes.length}</span>
                    <span>🔄 {engagement.recasts.length}</span>
                    <span>💬 {engagement.quotes.length}</span>
                    <span>💭 {engagement.comments.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Summary</CardTitle>
            <CardDescription>
              Found {users.length} unique users who engaged with this post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium text-green-800">❤️ Like</span>
                <span className="text-green-700">{formatUserList(engagement.likes)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-800">🔄 Recast</span>
                <span className="text-blue-700">{formatUserList(engagement.recasts)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="font-medium text-purple-800">💬 Quote</span>
                <span className="text-purple-700">{formatUserList(engagement.quotes)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="font-medium text-orange-800">💭 Comment</span>
                <span className="text-orange-700">{formatUserList(engagement.comments)}</span>
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
          <CardContent className="space-y-6">
            {/* Action Selection */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Include Users Who:</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.likes}
                    onChange={(e) => setSelectedActions({ ...selectedActions, likes: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">❤️ Liked the post ({engagement.likes.length} users)</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.recasts}
                    onChange={(e) => setSelectedActions({ ...selectedActions, recasts: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">🔄 Recasted the post ({engagement.recasts.length} users)</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.quotes}
                    onChange={(e) => setSelectedActions({ ...selectedActions, quotes: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">💬 Quoted the post ({engagement.quotes.length} users)</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedActions.comments}
                    onChange={(e) => setSelectedActions({ ...selectedActions, comments: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">💭 Commented on the post ({engagement.comments.length} users)</span>
                </label>
              </div>
            </div>

            {/* Final User List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Final User List ({getFinalUserList().length} users)
              </h4>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                {getFinalUserList().length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No users selected. Please check at least one action type above.
                  </p>
                ) : (
                  getFinalUserList().map((user) => (
                    <div key={user.fid} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={!excludedUsers.has(user.fid.toString())}
                        onChange={() => toggleUserExclusion(user.fid)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <img
                        src={user.pfpUrl || '/default-avatar.png'}
                        alt={user.username}
                        className="w-8 h-8 rounded-full"
                      />
                      <span 
                        className="text-sm text-gray-700 cursor-pointer hover:text-blue-600"
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
              setCompletedSteps(prev => new Set([...prev, 'airdrop-form']));
              setCurrentStep('airdrop-form');
            }} 
            className="px-8 py-3 text-lg"
            disabled={getFinalUserList().length === 0}
          >
            Make Airdrop for them ({getFinalUserList().length} users)
          </Button>
        </div>
      </div>
    );
  };

  const renderAirdropForm = () => {
    // Check if wallet is connected
    if (!currentWallet?.connected) {
      return (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Wallet Connection Required</CardTitle>
            <CardDescription>
              You need to connect your wallet to configure the airdrop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Please connect your wallet using the "Connect Wallet" button in the header.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Refresh Page
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return (
      <Card className="max-w-md mx-auto">
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
              ...PREDEFINED_TOKENS.map(token => ({
                value: token.address,
                label: `${token.name} (${token.symbol})`
              })),
              { value: 'custom', label: 'Custom Token Address' }
            ]}
            value={airdropForm.tokenAddress}
            onChange={(e) => setAirdropForm({ ...airdropForm, tokenAddress: e.target.value })}
            placeholder="Select a token"
          />
          
          {/* Display selected token information and balance */}
          {airdropForm.tokenAddress && airdropForm.tokenAddress !== 'custom' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Selected: {PREDEFINED_TOKENS.find(token => token.address === airdropForm.tokenAddress)?.name || 'Unknown Token'}
              </p>
              <TokenBalanceDisplay 
                tokenAddress={airdropForm.tokenAddress}
                walletAddress={currentWallet.address}
                totalAmount={airdropForm.totalAmount}
                userCount={users.length}
              />
            </div>
          )}

          {airdropForm.tokenAddress === 'custom' && (
            <Input
              label="Custom Token Address"
              placeholder="0x..."
              onChange={(e) => setAirdropForm({ ...airdropForm, tokenAddress: e.target.value })}
            />
          )}

          <Input
            label="Total Amount"
            type="number"
            placeholder="1000"
            value={airdropForm.totalAmount}
            onChange={(e) => setAirdropForm({ ...airdropForm, totalAmount: e.target.value })}
            helperText={`Each user will receive ${airdropForm.totalAmount && users.length ? (parseFloat(airdropForm.totalAmount) / users.length).toFixed(2) : '0'} tokens`}
          />

          <Input
            label="End Date"
            type="datetime-local"
            value={airdropForm.endTime}
            onChange={(e) => setAirdropForm({ ...airdropForm, endTime: e.target.value })}
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
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Review Airdrop</CardTitle>
        <CardDescription>
          Please review your airdrop configuration before creating.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Title:</span>
            <span className="text-sm font-medium">{airdropForm.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Token:</span>
            <span className="text-sm font-medium">{airdropForm.tokenAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Amount:</span>
            <span className="text-sm font-medium">{airdropForm.totalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Users:</span>
            <span className="text-sm font-medium">{users.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Per User:</span>
            <span className="text-sm font-medium">
              {airdropForm.totalAmount && users.length 
                ? (parseFloat(airdropForm.totalAmount) / users.length).toFixed(2) 
                : '0'} tokens
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep('airdrop-form')}
          className="flex-1"
        >
          Back
        </Button>
        <Button 
          onClick={handleCreateAirdrop}
          loading={loading}
          className="flex-1"
        >
          Create Airdrop
        </Button>
      </CardFooter>
    </Card>
  );

  const renderCompletion = () => (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>🎉 Airdrop Created!</CardTitle>
        <CardDescription>
          Your airdrop has been successfully created on Mint Club.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {airdropLink && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 mb-2">Airdrop Link:</p>
            <p className="text-sm font-mono text-green-700 break-all">{airdropLink}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex space-x-2">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep('url-input')}
          className="flex-1"
        >
          Create Another
        </Button>
        <Button 
          onClick={copyToClipboard}
          className="flex-1"
        >
          Copy Link
        </Button>
      </CardFooter>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'url-input':
        return renderUrlInput();
      case 'user-analysis':
        return renderUserAnalysis();
      case 'airdrop-form':
        return renderAirdropForm();
      case 'summary':
        return renderSummary();
      case 'completion':
        return renderCompletion();
      default:
        return renderUrlInput();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        currentWallet={currentWallet}
        onWalletConnect={handleWalletConnect}
        onWalletDisconnect={handleWalletDisconnect}
      />
      
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cast Airdrop</h1>
            <p className="text-gray-600">Create airdrops for users who engage with your Farcaster posts</p>
          </div>



        {renderStepIndicator()}
        {renderCurrentStep()}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
