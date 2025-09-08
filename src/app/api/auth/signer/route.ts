import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Simple demo implementation
    const signer = {
      signer_uuid: Math.random().toString(36).substring(2, 15),
      public_key: '0x' + Math.random().toString(16).substring(2, 66),
      status: 'pending_approval'
    };
    return NextResponse.json(signer);
  } catch (error) {
    console.error('Error fetching signer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signer' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const signerUuid = searchParams.get('signerUuid');

  if (!signerUuid) {
    return NextResponse.json(
      { error: 'signerUuid is required' },
      { status: 400 }
    );
  }

  try {
    // Simple demo implementation
    const signer = {
      signer_uuid: signerUuid,
      public_key: '0x' + Math.random().toString(16).substring(2, 66),
      status: 'approved'
    };
    return NextResponse.json(signer);
  } catch (error) {
    console.error('Error fetching signed key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signed key' },
      { status: 500 }
    );
  }
}
