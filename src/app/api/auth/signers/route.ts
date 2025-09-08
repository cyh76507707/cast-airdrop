import { NextResponse } from 'next/server';

const requiredParams = ['message', 'signature'];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | null> = {};
  for (const param of requiredParams) {
    params[param] = searchParams.get(param);
    if (!params[param]) {
      return NextResponse.json(
        {
          error: `${param} parameter is required`,
        },
        { status: 400 }
      );
    }
  }

  const _message = params.message as string;
  const _signature = params.signature as string;

  try {
    // Simple demo implementation
    return NextResponse.json({
      signers: [],
    });
  } catch (error) {
    console.error('Error fetching signers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signers' },
      { status: 500 }
    );
  }
}
