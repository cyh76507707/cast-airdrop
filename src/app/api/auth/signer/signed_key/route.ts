import { NextResponse } from 'next/server';

const postRequiredFields = ['signerUuid', 'publicKey'];

export async function POST(request: Request) {
  const body = await request.json();

  // Validate required fields
  for (const field of postRequiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      );
    }
  }

  const { signerUuid, publicKey, redirectUrl } = body;

  if (redirectUrl && typeof redirectUrl !== 'string') {
    return NextResponse.json(
      { error: 'redirectUrl must be a string' },
      { status: 400 }
    );
  }

  try {
    // Simple demo implementation
    const signer = {
      signer_uuid: signerUuid,
      public_key: publicKey,
      status: 'approved',
      deadline: Math.floor(Date.now() / 1000) + 86400
    };

    return NextResponse.json(signer);
  } catch (error) {
    console.error('Error registering signed key:', error);
    return NextResponse.json(
      { error: 'Failed to register signed key' },
      { status: 500 }
    );
  }
}
