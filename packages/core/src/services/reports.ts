/** 신고와 운영자 처리 */
import { z } from 'zod';
import type { ReportDto } from '../domain/dto.ts';
import { mutation, query, type Ctx } from '../rpc/define.ts';
import { conflict, invalid, notFound } from '../util/errors.ts';
import { newId } from '../util/ids.ts';
import { notify, nowIso, userCard } from './common.ts';
import { idSchema } from './schemas.ts';

export const REPORT_TARGETS = ['user', 'post', 'comment', 'flash_run', 'crew', 'mate_post'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = {
  spam: '스팸·광고',
  abuse: '욕설·비하',
  harassment: '괴롭힘·스토킹',
  dating: '러닝과 무관한 만남 목적',
  bib_trading: '배번(참가권) 거래',
  unsafe: '안전을 위협하는 행동',
  no_show_dispute: '노쇼 기록 이의 제기',
  other: '기타',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** 서로 다른 신고자 수가 이 이상이면 운영자 확인 전까지 콘텐츠를 숨김 */
const AUTO_HIDE_THRESHOLD = 3;

interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  target_user_id: string | null;
  reason: ReportReason;
  detail: string;
  status: 'open' | 'upheld' | 'dismissed';
  resolution: string | null;
  created_at: string;
}

function targetInfo(ctx: Ctx, type: ReportTarget, id: string): { userId: string | null; preview: string } | null {
  const db = ctx.deps.db;
  switch (type) {
    case 'user': {
      const u = db.get<{ id: string; nickname: string }>('SELECT id, nickname FROM users WHERE id = ?', [id]);
      return u ? { userId: u.id, preview: `사용자 ${u.nickname}` } : null;
    }
    case 'post': {
      const p = db.get<{ user_id: string; body: string }>('SELECT user_id, body FROM posts WHERE id = ?', [id]);
      return p ? { userId: p.user_id, preview: p.body.slice(0, 80) || '(사진·기록 게시글)' } : null;
    }
    case 'comment': {
      const c = db.get<{ user_id: string; body: string }>('SELECT user_id, body FROM comments WHERE id = ?', [id]);
      return c ? { userId: c.user_id, preview: c.body.slice(0, 80) } : null;
    }
    case 'flash_run': {
      const f = db.get<{ host_id: string; title: string }>('SELECT host_id, title FROM flash_runs WHERE id = ?', [id]);
      return f ? { userId: f.host_id, preview: `번개 '${f.title}'` } : null;
    }
    case 'crew': {
      const c = db.get<{ leader_id: string; name: string }>('SELECT leader_id, name FROM crews WHERE id = ?', [id]);
      return c ? { userId: c.leader_id, preview: `크루 '${c.name}'` } : null;
    }
    case 'mate_post': {
      const m = db.get<{ user_id: string; title: string }>('SELECT user_id, title FROM mate_posts WHERE id = ?', [id]);
      return m ? { userId: m.user_id, preview: `메이트 모집 '${m.title}'` } : null;
    }
  }
}

function setHidden(ctx: Ctx, type: ReportTarget, id: string, hidden: boolean): void {
  const table = type === 'post' ? 'posts' : type === 'comment' ? 'comments' : type === 'mate_post' ? 'mate_posts' : null;
  if (table) ctx.deps.db.run(`UPDATE ${table} SET hidden = ? WHERE id = ?`, [hidden, id]);
}

export const reportMethods = {
  'reports.create': mutation(
    'user',
    z.object({
      targetType: z.enum(REPORT_TARGETS),
      targetId: idSchema,
      reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]),
      detail: z.string().trim().max(500).default(''),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const info = targetInfo(ctx, input.targetType, input.targetId);
      if (!info) throw notFound('신고 대상');
      if (info.userId === ctx.userId && input.reason !== 'no_show_dispute') throw invalid('내 콘텐츠는 신고할 수 없어요');
      const dup = db.get(
        `SELECT 1 AS x FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`,
        [ctx.userId, input.targetType, input.targetId],
      );
      if (dup) throw conflict('이미 신고했어요. 운영팀이 확인 중이에요');
      db.run(
        `INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId('rpt'),
          ctx.userId,
          input.targetType,
          input.targetId,
          // 노쇼 이의 제기는 호스트를 제재하려는 신고가 아니므로 신뢰 점수에 반영하지 않음
          input.reason === 'no_show_dispute' ? null : info.userId,
          input.reason,
          input.detail,
          nowIso(ctx),
        ],
      );
      const reporters = db.get<{ n: number }>(
        `SELECT COUNT(DISTINCT reporter_id) AS n FROM reports WHERE target_type = ? AND target_id = ? AND status = 'open'`,
        [input.targetType, input.targetId],
      )?.n ?? 0;
      const autoHidden = reporters >= AUTO_HIDE_THRESHOLD && ['post', 'comment', 'mate_post'].includes(input.targetType);
      if (autoHidden) setHidden(ctx, input.targetType, input.targetId, true);
      return { ok: true, autoHidden };
    },
  ),

  'reports.list': query(
    'admin',
    z.object({ status: z.enum(['open', 'upheld', 'dismissed', 'all']).default('open') }),
    (ctx, input): ReportDto[] =>
      ctx.deps.db
        .all<ReportRow>(
          `SELECT * FROM reports ${input.status === 'all' ? '' : 'WHERE status = ?'} ORDER BY created_at DESC LIMIT 200`,
          input.status === 'all' ? [] : [input.status],
        )
        .map((r) => ({
          id: r.id,
          reporter: userCard(ctx, r.reporter_id),
          targetType: r.target_type,
          targetId: r.target_id,
          targetUser: r.target_user_id ? userCard(ctx, r.target_user_id) : null,
          targetPreview: targetInfo(ctx, r.target_type, r.target_id)?.preview ?? '(삭제된 대상)',
          reason: REPORT_REASONS[r.reason] ?? r.reason,
          detail: r.detail,
          status: r.status,
          resolution: r.resolution,
          createdAt: r.created_at,
        })),
  ),

  'reports.resolve': mutation(
    'admin',
    z.object({
      id: idSchema,
      action: z.enum(['uphold', 'dismiss']),
      resolution: z.string().trim().min(2, '처리 내용을 입력해 주세요').max(300),
      hideContent: z.boolean().default(false),
      suspendUser: z.boolean().default(false),
    }),
    (ctx, input) => {
      const db = ctx.deps.db;
      const r = db.get<ReportRow>('SELECT * FROM reports WHERE id = ?', [input.id]);
      if (!r) throw notFound('신고');
      if (r.status !== 'open') throw invalid('이미 처리한 신고예요');
      const status = input.action === 'uphold' ? 'upheld' : 'dismissed';
      db.transaction(() => {
        db.run('UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?', [
          status,
          input.resolution,
          ctx.userId,
          nowIso(ctx),
          r.id,
        ]);
        if (input.action === 'uphold' && input.hideContent) setHidden(ctx, r.target_type, r.target_id, true);
        if (input.action === 'dismiss') {
          const stillOpen = db.get(`SELECT 1 AS x FROM reports WHERE target_type = ? AND target_id = ? AND status = 'open'`, [r.target_type, r.target_id]);
          const upheld = db.get(`SELECT 1 AS x FROM reports WHERE target_type = ? AND target_id = ? AND status = 'upheld'`, [r.target_type, r.target_id]);
          if (!stillOpen && !upheld) setHidden(ctx, r.target_type, r.target_id, false);
        }
        if (input.action === 'uphold' && input.suspendUser && r.target_user_id) {
          db.run(`UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ? AND role <> 'admin'`, [nowIso(ctx), r.target_user_id]);
        }
        if (input.action === 'uphold' && r.reason === 'no_show_dispute' && r.target_type === 'flash_run') {
          // 노쇼 이의 인정: 신고자의 노쇼 기록을 참석으로 정정
          db.run(`UPDATE flash_run_participants SET status = 'attended' WHERE flash_run_id = ? AND user_id = ? AND status = 'no_show'`, [
            r.target_id,
            r.reporter_id,
          ]);
        }
      });
      notify(ctx, r.reporter_id, {
        type: 'report.resolved',
        category: 'system',
        title: '신고하신 내용을 처리했어요',
        body: input.resolution,
      });
      return { ok: true };
    },
  ),
};
