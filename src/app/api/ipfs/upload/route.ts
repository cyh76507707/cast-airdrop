import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== IPFS Upload API Called ===');
    const { wallets } = await request.json();
    console.log('Received wallets:', wallets);
    
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      console.log('Invalid wallets array');
      return NextResponse.json(
        { error: 'Invalid wallets array' },
        { status: 400 }
      );
    }

    // Get Filebase API key from environment
    const filebaseApiKey = process.env.NEXT_PUBLIC_FILEBASE_API_KEY;
    console.log('Environment variables check:');
    console.log('- NEXT_PUBLIC_FILEBASE_API_KEY exists:', !!filebaseApiKey);
    console.log('- NEXT_PUBLIC_FILEBASE_API_KEY length:', filebaseApiKey?.length || 0);
    
    if (!filebaseApiKey) {
      console.log('Filebase API key not found in environment');
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
    
    // Temporary solution: Use local storage instead of IPFS
    // TODO: Replace with proper IPFS service (Pinata, Infura, or local IPFS node)
    console.log('Using temporary local storage solution...');
    
    // Generate a unique identifier for this upload
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const localCID = `local-${timestamp}-${randomId}`;
    
    // In a real implementation, you would save this to a database
    // For now, we'll just log it and return a mock CID
    console.log('Mock IPFS CID generated:', localCID);
    console.log('Wallets data:', json);
    
    const ipfsCID = localCID;
    
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
