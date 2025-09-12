import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');
  const address = searchParams.get('address');
  const source = searchParams.get('source'); // 'hunt' or undefined

  if (!chainId || !address) {
    return NextResponse.json({ error: 'Missing chainId or address' }, { status: 400 });
  }

  try {
    // If source is 'hunt', only try fc.hunt.town API
    if (source === 'hunt') {
      const huntTownUrl = `https://fc.hunt.town/tokens/logo/${chainId}/${address}/image`;
      const response = await fetch(huntTownUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DropCast/1.0)',
        },
      });

      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';
        
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
      
      return NextResponse.json({ error: 'Hunt.town logo not found' }, { status: 404 });
    }

    // Default behavior: try both sources
    // Try fc.hunt.town API first
    const huntTownUrl = `https://fc.hunt.town/tokens/logo/${chainId}/${address}/image`;
    const huntResponse = await fetch(huntTownUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DropCast/1.0)',
      },
    });

    if (huntResponse.ok) {
      const imageBuffer = await huntResponse.arrayBuffer();
      const contentType = huntResponse.headers.get('content-type') || 'image/png';
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fallback to Mint.club API
    const mintClubUrl = `https://mint.club/api/tokens/logo?chainId=${chainId}&address=${address}`;
    const mintClubResponse = await fetch(mintClubUrl);

    if (mintClubResponse.ok) {
      const imageBuffer = await mintClubResponse.arrayBuffer();
      const contentType = mintClubResponse.headers.get('content-type') || 'image/png';
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching token logo:', error);
    return NextResponse.json({ error: 'Failed to fetch logo' }, { status: 500 });
  }
}
