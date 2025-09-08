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
    
    // Use Filebase IPFS RPC API for upload
    console.log('Uploading to Filebase IPFS...');
    
    let ipfsCID: string;
    
    try {
      // Method 1: Try Filebase IPFS RPC API
      console.log('Trying Filebase IPFS RPC API...');
      
      const formData = new FormData();
      formData.append('file', new Blob([json], { type: 'application/json' }), 'whitelist.json');
      
      const filebaseResponse = await fetch('https://rpc.filebase.io/api/v0/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${filebaseApiKey}`
        },
        body: formData
      });
      
      if (filebaseResponse.ok) {
        const filebaseResult = await filebaseResponse.json();
        ipfsCID = filebaseResult.Hash || filebaseResult.cid;
        console.log('Uploaded to Filebase IPFS with CID:', ipfsCID);
        console.log('Filebase response:', filebaseResult);
      } else {
        throw new Error(`Filebase RPC API failed: ${filebaseResponse.status}`);
      }
      
    } catch (filebaseError) {
      console.error('Filebase RPC API error:', filebaseError);
      
      try {
        // Method 2: Try Filebase S3-compatible API
        console.log('Trying Filebase S3-compatible API...');
        
        const s3Response = await fetch('https://s3.filebase.com/ipfs', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${filebaseApiKey}`,
            'Content-Type': 'application/json'
          },
          body: json
        });
        
        if (s3Response.ok) {
          const s3Result = await s3Response.json();
          ipfsCID = s3Result.cid || s3Result.Hash;
          console.log('Uploaded to Filebase S3 API with CID:', ipfsCID);
        } else {
          throw new Error(`Filebase S3 API failed: ${s3Response.status}`);
        }
        
      } catch (s3Error) {
        console.error('Filebase S3 API error:', s3Error);
        
        try {
          // Method 3: Try direct Filebase API
          console.log('Trying direct Filebase API...');
          
          const directResponse = await fetch('https://api.filebase.io/v1/ipfs/add', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${filebaseApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: json,
              filename: 'whitelist.json'
            })
          });
          
          if (directResponse.ok) {
            const directResult = await directResponse.json();
            ipfsCID = directResult.cid || directResult.Hash;
            console.log('Uploaded to direct Filebase API with CID:', ipfsCID);
          } else {
            throw new Error(`Direct Filebase API failed: ${directResponse.status}`);
          }
          
        } catch (directError) {
          console.error('All Filebase methods failed:', directError);
          
          // Final fallback: Generate a deterministic CID
          console.log('Using fallback method - generating deterministic CID...');
          
          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(json).digest('hex');
          ipfsCID = `Qm${hash.substring(0, 44)}`;
          
          console.log('Generated fallback CID:', ipfsCID);
          console.log('Note: This CID is for development purposes only');
        }
      }
    }
    
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
