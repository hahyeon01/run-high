import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { BIB_TRADE_MESSAGE, containsBibTrade, type CommentDto } from '@runhigh/core';
import { useApiMutation, useApiQuery } from '../../api/hooks.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { VerifiedMark } from '../../components/Badge.tsx';
import { BottomBar, Page, TopBar } from '../../components/Header.tsx';
import { Icon } from '../../components/Icon.tsx';
import { ErrorState, Skeleton } from '../../components/Misc.tsx';
import { ConfirmDialog } from '../../components/Sheet.tsx';
import { cn } from '../../lib/cn.ts';
import { timeAgo } from '../../lib/format.ts';
import { ReportSheet } from '../shared/ReportSheet.tsx';
import { PostCard } from './PostCard.tsx';

export default function PostDetail() {
  const { id = '' } = useParams();
  const post = useApiQuery('feed.get', { id });
  const comments = useApiQuery('feed.comments', { postId: id }, { enabled: !!post.data });
  const [reporting, setReporting] = useState<CommentDto | null>(null);
  const [deleting, setDeleting] = useState<CommentDto | null>(null);
  const del = useApiMutation('feed.deleteComment', { successMessage: '댓글을 삭제했어요', onSuccess: () => setDeleting(null) });

  return (
    <div>
      <TopBar title="게시글" back="/feed" />
      <Page>
        {post.isLoading ? (
          <Skeleton className="h-80 rounded-[28px]" />
        ) : post.error || !post.data ? (
          <ErrorState message={post.error?.message ?? '게시글을 불러오지 못했어요'} onRetry={() => void post.refetch()} />
        ) : (
          <>
            <PostCard post={post.data} detail />
            <section className="mt-6" aria-labelledby="comments-title">
              <h2 id="comments-title" className="px-1 text-[16px] font-semibold">
                댓글 <span className="tnum text-muted">{comments.data?.length ?? post.data.commentCount}</span>
              </h2>
              <div className="mt-3 space-y-1">
                {comments.isLoading ? (
                  <Skeleton className="h-16" />
                ) : (comments.data ?? []).length === 0 ? (
                  <p className="rounded-2xl bg-surface-2 px-4 py-5 text-center text-[14px] text-muted">첫 응원 댓글을 남겨 보세요</p>
                ) : (
                  comments.data!.map((c) => (
                    <CommentRow
                      key={c.id}
                      c={c}
                      canDelete={c.isMine || post.data!.isMine}
                      onDelete={() => setDeleting(c)}
                      onReport={() => setReporting(c)}
                    />
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </Page>
      {post.data && (
        <BottomBar>
          <Composer postId={id} />
        </BottomBar>
      )}
      <ReportSheet
        open={reporting != null}
        onClose={() => setReporting(null)}
        targetType="comment"
        targetId={reporting?.id ?? ''}
        blockUserId={reporting?.author.id}
        title="댓글 신고"
      />
      <ConfirmDialog
        open={deleting != null}
        title="댓글을 삭제할까요?"
        confirmLabel="삭제"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CommentRow({ c, canDelete, onDelete, onReport }: { c: CommentDto; canDelete: boolean; onDelete: () => void; onReport: () => void }) {
  return (
    <div className="flex gap-3 rounded-2xl px-1 py-2.5">
      <Link to={`/users/${c.author.id}`} className="shrink-0" aria-label={`${c.author.nickname} 프로필`}>
        <Avatar avatar={c.author.avatar} size={36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[13.5px]">
          <Link to={`/users/${c.author.id}`} className="font-semibold text-ink hover:underline">
            {c.author.nickname}
          </Link>
          {c.author.phoneVerified && <VerifiedMark />}
          <span className="text-muted">· {timeAgo(c.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink">{c.body}</p>
        <div className="mt-1 flex gap-3 text-[12.5px] font-medium text-muted">
          {canDelete && (
            <button type="button" onClick={onDelete} className="hover:text-bad-ink">
              삭제
            </button>
          )}
          {!c.isMine && (
            <button type="button" onClick={onReport} className="hover:text-ink">
              신고
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ postId }: { postId: string }) {
  const [body, setBody] = useState('');
  const bib = containsBibTrade(body);
  const send = useApiMutation('feed.comment', { onSuccess: () => setBody('') });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || bib) return;
    send.mutate({ postId, body: body.trim() });
  };
  return (
    <form onSubmit={submit}>
      {bib && (
        <p className="mb-2 flex items-start gap-1.5 text-[13px] text-bad-ink" role="alert">
          <Icon name="danger" size={15} className="mt-0.5" />
          {BIB_TRADE_MESSAGE}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="comment-input" className="sr-only">
          댓글
        </label>
        <input
          id="comment-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          placeholder="응원 댓글 남기기"
          className="h-12 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-[15px] text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12"
        />
        <button
          type="submit"
          disabled={!body.trim() || bib || send.isPending}
          aria-label="댓글 보내기"
          className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition-opacity disabled:opacity-40')}
        >
          <Icon name="send" size={20} />
        </button>
      </div>
    </form>
  );
}
