import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - @filebase/client doesn't have type declarations
import { FilebaseClient } from '@filebase/client';

export async function POST(request: NextRequest) {
  try {
    console.log('=== IPFS Upload API Called ===');
    
    // Check if request is FormData (matching mint.club-v2-web format)
    const contentType = request.headers.get('content-type');
    let wallets: string[];
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData format (matching mint.club-v2-web)
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided in FormData' },
          { status: 400 }
        );
      }
      
      const fileContent = await file.text();
      wallets = JSON.parse(fileContent);
      console.log('Received wallets from FormData:', wallets);
    } else {
      // Handle JSON format (backward compatibility)
      const { wallets: walletsFromJson } = await request.json();
      wallets = walletsFromJson;
      console.log('Received wallets from JSON:', wallets);
    }
    
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      console.log('Invalid wallets array');
      return NextResponse.json(
        { error: 'Invalid wallets array' },
        { status: 400 }
      );
    }

    // Get Filebase API key from environment (same as mint.club-v2-web)
    const filebaseApiKey = process.env.FILEBASE_API_KEY;
    console.log('Environment variables check:');
    console.log('- FILEBASE_API_KEY exists:', !!filebaseApiKey);
    console.log('- FILEBASE_API_KEY length:', filebaseApiKey?.length || 0);
    
    if (!filebaseApiKey) {
      console.log('Filebase API key not found in environment');
      return NextResponse.json(
        { error: 'Filebase API key not configured' },
        { status: 500 }
      );
    }
    
    console.log('Filebase API key found:', filebaseApiKey.substring(0, 20) + '...');

    console.log('Uploading wallets to IPFS using Filebase client:', wallets.length, 'wallets');
    
    // Convert wallets to JSON string (matching mint.club-v2-web format)
    const json = JSON.stringify(wallets, null, 2);
    const blob = new Blob([json]);
    
    // Create Filebase client (same as mint.club-v2-web)
    // Note: Make sure you're using the SECRET KEY, not API KEY
    const client = new FilebaseClient({ token: filebaseApiKey });
    
    // Upload to IPFS using Filebase client
    console.log('Uploading to IPFS using Filebase client...');
    const ipfsCID = await client.storeBlob(blob);
    
    console.log('Uploaded to IPFS with CID:', ipfsCID);
    console.log('IPFS URL: https://ipfs.io/ipfs/' + ipfsCID);
    
    return NextResponse.json({ 
      success: true, 
      hash: ipfsCID,  // mint.club-v2-web expects 'hash' field
      ipfsCID,       // keep for backward compatibility
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
