const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || 'NEYNAR_DEMO_KEY';

// Neynar client 생성 함수
export function getNeynarClient() {
  return {
    apiKey: NEYNAR_API_KEY,
    baseUrl: 'https://api.neynar.com'
  };
}

// 사용자 정보 가져오기
export async function getNeynarUser(fid: number) {
  const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
    headers: {
      'x-api-key': NEYNAR_API_KEY,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  
  const data = await response.json();
  return data.users?.[0] || null;
}

// username -> user (for search)
export async function getNeynarUserByUsername(username: string) {
  const headers = { 'x-api-key': NEYNAR_API_KEY } as Record<string, string>;
  const uname = username.replace(/^@/, '').trim();
  if (!uname) return null;

  // Preferred: by_username endpoint
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(
        uname
      )}`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      const user = data?.user || data?.result?.user || data;
      if (user) return user;
    } else {
      console.warn('getNeynarUserByUsername non-OK:', res.status, res.statusText);
    }
  } catch (e) {
    console.warn('getNeynarUserByUsername error(by_username):', e);
  }

  // Fallback: search API
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/users/search?q=${encodeURIComponent(
        uname
      )}&limit=1`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      const user = data?.result?.users?.[0] || data?.users?.[0];
      if (user) return user;
    } else {
      console.warn('getNeynarUserByUsername non-OK(search):', res.status, res.statusText);
    }
  } catch (e) {
    console.warn('getNeynarUserByUsername error(search):', e);
  }

  return null;
}

// 최근 캐스트 10개 가져오기 (엔드포인트 폴백 포함)
export async function getRecentCastsByFid(
  fid: number,
  limit = 10,
  viewerFid?: number
) {
  const headers = { 'x-api-key': NEYNAR_API_KEY } as Record<string, string>;

  // Correct v2 endpoint (per Neynar docs): /v2/farcaster/feed/user/casts
  const base = `https://api.neynar.com/v2/farcaster/feed/user/casts`;
  const url = `${base}?fid=${fid}&limit=${limit}&include_replies=true${
    viewerFid ? `&viewer_fid=${viewerFid}` : ''
  }`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn('getRecentCastsByFid non-OK:', res.status, res.statusText);
      try {
        const text = await res.text();
        console.warn('Response body:', text);
      } catch {}
      return [];
    }
    const data = await res.json();

    const casts = (data?.result?.casts || data?.casts || []) as any[];
    return casts.map((c: any) => ({
      hash: c.hash,
      text: c.text || '',
      timestamp: c.timestamp,
    }));
  } catch (e) {
    console.warn('getRecentCastsByFid error:', e);
    return [] as Array<{ hash: string; text: string; timestamp?: string }>;
  }
}

// 미니앱 알림 전송
export async function sendNeynarMiniAppNotification(params: { fid: number; title: string; body: string }) {
  // 실제 구현에서는 Neynar의 알림 API를 사용해야 합니다
  console.log(`Sending notification to FID ${params.fid}: ${params.title} - ${params.body}`);
  return { state: "success" as const };
}

export interface CastUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  walletAddress: string;
}

export interface CastReaction {
  fid: number;
  fname: string;
  displayName: string;
  pfp: string;
  verifiedAddresses: {
    primary: {
      eth_address: string;
    };
  };
}

export interface CastComment {
  author: {
    fid: number;
    fname: string;
    displayName: string;
    pfp: string;
    verifiedAddresses: {
      primary: {
        eth_address: string;
      };
    };
  };
}

export interface CastQuote {
  author: {
    fid: number;
    fname: string;
    displayName: string;
    pfp: string;
    verifiedAddresses: {
      primary: {
        eth_address: string;
      };
    };
  };
}

export interface CastEngagement {
  likes: CastUser[];
  recasts: CastUser[];
  quotes: CastUser[];
  comments: CastUser[];
  totalUsers: CastUser[];
}

export interface CastInfo {
  hash: string;
  text: string;
  author: {
    username: string;
    displayName: string;
    pfpUrl: string;
  };
  timestamp: string;
  embeds: any[];
}

// URL에서 cast hash 추출
export function extractCastHash(url: string): string | null {
  // 0x로 시작하는 16진수 문자열 찾기 (최소 8자리)
  const hashMatch = url.match(/0x[a-fA-F0-9]{8,}/);
  console.log('Extracted hash from URL:', hashMatch ? hashMatch[0] : 'null');
  return hashMatch ? hashMatch[0] : null;
}

// Cast 정보 가져오기 (URL 또는 hash 지원)
export async function getCastByHashOrUrl(identifier: string, type: 'hash' | 'url' = 'hash') {
  console.log('Fetching cast with identifier:', identifier, 'type:', type);
  const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}`, {
    headers: {
      'x-api-key': NEYNAR_API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cast fetch error:', errorText);
    throw new Error('Failed to fetch cast');
  }
  
  const data = await response.json();
  console.log('Cast data:', data);
  return data;
}

// Cast 정보를 CastInfo 형태로 변환
export function transformCastToInfo(castData: any): CastInfo {
  const cast = castData.cast;
  return {
    hash: cast.hash,
    text: cast.text,
    author: {
      username: cast.author.username,
      displayName: cast.author.display_name,
      pfpUrl: cast.author.pfp_url,
    },
    timestamp: cast.timestamp,
    embeds: cast.embeds || [],
  };
}

// Cast 반응 가져오기 (Likes, Recasts) - 올바른 엔드포인트 사용
export async function getCastReactions(hash: string) {
  console.log('Fetching cast reactions for hash:', hash);
  const response = await fetch(`https://api.neynar.com/v2/farcaster/reactions/cast/?hash=${encodeURIComponent(hash)}&types=likes,recasts&limit=100`, {
    headers: {
      'x-api-key': NEYNAR_API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Reactions fetch error:', errorText);
    throw new Error('Failed to fetch cast reactions');
  }
  
  const data = await response.json();
  console.log('Reactions data:', data);
  return data;
}

// Cast 댓글 가져오기 - 올바른 엔드포인트 사용
export async function getCastComments(hash: string, authorFid?: number) {
  console.log('Fetching cast comments (replies) for hash:', hash, 'fid:', authorFid);
  
  // v2 conversation API 사용
  const response = await fetch(`https://api.neynar.com/v2/farcaster/cast/conversation/?identifier=${encodeURIComponent(hash)}&type=hash&reply_depth=1&include_chronological_parent_casts=false&limit=50`, {
    headers: {
      'x-api-key': NEYNAR_API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Comments fetch error:', errorText);
    throw new Error('Failed to fetch cast comments');
  }
  
  const data = await response.json();
  console.log('Comments data:', data);
  return data;
}

// Cast 인용 가져오기 - 올바른 엔드포인트 사용
export async function getCastQuotes(hash: string) {
  console.log('Fetching cast quotes for hash:', hash);
  const response = await fetch(`https://api.neynar.com/v2/farcaster/cast/quotes?identifier=${encodeURIComponent(hash)}&type=hash&limit=50`, {
    headers: {
      'x-api-key': NEYNAR_API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Quotes fetch error:', errorText);
    throw new Error('Failed to fetch cast quotes');
  }
  
  const data = await response.json();
  console.log('Quotes data:', data);
  return data;
}

// 사용자 정보를 CastUser 형태로 변환
export function transformToCastUser(user: any): CastUser | null {
  // 다양한 데이터 구조에 대응
  const userData = user.author || user;
  
  // 기본 정보가 없으면 제외
  if (!userData.fid) {
    console.log('Skipping user without FID:', userData);
    return null;
  }
  
  // 지갑 주소가 없는 경우 임시 주소 생성 (FID 기반)
  const walletAddress = userData.verified_addresses?.primary?.eth_address || 
                       `0x${userData.fid.toString().padStart(40, '0')}`;
  
  return {
    fid: userData.fid,
    username: userData.username || userData.fname || `user_${userData.fid}`,
    displayName: userData.display_name || userData.displayName || userData.fname || `User ${userData.fid}`,
    pfpUrl: userData.pfp_url || userData.pfp || '',
    walletAddress: walletAddress,
  };
}

// 중복 제거된 사용자 목록 생성
export function getUniqueUsers(users: CastUser[]): CastUser[] {
  const uniqueMap = new Map<string, CastUser>();
  
  users.forEach(user => {
    if (user.walletAddress) {
      uniqueMap.set(user.walletAddress.toLowerCase(), user);
    }
  });
  
  return Array.from(uniqueMap.values());
}

// 모든 액션에서 사용자 수집 (URL 또는 hash로 부터)
export async function getAllCastUsers(urlOrHash: string): Promise<CastEngagement> {
  console.log('Starting to fetch all cast users for:', urlOrHash);
  
  try {
    // URL인지 hash인지 판단
    const isUrl = urlOrHash.startsWith('http');
    const type = isUrl ? 'url' : 'hash';
    
    console.log('Fetching cast data with type:', type);
    
    // Cast 정보 가져오기
    const castData = await getCastByHashOrUrl(urlOrHash, type);
    
    if (!castData?.cast) {
      throw new Error('Cast not found');
    }

    const cast = castData.cast;
    const likes: CastUser[] = [];
    const recasts: CastUser[] = [];
    const quotes: CastUser[] = [];
    const comments: CastUser[] = [];

    console.log('Cast hash:', cast.hash);
    console.log('Cast reactions count:', cast.reactions?.likes_count || 0, 'likes,', cast.reactions?.recasts_count || 0, 'recasts');
    console.log('Cast replies count:', cast.replies?.count || 0);

    // Reactions (Likes, Recasts) - 새로운 API 사용
    try {
      const reactions = await getCastReactions(cast.hash);
      if (reactions.reactions) {
        console.log('Found reactions:', reactions.reactions.length);
        reactions.reactions.forEach((reaction: any) => {
          const user = transformToCastUser(reaction.user);
          if (user) {
            if (reaction.reaction_type === 'like') {
              likes.push(user);
            } else if (reaction.reaction_type === 'recast') {
              recasts.push(user);
            }
          }
        });
      }
    } catch (error) {
      console.warn('Failed to fetch reactions:', error);
    }

    // 댓글(Replies)은 별도 API 호출
    if (cast.replies?.count > 0) {
      try {
        const commentsData = await getCastComments(cast.hash, cast.author.fid);
        console.log('Raw comments data:', commentsData);
        
        // API 응답 구조 자세히 분석
        console.log('Comments data structure:', {
          hasResult: !!commentsData.result,
          hasCasts: !!commentsData.casts,
          hasConversation: !!commentsData.conversation,
          conversationKeys: commentsData.conversation ? Object.keys(commentsData.conversation) : [],
          resultKeys: commentsData.result ? Object.keys(commentsData.result) : [],
          castsLength: commentsData.casts ? commentsData.casts.length : 0,
          castsType: commentsData.casts ? typeof commentsData.casts : 'undefined'
        });

        // v1 API 응답 구조: { result: { casts: [...] } }
        if (commentsData.result?.casts && Array.isArray(commentsData.result.casts)) {
          console.log('Found comments (v1):', commentsData.result.casts.length);
          commentsData.result.casts.forEach((reply: any) => {
            const user = transformToCastUser(reply.author);
            if (user) comments.push(user);
          });
        } 
        // 직접 casts 배열인 경우
        else if (commentsData.casts && Array.isArray(commentsData.casts)) {
          console.log('Found comments (direct):', commentsData.casts.length);
          commentsData.casts.forEach((reply: any, index: number) => {
            console.log(`Processing comment ${index}:`, {
              hasAuthor: !!reply.author,
              authorFid: reply.author?.fid,
              authorUsername: reply.author?.username,
              hasVerifiedAddresses: !!reply.author?.verified_addresses?.primary?.eth_address
            });
            const user = transformToCastUser(reply.author);
            if (user) {
              comments.push(user);
              console.log(`Added comment user: ${user.username} (FID: ${user.fid})`);
            } else {
              console.log(`Skipped comment user: ${reply.author?.username} (FID: ${reply.author?.fid})`);
            }
          });
        }
        // v2 conversation 구조 - conversation.cast.replies
        else if (commentsData.conversation?.cast?.replies && Array.isArray(commentsData.conversation.cast.replies)) {
          console.log('Found comments (v2 cast.replies):', commentsData.conversation.cast.replies.length);
          commentsData.conversation.cast.replies.forEach((reply: any) => {
            const user = transformToCastUser(reply.author);
            if (user) comments.push(user);
          });
        }
        // v2 conversation 구조 - conversation.replies
        else if (commentsData.conversation?.replies && Array.isArray(commentsData.conversation.replies)) {
          console.log('Found comments (v2 replies):', commentsData.conversation.replies.length);
          commentsData.conversation.replies.forEach((reply: any) => {
            const user = transformToCastUser(reply.author);
            if (user) comments.push(user);
          });
        }
        // v2 conversation 구조 - conversation.direct_replies
        else if (commentsData.conversation?.direct_replies && Array.isArray(commentsData.conversation.direct_replies)) {
          console.log('Found comments (v2 direct_replies):', commentsData.conversation.direct_replies.length);
          commentsData.conversation.direct_replies.forEach((reply: any) => {
            const user = transformToCastUser(reply.author);
            if (user) comments.push(user);
          });
        }
        // v2 conversation 구조 - conversation.cast.direct_replies
        else if (commentsData.conversation?.cast?.direct_replies && Array.isArray(commentsData.conversation.cast.direct_replies)) {
          console.log('Found comments (v2 cast.direct_replies):', commentsData.conversation.cast.direct_replies.length);
          commentsData.conversation.cast.direct_replies.forEach((reply: any, index: number) => {
            console.log(`Processing comment ${index}:`, {
              hasAuthor: !!reply.author,
              authorFid: reply.author?.fid,
              authorUsername: reply.author?.username,
              hasVerifiedAddresses: !!reply.author?.verified_addresses?.primary?.eth_address
            });
            const user = transformToCastUser(reply.author);
            if (user) {
              comments.push(user);
              console.log(`Added comment user: ${user.username} (FID: ${user.fid})`);
            } else {
              console.log(`Skipped comment user: ${reply.author?.username} (FID: ${reply.author?.fid})`);
            }
          });
        }
        // 마지막 시도: conversation 객체 자체가 배열인 경우
        else if (Array.isArray(commentsData.conversation)) {
          console.log('Found comments (conversation array):', commentsData.conversation.length);
          commentsData.conversation.forEach((reply: any) => {
            const user = transformToCastUser(reply.author);
            if (user) comments.push(user);
          });
        }
      } catch (error) {
        console.warn('Failed to fetch comments:', error);
      }
    }

    // 인용은 별도 API 호출
    try {
      const quotesData = await getCastQuotes(cast.hash);
      console.log('Raw quotes data:', quotesData);
      if (quotesData.result?.casts) {
        console.log('Found quotes:', quotesData.result.casts.length);
        quotesData.result.casts.forEach((quote: any) => {
          const user = transformToCastUser(quote.author);
          if (user) quotes.push(user);
        });
      } else if (quotesData.casts) {
        console.log('Found quotes (alternative):', quotesData.casts.length);
        quotesData.casts.forEach((quote: any) => {
          const user = transformToCastUser(quote.author);
          if (user) quotes.push(user);
        });
      }
    } catch (error) {
      console.warn('Failed to fetch quotes:', error);
    }

    // 중복 제거
    const allUsers = [...likes, ...recasts, ...quotes, ...comments];
    const uniqueUsers = getUniqueUsers(allUsers);
    
    console.log('Total unique users found:', uniqueUsers.length);
    console.log('Likes:', likes.length, 'Recasts:', recasts.length, 'Quotes:', quotes.length, 'Comments:', comments.length);
    
    return {
      likes: getUniqueUsers(likes),
      recasts: getUniqueUsers(recasts),
      quotes: getUniqueUsers(quotes),
      comments: getUniqueUsers(comments),
      totalUsers: uniqueUsers
    };
  } catch (error) {
    console.error('Error fetching cast users:', error);
    throw error;
  }
} 