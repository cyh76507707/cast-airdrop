import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple nonce generation for demo purposes
    const nonce = Math.random().toString(36).substring(2, 15);
    return NextResponse.json({ nonce });
  } catch (error) {
    console.error('Error fetching nonce:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nonce' },
      { status: 500 }
    );
  }
}
