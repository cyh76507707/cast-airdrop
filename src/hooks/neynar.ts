import useSWR, { mutate } from 'swr';
import {
  getCastByHashOrUrl,
  getCastReactions,
  getCastComments,
  getCastQuotes,
  transformToCastUser,
  getUniqueUsers,
  type CastEngagement,
} from '~/lib/neynar';

type CastType = 'hash' | 'url';

function keyCast(identifier?: string, type: CastType = 'hash') {
  return identifier ? ['neynar', 'cast', type, identifier] as const : null;
}

function keyReactions(hash?: string) {
  return hash ? ['neynar', 'reactions', hash] as const : null;
}

function keyComments(hash?: string) {
  return hash ? ['neynar', 'comments', hash] as const : null;
}

function keyQuotes(hash?: string) {
  return hash ? ['neynar', 'quotes', hash] as const : null;
}

function keyEngagement(hash?: string) {
  return hash ? ['neynar', 'engagement', hash] as const : null;
}

export function useNeynarCast(identifier?: string, type: CastType = 'hash') {
  return useSWR(keyCast(identifier, type),
    ([, , t, id]) => getCastByHashOrUrl(id as string, t as CastType),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  );
}

export function useNeynarReactions(hash?: string) {
  return useSWR(keyReactions(hash),
    ([, , h]) => getCastReactions(h as string),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  );
}

export function useNeynarComments(hash?: string) {
  return useSWR(keyComments(hash),
    ([, , h]) => getCastComments(h as string),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  );
}

export function useNeynarQuotes(hash?: string) {
  return useSWR(keyQuotes(hash),
    ([, , h]) => getCastQuotes(h as string),
    { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true }
  );
}

export function useNeynarEngagement(hash?: string) {
  return useSWR<CastEngagement | null>(keyEngagement(hash), async ([, , h]) => {
    const [reactions, commentsData, quotesData] = await Promise.all([
      getCastReactions(h as string).catch(() => ({ reactions: [] })),
      getCastComments(h as string).catch(() => ({})),
      getCastQuotes(h as string).catch(() => ({ result: { casts: [] }, casts: [] })),
    ]);

    const likes: ReturnType<typeof transformToCastUser>[] = [];
    const recasts: ReturnType<typeof transformToCastUser>[] = [];
    const comments: ReturnType<typeof transformToCastUser>[] = [];
    const quotes: ReturnType<typeof transformToCastUser>[] = [];

    if (Array.isArray(reactions?.reactions)) {
      reactions.reactions.forEach((reaction: any) => {
        const user = transformToCastUser(reaction.user);
        if (!user) return;
        if (reaction.reaction_type === 'like') likes.push(user);
        if (reaction.reaction_type === 'recast') recasts.push(user);
      });
    }

    // Comments can be in multiple shapes; normalize like in lib/neynar.ts
    const pushCommentAuthor = (reply: any) => {
      const user = transformToCastUser(reply?.author);
      if (user) comments.push(user);
    };
    if (Array.isArray(commentsData?.result?.casts)) commentsData.result.casts.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.casts)) commentsData.casts.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.conversation?.cast?.replies)) commentsData.conversation.cast.replies.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.conversation?.replies)) commentsData.conversation.replies.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.conversation?.direct_replies)) commentsData.conversation.direct_replies.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.conversation?.cast?.direct_replies)) commentsData.conversation.cast.direct_replies.forEach(pushCommentAuthor);
    else if (Array.isArray(commentsData?.conversation)) commentsData.conversation.forEach(pushCommentAuthor);

    if (Array.isArray(quotesData?.result?.casts)) quotesData.result.casts.forEach((q: any) => {
      const u = transformToCastUser(q.author); if (u) quotes.push(u);
    });
    else if (Array.isArray(quotesData?.casts)) quotesData.casts.forEach((q: any) => {
      const u = transformToCastUser(q.author); if (u) quotes.push(u);
    });

    const uniqueLikes = getUniqueUsers(likes.filter(Boolean) as any);
    const uniqueRecasts = getUniqueUsers(recasts.filter(Boolean) as any);
    const uniqueComments = getUniqueUsers(comments.filter(Boolean) as any);
    const uniqueQuotes = getUniqueUsers(quotes.filter(Boolean) as any);
    const totalUsers = getUniqueUsers([
      ...uniqueLikes,
      ...uniqueRecasts,
      ...uniqueComments,
      ...uniqueQuotes,
    ]);

    return {
      likes: uniqueLikes,
      recasts: uniqueRecasts,
      comments: uniqueComments,
      quotes: uniqueQuotes,
      totalUsers,
    };
  }, { dedupingInterval: 300000, revalidateOnFocus: false, keepPreviousData: true });
}

export async function prefetchNeynarFromUrl(identifier: string, type: CastType = 'url') {
  const castData = await getCastByHashOrUrl(identifier, type);
  const hash: string | undefined = castData?.cast?.hash;

  await mutate(keyCast(identifier, type), castData, false);

  if (!hash) {
    return { castData, engagementData: null } as const;
  }

  const [reactions, commentsData, quotesData] = await Promise.all([
    getCastReactions(hash).catch(() => ({ reactions: [] })),
    getCastComments(hash).catch(() => ({})),
    getCastQuotes(hash).catch(() => ({ result: { casts: [] }, casts: [] })),
  ]);

  await Promise.all([
    mutate(keyReactions(hash), reactions, false),
    mutate(keyComments(hash), commentsData, false),
    mutate(keyQuotes(hash), quotesData, false),
  ]);

  const likes: ReturnType<typeof transformToCastUser>[] = [];
  const recasts: ReturnType<typeof transformToCastUser>[] = [];
  const comments: ReturnType<typeof transformToCastUser>[] = [];
  const quotes: ReturnType<typeof transformToCastUser>[] = [];

  if (Array.isArray(reactions?.reactions)) {
    reactions.reactions.forEach((reaction: any) => {
      const user = transformToCastUser(reaction.user);
      if (!user) return;
      if (reaction.reaction_type === 'like') likes.push(user);
      if (reaction.reaction_type === 'recast') recasts.push(user);
    });
  }

  const pushCommentAuthor = (reply: any) => {
    const user = transformToCastUser(reply?.author);
    if (user) comments.push(user);
  };
  if (Array.isArray(commentsData?.result?.casts)) commentsData.result.casts.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.casts)) commentsData.casts.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.conversation?.cast?.replies)) commentsData.conversation.cast.replies.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.conversation?.replies)) commentsData.conversation.replies.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.conversation?.direct_replies)) commentsData.conversation.direct_replies.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.conversation?.cast?.direct_replies)) commentsData.conversation.cast.direct_replies.forEach(pushCommentAuthor);
  else if (Array.isArray(commentsData?.conversation)) commentsData.conversation.forEach(pushCommentAuthor);

  if (Array.isArray(quotesData?.result?.casts)) quotesData.result.casts.forEach((q: any) => {
    const u = transformToCastUser(q.author); if (u) quotes.push(u);
  });
  else if (Array.isArray(quotesData?.casts)) quotesData.casts.forEach((q: any) => {
    const u = transformToCastUser(q.author); if (u) quotes.push(u);
  });

  const uniqueLikes = getUniqueUsers(likes.filter(Boolean) as any);
  const uniqueRecasts = getUniqueUsers(recasts.filter(Boolean) as any);
  const uniqueComments = getUniqueUsers(comments.filter(Boolean) as any);
  const uniqueQuotes = getUniqueUsers(quotes.filter(Boolean) as any);
  const totalUsers = getUniqueUsers([
    ...uniqueLikes,
    ...uniqueRecasts,
    ...uniqueComments,
    ...uniqueQuotes,
  ]);

  const engagement: CastEngagement = {
    likes: uniqueLikes,
    recasts: uniqueRecasts,
    comments: uniqueComments,
    quotes: uniqueQuotes,
    totalUsers,
  };

  await mutate(keyEngagement(hash), engagement, false);

  return { castData, engagementData: engagement } as const;
}


