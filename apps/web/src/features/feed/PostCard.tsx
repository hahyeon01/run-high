import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { PostDto, RunDto } from '@runhigh/core';
import { mediaUrl } from '../../api/client.ts';
import { useApiMutation } from '../../api/hooks.ts';
import { Avatar } from '../../components/Avatar.tsx';
import { SourceBadge, VerifiedMark } from '../../components/Badge.tsx';
import { IconButton } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { RouteSvg } from '../../components/RouteSvg.tsx';
import { ConfirmDialog, MenuItem, Sheet } from '../../components/Sheet.tsx';
import { toast } from '../../components/toast.ts';
import { cn } from '../../lib/cn.ts';
import { formatDuration, formatPace, km, regionShortLabel, timeAgo } from '../../lib/format.ts';
import { shareText } from '../../native/share.ts';
import { ReportSheet } from '../shared/ReportSheet.tsx';

/** 게시글에 붙은 러닝 기록 요약 (거리가 가장 크게) */
export function RunStrip({ run, to }: { run: RunDto; to?: string }) {
  const body = (
    <div className="flex items-stretch gap-3 rounded-[22px] bg-brand-tint p-3.5 pr-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="font-num text-[34px] font-bold leading-none tracking-[-0.03em] text-ink">{km(run.distanceM)}</span>
          <span className="text-[14px] font-semibold text-ink-2">km</span>
        </div>
        <dl className="mt-2.5 flex gap-5 text-ink">
          <div>
            <dt className="text-[11.5px] text-muted">페이스</dt>
            <dd className="font-num text-[16px] font-semibold">{formatPace(run.paceS)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">시간</dt>
            <dd className="font-num text-[16px] font-semibold">{formatDuration(run.durationS)}</dd>
          </div>
        </dl>
        <div className="mt-2.5">
          <SourceBadge source={run.source} verified={run.verified} />
        </div>
      </div>
      {run.route && run.route.length > 1 ? (
        <RouteSvg route={run.route} className="size-[104px] shrink-0 rounded-[18px] bg-surface/70" strokeWidth={4} />
      ) : (
        <div className="flex size-[104px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-surface/70 text-brand" aria-hidden>
          <Icon name="activity" size={30} />
        </div>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-opacity hover:opacity-90" aria-label="기록 자세히 보기">
      {body}
    </Link>
  ) : (
    body
  );
}

export function PhotoGrid({ photos, onOpen }: { photos: string[]; onOpen?: (i: number) => void }) {
  if (photos.length === 0) return null;
  const n = photos.length;
  return (
    <div className={cn('grid gap-1.5 overflow-hidden rounded-[22px]', n === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
      {photos.map((src, i) => (
        <button
          key={src + i}
          type="button"
          onClick={() => onOpen?.(i)}
          className={cn('relative block overflow-hidden bg-surface-2', n === 1 ? 'aspect-[4/3]' : n === 3 && i === 0 ? 'row-span-2 aspect-auto' : 'aspect-square')}
          aria-label={`사진 ${i + 1} 크게 보기`}
        >
          <img src={mediaUrl(src)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        </button>
      ))}
    </div>
  );
}

function PhotoViewer({ photos, index, onClose }: { photos: string[]; index: number | null; onClose: () => void }) {
  const [i, setI] = useState(index ?? 0);
  useEffect(() => setI(index ?? 0), [index]);
  return (
    <Sheet open={index != null} onClose={onClose} title={`사진 ${i + 1}/${photos.length}`}>
      <img src={mediaUrl(photos[i] ?? '')} alt="" className="w-full rounded-2xl object-contain" />
      {photos.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          <IconButton icon="back" label="이전 사진" tone="soft" disabled={i === 0} onClick={() => setI(i - 1)} className="disabled:opacity-30" />
          <IconButton icon="forward" label="다음 사진" tone="soft" disabled={i === photos.length - 1} onClick={() => setI(i + 1)} className="disabled:opacity-30" />
        </div>
      )}
    </Sheet>
  );
}

const SCOPE_LABEL = { region: '', followers: '팔로워 공개', crew: '' } as const;

export function PostCard({ post, detail = false }: { post: PostDto; detail?: boolean }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [sheet, setSheet] = useState<null | 'more' | 'report' | 'delete'>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  useEffect(() => {
    setLiked(post.liked);
    setLikeCount(post.likeCount);
  }, [post.liked, post.likeCount]);

  const like = useApiMutation('feed.like', {
    invalidate: false,
    onSuccess: (r) => {
      setLiked(r.liked);
      setLikeCount(r.likeCount);
    },
    onError: () => {
      setLiked(post.liked);
      setLikeCount(post.likeCount);
    },
  });
  const del = useApiMutation('feed.delete', {
    successMessage: '게시글을 삭제했어요',
    onSuccess: () => {
      setSheet(null);
      if (detail) navigate('/feed', { replace: true });
    },
  });

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    like.mutate({ id: post.id, like: next });
  };

  const share = async () => {
    const text = post.run
      ? `${post.author.nickname}님의 러닝 ${km(post.run.distanceM)}km · ${formatPace(post.run.paceS)}/km — 런하이`
      : `${post.author.nickname}님의 러닝 이야기 — 런하이`;
    const done = await shareText('런하이', text);
    if (done === 'copied') toast.info('공유 문구를 복사했어요');
  };

  const where = post.scope === 'crew' && post.crew ? post.crew.name : post.scope === 'followers' ? SCOPE_LABEL.followers : regionShortLabel(post.region);
  const bodyClamp = !detail && post.body.length > 140;

  return (
    <article className="rounded-[28px] bg-surface p-4 shadow-card" aria-label={`${post.author.nickname}님의 게시글`}>
      <header className="flex items-center gap-3">
        <Link to={`/users/${post.author.id}`} className="shrink-0" aria-label={`${post.author.nickname} 프로필`}>
          <Avatar avatar={post.author.avatar} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Link to={`/users/${post.author.id}`} className="truncate text-[15px] font-semibold text-ink hover:underline">
              {post.author.nickname}
            </Link>
            {post.author.phoneVerified && <VerifiedMark />}
          </div>
          <div className="flex items-center gap-1 text-[12.5px] text-muted">
            {post.scope === 'crew' ? <Icon name="people" size={13} /> : post.scope === 'followers' ? <Icon name="lock" size={13} /> : <Icon name="location" size={13} />}
            <span className="truncate">{where}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.createdAt} className="shrink-0">
              {timeAgo(post.createdAt)}
            </time>
          </div>
        </div>
        <IconButton icon="dots" label="게시글 메뉴" onClick={() => setSheet('more')} className="-mr-2" />
      </header>

      {post.run && (
        <div className="mt-3.5">
          <RunStrip run={post.run} to={`/records/${post.run.id}`} />
        </div>
      )}

      {post.body && (
        <div className="mt-3.5">
          <p className={cn('whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink', bodyClamp && 'line-clamp-4')}>{post.body}</p>
          {bodyClamp && (
            <Link to={`/posts/${post.id}`} className="mt-1 inline-block text-[14px] font-semibold text-muted hover:text-ink">
              더 보기
            </Link>
          )}
        </div>
      )}

      {post.photos.length > 0 && (
        <div className="mt-3.5">
          <PhotoGrid photos={post.photos} onOpen={setPhoto} />
        </div>
      )}

      <footer className="-mb-1 -ml-2 mt-2.5 flex items-center gap-1">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={cn('inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold transition-colors hover:bg-surface-2', liked ? 'text-brand' : 'text-ink-2')}
        >
          <Icon name="heart" size={21} filled={liked} />
          응원 {likeCount > 0 && <span className="tnum">{likeCount}</span>}
        </button>
        {detail ? (
          <span className="inline-flex h-10 items-center gap-1.5 px-3 text-[14px] font-semibold text-ink-2">
            <Icon name="chat" size={21} />
            댓글 <span className="tnum">{post.commentCount}</span>
          </span>
        ) : (
          <Link to={`/posts/${post.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink-2 hover:bg-surface-2">
            <Icon name="chat" size={21} />
            댓글 {post.commentCount > 0 && <span className="tnum">{post.commentCount}</span>}
          </Link>
        )}
        <div className="flex-1" />
        <IconButton icon="send" label="공유" size={20} onClick={() => void share()} className="text-ink-2" />
      </footer>

      <PhotoViewer photos={post.photos} index={photo} onClose={() => setPhoto(null)} />
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="게시글">
        <div className="space-y-1.5">
          {!detail && (
            <MenuItem icon="document" onClick={() => navigate(`/posts/${post.id}`)}>
              게시글 열기
            </MenuItem>
          )}
          <MenuItem icon="user" onClick={() => navigate(`/users/${post.author.id}`)}>
            {post.author.nickname}님 프로필
          </MenuItem>
          {post.isMine ? (
            <MenuItem icon="delete" tone="danger" onClick={() => setSheet('delete')}>
              게시글 삭제
            </MenuItem>
          ) : (
            <MenuItem icon="danger" tone="danger" onClick={() => setSheet('report')}>
              신고하기
            </MenuItem>
          )}
        </div>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="post" targetId={post.id} blockUserId={post.author.id} title="게시글 신고" />
      <ConfirmDialog
        open={sheet === 'delete'}
        title="게시글을 삭제할까요?"
        description="댓글과 응원도 함께 사라져요. 첨부한 기록은 내 기록에 그대로 남아요."
        confirmLabel="삭제"
        tone="danger"
        loading={del.isPending}
        onConfirm={() => del.mutate({ id: post.id })}
        onClose={() => setSheet(null)}
      />
    </article>
  );
}
