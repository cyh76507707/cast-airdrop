import useSWR from "swr";

export interface NeynarUser {
  fid: number;
  score: number;
}

export function useNeynarUser(context?: { user?: { fid?: number } }) {
  const fid = context?.user?.fid;
  const { data, error, isLoading } = useSWR<NeynarUser | null>(
    fid ? `/api/users?fids=${fid}` : null,
    {
      dedupingInterval: 300000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return { user: data ?? null, loading: !!fid && isLoading, error: error ? (error as Error).message : null };
} 