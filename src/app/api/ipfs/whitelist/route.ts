export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { cid } = searchParams;

    if (!cid) {
      return NextResponse.json(
        { error: 'Invalid cid provided' },
        { status: 400 }
      );
    }

    console.log('Fetching whitelist from IPFS CID:', cid);

    // Build the IPFS URL from the CID
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    
    // Try multiple IPFS gateways
    const gateways = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`
    ];

    let result: Response | null = null;
    let lastError: Error | null = null;

    for (const url of gateways) {
      try {
        console.log('Trying IPFS gateway:', url);
        result = await fetch(url, {
          next: {
            revalidate: Infinity, // IPFS content doesn't change
          },
        });
        
        if (result.ok) {
          console.log('Successfully fetched from:', url);
          break;
        }
      } catch (error) {
        console.log('Failed to fetch from:', url, error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!result || !result.ok) {
      console.error('Failed to fetch from all IPFS gateways:', lastError);
      return NextResponse.json(
        { error: 'Failed to fetch whitelist from IPFS' },
        { status: 500 }
      );
    }

    const whitelist = await result.json();
    console.log('Fetched whitelist:', whitelist);
    
    // Ensure the whitelist is returned as a simple array of addresses
    // This matches mint.club-v2-web's expected format: `0x${string}[]`
    if (Array.isArray(whitelist)) {
      return NextResponse.json(whitelist);
    } else {
      console.error('Invalid whitelist format:', whitelist);
      return NextResponse.json(
        { error: 'Invalid whitelist format' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in IPFS whitelist API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
