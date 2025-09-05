import { NextRequest, NextResponse } from 'next/server';
import { mintclub } from 'mint.club-v2-sdk';

export async function POST(request: NextRequest) {
  try {
    const { wallets } = await request.json();
    
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json(
        { error: 'Invalid wallets array' },
        { status: 400 }
      );
    }

    // Get Filebase API key from environment
    const filebaseApiKey = process.env.NEXT_PUBLIC_FILEBASE_API_KEY;
    
    if (!filebaseApiKey) {
      return NextResponse.json(
        { error: 'Filebase API key not configured' },
        { status: 500 }
      );
    }
    
    console.log('Filebase API key found:', filebaseApiKey.substring(0, 20) + '...');

    console.log('Uploading wallets to IPFS:', wallets.length, 'wallets');
    
    // Convert wallets to JSON string
    const json = JSON.stringify(wallets, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    // Upload to IPFS using Mint.club SDK
    const ipfsCID = await mintclub.ipfs.add(filebaseApiKey, blob);
    
    console.log('Uploaded to IPFS with CID:', ipfsCID);
    
    return NextResponse.json({ 
      success: true, 
      ipfsCID,
      walletCount: wallets.length 
    });
    
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to upload to IPFS' },
      { status: 500 }
    );
  }
}
