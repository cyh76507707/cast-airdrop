import { NextRequest, NextResponse } from 'next/server';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'js-sha3';

export async function POST(request: NextRequest) {
  try {
    const { wallets } = await request.json();
    
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json(
        { error: 'Invalid wallets array' },
        { status: 400 }
      );
    }

    console.log('Generating merkle root for:', wallets.length, 'wallets');
    
    // Sort wallets to ensure consistent ordering
    const sortedWallets = wallets.sort();
    
    // Create leaves (hash each wallet address)
    const leaves = sortedWallets.map(wallet => keccak256(wallet));
    
    // Create merkle tree
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    
    // Get merkle root
    const merkleRoot = '0x' + tree.getRoot().toString('hex');
    
    console.log('Generated merkle root:', merkleRoot);
    
    return NextResponse.json({ 
      success: true, 
      merkleRoot,
      walletCount: wallets.length 
    });
    
  } catch (error) {
    console.error('Error generating merkle root:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to generate merkle root' },
      { status: 500 }
    );
  }
}
