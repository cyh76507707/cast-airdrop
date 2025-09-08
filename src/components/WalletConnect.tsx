"use client";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useState } from "react";

// Type guard for MetaMask
const isEthereumAvailable = (): boolean => {
  return typeof window !== "undefined" && "ethereum" in window;
};

export interface WalletInfo {
  address: string;
  type: "farcaster" | "metamask";
  connected: boolean;
}

interface WalletConnectProps {
  onWalletConnect: (wallet: WalletInfo) => void;
  onWalletDisconnect: () => void;
  currentWallet?: WalletInfo;
}

export function WalletConnect({
  onWalletConnect,
  onWalletDisconnect,
  currentWallet,
}: WalletConnectProps) {
  const [isInFrame, setIsInFrame] = useState(false);
  const [isMetamaskAvailable, setIsMetamaskAvailable] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Check if we're in a Farcaster frame
    const checkFrame = async () => {
      try {
        // Check if we're in a Farcaster frame by trying to access frame-specific APIs
        if (
          typeof window !== "undefined" &&
          window.location.href.includes("farcaster.xyz")
        ) {
          setIsInFrame(true);
        } else {
          const frame = await sdk.actions.ready();
          setIsInFrame(true);
        }
      } catch (error) {
        // If SDK fails to initialize, we're likely not in a frame
        setIsInFrame(false);
      }
    };

    // Check if MetaMask is available
    const checkMetamask = () => {
      setIsMetamaskAvailable(isEthereumAvailable());
    };

    checkFrame();
    checkMetamask();
  }, []);

  const connectFarcasterWallet = async () => {
    if (!isInFrame) {
      alert("Farcaster wallet can only be used within the Farcaster app.");
      return;
    }

    setConnecting(true);
    try {
      // Try to get user info from Farcaster frame
      await sdk.actions.ready();

      // Get actual user address from Farcaster frame
      // For now, we'll use MetaMask as fallback since Farcaster frame doesn't provide direct wallet access
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        if (accounts && accounts.length > 0) {
          const walletInfo: WalletInfo = {
            address: accounts[0],
            type: "farcaster",
            connected: true,
          };
          onWalletConnect(walletInfo);
        } else {
          throw new Error("No accounts found");
        }
      } else {
        throw new Error("No wallet provider found");
      }
    } catch (error: unknown) {
      console.error("Failed to connect Farcaster wallet:", error);
      alert("Failed to connect Farcaster wallet. Please use MetaMask instead.");
    } finally {
      setConnecting(false);
    }
  };

  const connectMetamaskWallet = async () => {
    if (!isMetamaskAvailable) {
      alert("MetaMask is not installed. Please install MetaMask.");
      return;
    }

    setConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        const walletInfo: WalletInfo = {
          address: accounts[0],
          type: "metamask",
          connected: true,
        };
        onWalletConnect(walletInfo);
      }
    } catch (error: unknown) {
      console.error("Failed to connect MetaMask:", error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 4001
      ) {
        alert("User rejected the connection.");
      } else {
        alert("Failed to connect MetaMask.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    onWalletDisconnect();
  };

  if (currentWallet?.connected) {
    return (
      <Card className="max-w-md mx-auto mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>✅ Wallet Connected</span>
          </CardTitle>
          <CardDescription>
            {currentWallet.type === "farcaster"
              ? "Farcaster wallet"
              : "MetaMask"}{" "}
            is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Address:</strong>{" "}
                {currentWallet.address.substring(0, 6)}...
                {currentWallet.address.substring(-4)}
              </p>
              <p className="text-sm text-green-700">
                <strong>Type:</strong>{" "}
                {currentWallet.type === "farcaster" ? "Farcaster" : "MetaMask"}
              </p>
            </div>
            <Button
              onClick={disconnectWallet}
              variant="outline"
              className="w-full"
            >
              Disconnect Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto mb-6">
      <CardHeader>
        <CardTitle>Connect Wallet</CardTitle>
        <CardDescription>
          Please connect your wallet to create an airdrop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Button
            onClick={connectFarcasterWallet}
            disabled={!isInFrame || connecting}
            loading={connecting}
            className="w-full h-12 text-base"
            variant={isInFrame ? "default" : "outline"}
          >
            {isInFrame
              ? "🔗 Connect Farcaster Wallet"
              : "❌ Only available in Farcaster app"}
          </Button>

          <Button
            onClick={connectMetamaskWallet}
            disabled={!isMetamaskAvailable || connecting}
            loading={connecting}
            className="w-full h-12 text-base"
            variant={isMetamaskAvailable ? "default" : "outline"}
          >
            {isMetamaskAvailable
              ? "🦊 Connect MetaMask Wallet"
              : "❌ MetaMask installation required"}
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Farcaster wallet: Only available within Farcaster app</p>
          <p>• MetaMask: Available in all browsers</p>
        </div>
      </CardContent>
    </Card>
  );
}
