import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const message = searchParams.get('message');
    const signature = searchParams.get('signature');

    if (!message || !signature) {
      return NextResponse.json(
        { error: 'Message and signature are required' },
        { status: 400 }
      );
    }

    // Simple demo implementation
    return NextResponse.json({
      signers: [],
      user: null,
    });
  } catch (error) {
    console.error('Error in session-signers API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signers' },
      { status: 500 }
    );
  }
}
