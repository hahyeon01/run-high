import { z } from 'zod';
import type { CommentDto, PostDto } from '../domain/dto.ts';
import { matchesAnyRegion, regionSido, regionsOverlap } from '../domain/regions.ts';
import { mutation, query, type UserCtx } from '../rpc/define.ts';
import { AppError, forbidden, invalid, notFound } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { parseJson, toJson } from '../util/json.ts';
import { placeholders } from '../db/types.ts';
import {
  BIB_TRADE_MESSAGE,
  blockedIds,
  clampLimit,
  containsBibTrade,
  followingIds,
  notify,
  nowIso,
  requireUserRow,
  runRegionsOf,
  toRunDto,
  userCard,
  type RunRow,
} from './common.ts';
import { cursorSchema, dataUrlSchema, idSchema, limitSchema, regionSchema } from './schemas.ts';

interface PostRow {
  id: string;
  user_id: string;
  run_id: string | null;
  body: string;
  photos: string;
  scope: 'region' | 'followers' | 'crew';
  region: string;
  crew_id: string | null;
  hidden: number;
  created_at: string;
}

function myCrewIds(ctx: UserCtx): string[] {
  return ctx.deps.db
    .all<{ id: string }>(`SELECT crew_id AS id FROM crew_members WHERE user_id = ? AND status = 'active'`, [ctx.userId])
    .map((r) => r.id);
}

function canView(ctx: UserCtx, post: PostRow): boolean {
  if (post.hidden) return false;
  if (post.user_id === ctx.userId) return true;
  if (blockedIds(ctx, ctx.userId).has(post.user_id)) return false;
  if (post.scope === 'region') return true;
  if (post.scope === 'followers') {
    return ctx.deps.db.get('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?', [ctx.userId, post.user_id]) != null;
  }
  return post.crew_id != null && myCrewIds(ctx).includes(post.crew_id);
}

function toPostDto(ctx: UserCtx, row: PostRow): PostDto {
  const db = ctx.deps.db;
  const run = row.run_id ? db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [row.run_id]) : undefined;
  const likeCount = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?', [row.id])?.n ?? 0;
  const commentCount =
    db.get<{ n: number }>('SELECT COUNT(*) AS n FROM comments WHERE post_id = ? AND hidden = 0', [row.id])?.n ?? 0;
  const liked = db.get('SELECT 1 AS x FROM post_likes WHERE post_id = ? AND user_id = ?', [row.id, ctx.userId]) != null;
  const crew = row.crew_id ? db.get<{ id: string; name: string }>('SELECT id, name FROM crews WHERE id = ?', [row.crew_id]) : undefined;
  return {
    id: row.id,
    author: userCard(ctx, row.user_id),
    run: run ? toRunDto(run, ctx.userId) : null,
    body: row.body,
    photos: parseJson<string[]>(row.photos, []),
    scope: row.scope,
    region: row.region,
    crew: crew ?? null,
    likeCount,
    commentCount,
    liked,
    isMine: row.user_id === ctx.userId,
    createdAt: row.created_at,
  };
}

function requirePost(ctx: UserCtx, id: string): PostRow {
  const row = ctx.deps.db.get<PostRow>('SELECT * FROM posts WHERE id = ?', [id]);
  if (!row || !canView(ctx, row)) throw notFound('게시글');
  return row;
}

export const feedMethods = {
  'feed.list': query(
    'user',
    z.object({
      tab: z.enum(['region', 'following', 'crew']),
      region: regionSchema.optional(),
      crewId: idSchema.optional(),
      userId: idSchema.optional(),
      cursor: cursorSchema,
      limit: limitSchema,
    }),
    (ctx, input): { items: PostDto[]; nextCursor: string | null } => {
      const db = ctx.deps.db;
      const limit = clampLimit(input.limit, 15, 40);
      const hidden = blockedIds(ctx, ctx.userId);
      const cursor = input.cursor ?? '9999';
      let rows: PostRow[] = [];

      if (input.userId) {
        // 특정 사용자의 게시글 (프로필)
        rows = db
          .all<PostRow>(
            'SELECT * FROM posts WHERE user_id = ? AND hidden = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?',
            [input.userId, cursor, limit * 3],
          )
          .filter((p) => canView(ctx, p));
      } else if (input.tab === 'region') {
        const me = requireUserRow(ctx, ctx.userId);
        // 기본은 내 거주·러닝 지역이 속한 시·도 전체 (초기 사용자가 적어도 피드가 비지 않도록), 필터로 구 단위까지 좁힘
        const regions = input.region
          ? [input.region]
          : Array.from(new Set([me.home_region, ...runRegionsOf(me)].map(regionSido)));
        // 지역 필터는 JS에서 (시·도 전체 키와 하위 지역을 함께 매칭하기 위해)
        let scanCursor = cursor;
        for (let page = 0; page < 6 && rows.length < limit + 1; page++) {
          const batch = db.all<PostRow>(
            `SELECT * FROM posts WHERE scope = 'region' AND hidden = 0 AND created_at < ? ORDER BY created_at DESC LIMIT 200`,
            [scanCursor],
          );
          if (batch.length === 0) break;
          rows.push(...batch.filter((p) => !hidden.has(p.user_id) && matchesAnyRegion(p.region, regions)));
          scanCursor = batch.at(-1)!.created_at;
        }
      } else if (input.tab === 'following') {
        const ids = [...followingIds(db, ctx.userId), ctx.userId].filter((id) => !hidden.has(id));
        rows = db.all<PostRow>(
          `SELECT * FROM posts WHERE user_id IN (${placeholders(ids.length)}) AND scope IN ('region', 'followers')
           AND hidden = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
          [...ids, cursor, limit + 1],
        );
      } else {
        const crews = input.crewId ? [input.crewId] : myCrewIds(ctx);
        if (input.crewId && !myCrewIds(ctx).includes(input.crewId)) throw forbidden('크루 멤버만 볼 수 있어요');
        if (crews.length > 0) {
          rows = db
            .all<PostRow>(
              `SELECT * FROM posts WHERE scope = 'crew' AND crew_id IN (${placeholders(crews.length)}) AND hidden = 0
               AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
              [...crews, cursor, limit + 1],
            )
            .filter((p) => !hidden.has(p.user_id));
        }
      }
      const page = rows.slice(0, limit);
      return {
        items: page.map((r) => toPostDto(ctx, r)),
        nextCursor: rows.length > limit ? page.at(-1)!.created_at : null,
      };
    },
  ),

  'feed.get': query('user', z.object({ id: idSchema }), (ctx, { id }): PostDto => toPostDto(ctx, requirePost(ctx, id))),

  'feed.create': mutation(
    'user',
    z.object({
      body: z.string().trim().max(1000, '본문은 1000자 이하예요').default(''),
      photos: z.array(dataUrlSchema).max(4, '사진은 4장까지 올릴 수 있어요').default([]),
      runId: idSchema.nullish(),
      scope: z.enum(['region', 'followers', 'crew']),
      crewId: idSchema.nullish(),
      region: z.string().optional(),
    }),
    async (ctx, input): Promise<PostDto> => {
      const db = ctx.deps.db;
      const me = requireUserRow(ctx, ctx.userId);
      if (!input.body && input.photos.length === 0 && !input.runId) throw invalid('기록, 사진, 글 중 하나는 있어야 해요');
      if (containsBibTrade(input.body)) throw invalid(BIB_TRADE_MESSAGE);
      if (input.runId) {
        const run = db.get<RunRow>('SELECT * FROM runs WHERE id = ?', [input.runId]);
        if (!run || run.user_id !== ctx.userId) throw invalid('내 기록만 첨부할 수 있어요');
      }
      if (input.scope === 'crew') {
        if (!input.crewId || !myCrewIds(ctx).includes(input.crewId)) throw forbidden('가입한 크루에만 올릴 수 있어요');
      }
      const region =
        input.region && [me.home_region, ...runRegionsOf(me)].some((r) => regionsOverlap(r, input.region!))
          ? input.region
          : me.home_region;
      const photos: string[] = [];
      for (const p of input.photos) photos.push(await ctx.deps.media.save(p, ctx.userId));
      const id = newId('pst');
      db.run(
        `INSERT INTO posts (id, user_id, run_id, body, photos, scope, region, crew_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ctx.userId, input.runId ?? null, input.body, toJson(photos), input.scope, region, input.scope === 'crew' ? input.crewId : null, nowIso(ctx)],
      );
      return toPostDto(ctx, db.get<PostRow>('SELECT * FROM posts WHERE id = ?', [id])!);
    },
  ),

  'feed.delete': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    const row = db.get<PostRow>('SELECT * FROM posts WHERE id = ?', [id]);
    if (!row) throw notFound('게시글');
    if (row.user_id !== ctx.userId) throw forbidden();
    db.transaction(() => {
      db.run('DELETE FROM post_likes WHERE post_id = ?', [id]);
      db.run('DELETE FROM comments WHERE post_id = ?', [id]);
      db.run('DELETE FROM posts WHERE id = ?', [id]);
    });
    return { ok: true };
  }),

  'feed.like': mutation('user', z.object({ id: idSchema, like: z.boolean() }), (ctx, { id, like }) => {
    const db = ctx.deps.db;
    const post = requirePost(ctx, id);
    if (like) {
      const res = db.run('INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)', [id, ctx.userId, nowIso(ctx)]);
      if (res.changes > 0 && post.user_id !== ctx.userId) {
        const me = requireUserRow(ctx, ctx.userId);
        notify(ctx, post.user_id, {
          type: 'like',
          category: 'social',
          title: `${me.nickname}님이 회원님의 러닝을 응원해요`,
          link: `/posts/${id}`,
          dedupeKey: `like:${id}:${ctx.userId}`,
        });
      }
    } else {
      db.run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, ctx.userId]);
    }
    const likeCount = db.get<{ n: number }>('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?', [id])?.n ?? 0;
    return { liked: like, likeCount };
  }),

  'feed.comments': query('user', z.object({ postId: idSchema }), (ctx, { postId }): CommentDto[] => {
    requirePost(ctx, postId);
    const hidden = blockedIds(ctx, ctx.userId);
    return ctx.deps.db
      .all<{ id: string; post_id: string; user_id: string; body: string; created_at: string }>(
        'SELECT * FROM comments WHERE post_id = ? AND hidden = 0 ORDER BY created_at ASC LIMIT 300',
        [postId],
      )
      .filter((c) => !hidden.has(c.user_id))
      .map((c) => ({
        id: c.id,
        postId: c.post_id,
        author: userCard(ctx, c.user_id),
        body: c.body,
        isMine: c.user_id === ctx.userId,
        createdAt: c.created_at,
      }));
  }),

  'feed.comment': mutation(
    'user',
    z.object({ postId: idSchema, body: z.string().trim().min(1, '댓글을 입력해 주세요').max(300, '댓글은 300자 이하예요') }),
    (ctx, input): CommentDto => {
      const db = ctx.deps.db;
      const post = requirePost(ctx, input.postId);
      if (containsBibTrade(input.body)) throw invalid(BIB_TRADE_MESSAGE);
      if (blockedIds(ctx, ctx.userId).has(post.user_id)) throw new AppError('FORBIDDEN', '댓글을 달 수 없어요');
      const id = newId('cmt');
      const ts = nowIso(ctx);
      db.run('INSERT INTO comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)', [id, input.postId, ctx.userId, input.body, ts]);
      if (post.user_id !== ctx.userId) {
        const me = requireUserRow(ctx, ctx.userId);
        notify(ctx, post.user_id, {
          type: 'comment',
          category: 'social',
          title: `${me.nickname}님이 댓글을 남겼어요`,
          body: input.body.slice(0, 60),
          link: `/posts/${input.postId}`,
        });
      }
      return { id, postId: input.postId, author: userCard(ctx, ctx.userId), body: input.body, isMine: true, createdAt: ts };
    },
  ),

  'feed.deleteComment': mutation('user', z.object({ id: idSchema }), (ctx, { id }) => {
    const db = ctx.deps.db;
    const c = db.get<{ user_id: string; post_id: string }>('SELECT user_id, post_id FROM comments WHERE id = ?', [id]);
    if (!c) throw notFound('댓글');
    const post = db.get<PostRow>('SELECT * FROM posts WHERE id = ?', [c.post_id]);
    if (c.user_id !== ctx.userId && post?.user_id !== ctx.userId) throw forbidden();
    db.run('DELETE FROM comments WHERE id = ?', [id]);
    return { ok: true };
  }),
};
