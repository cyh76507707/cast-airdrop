import { MerkleTree } from "merkletreejs";
import { NextRequest, NextResponse } from "next/server";
import { getAddress, keccak256 } from "viem";

export async function POST(request: NextRequest) {
  try {
    const { wallets } = await request.json();

    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json(
        { error: "Invalid wallets array" },
        { status: 400 }
      );
    }

    // IMPORTANT: Do NOT sort. Mint.club builds leaves in the original input order.
    // Sorting here would produce a different root than the one reconstructed from the uploaded file.

    // Create leaves (hash each wallet address using getAddress for checksum format)
    // This matches mint.club-v2-web's approach exactly
    const leaves = wallets.map((wallet) => keccak256(getAddress(wallet)));

    // Create merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

    // Get merkle root
    const merkleRoot = "0x" + tree.getRoot().toString("hex");

    console.log("Generated merkle root:", merkleRoot);

    return NextResponse.json({
      success: true,
      merkleRoot,
      walletCount: wallets.length,
    });
  } catch (error) {
    console.error("Error generating merkle root:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to generate merkle root" },
      { status: 500 }
    );
  }
}
