import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type UseQueryOptions } from '@tanstack/react-query';
import type { InputOf, MethodName, OutputOf } from '@runhigh/core';
import { api } from './client.ts';
import { ApiError, toApiError } from './errors.ts';
import { toast } from '../components/toast.ts';

type QueryOpts<K extends MethodName> = Omit<UseQueryOptions<OutputOf<K>, ApiError>, 'queryKey' | 'queryFn'>;

/** 서비스 메서드 조회 (queryKey = [메서드, 입력]) */
export function useApiQuery<K extends MethodName>(name: K, input: InputOf<K>, opts: QueryOpts<K> = {}) {
  return useQuery<OutputOf<K>, ApiError>({
    queryKey: [name, input],
    queryFn: () => api.call(name, input),
    ...opts,
  });
}

interface MutationOpts<K extends MethodName> {
  /** false면 성공 후 다른 조회를 새로 고치지 않음 (좋아요처럼 화면에서 바로 반영하는 경우) */
  invalidate?: boolean;
  onSuccess?: (data: OutputOf<K>, input: InputOf<K>) => void;
  onError?: (error: ApiError, input: InputOf<K>) => boolean | void;
  /** 성공 시 보여줄 토스트 */
  successMessage?: string | ((data: OutputOf<K>) => string);
}

/** 서비스 메서드 변경. 성공하면 화면의 모든 조회를 새로 고칩니다 */
export function useApiMutation<K extends MethodName>(name: K, opts: MutationOpts<K> = {}) {
  const qc = useQueryClient();
  return useMutation<OutputOf<K>, ApiError, InputOf<K>>({
    mutationFn: async (input) => {
      try {
        return (await api.call(name, input)) as OutputOf<K>;
      } catch (e) {
        throw toApiError(e);
      }
    },
    onSuccess: async (data, input) => {
      if (opts.invalidate !== false) await qc.invalidateQueries();
      if (opts.successMessage) toast.success(typeof opts.successMessage === 'function' ? opts.successMessage(data) : opts.successMessage);
      opts.onSuccess?.(data, input);
    },
    onError: (error, input) => {
      const handled = opts.onError?.(error, input);
      if (handled !== true) toast.error(error.message);
    },
  });
}

type ItemOf<K extends MethodName> = OutputOf<K> extends { items: (infer T)[]; nextCursor: string | null } ? T : never;

/** 커서 기반 목록 (items + nextCursor) 무한 스크롤 */
export function useApiInfinite<K extends MethodName>(name: K, input: InputOf<K>, opts: { enabled?: boolean } = {}) {
  const q = useInfiniteQuery<OutputOf<K>, ApiError, InfiniteData<OutputOf<K>>, unknown[], string | undefined>({
    queryKey: [name, input, 'infinite'],
    queryFn: async ({ pageParam }) => {
      try {
        return (await api.call(name, { ...(input as object), cursor: pageParam } as InputOf<K>)) as OutputOf<K>;
      } catch (e) {
        throw toApiError(e);
      }
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => (last as { nextCursor: string | null }).nextCursor ?? undefined,
    enabled: opts.enabled,
  });
  const items = (q.data?.pages ?? []).flatMap((p) => (p as unknown as { items: ItemOf<K>[] }).items);
  return { ...q, items };
}
