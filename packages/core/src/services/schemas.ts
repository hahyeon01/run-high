/** 입력 검증 스키마 (오류 메시지는 화면에 그대로 보여줄 수 있게 한국어로) */
import { z } from 'zod';
import { isValidRegion } from '../domain/regions.ts';
import { isValidDateString } from '../util/time.ts';

export const idSchema = z.string().min(1, '잘못된 요청이에요').max(64);

export const regionSchema = z.string().refine(isValidRegion, '지역을 다시 선택해 주세요');

export const runRegionsSchema = z
  .array(regionSchema)
  .min(1, '러닝 가능 지역을 1곳 이상 선택해 주세요')
  .max(5, '러닝 가능 지역은 5곳까지 선택할 수 있어요')
  .transform((list) => Array.from(new Set(list)));

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, '닉네임은 2자 이상이에요')
  .max(12, '닉네임은 12자 이하예요')
  .regex(/^[가-힣a-zA-Z0-9_]+$/, '닉네임은 한글, 영문, 숫자, _만 쓸 수 있어요');

export const emailSchema = z.string().trim().toLowerCase().email('이메일 형식을 확인해 주세요').max(120);

export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 8자 이상이에요')
  .max(64, '비밀번호는 64자 이하예요')
  .regex(/[A-Za-z]/, '비밀번호에 영문을 포함해 주세요')
  .regex(/[0-9]/, '비밀번호에 숫자를 포함해 주세요');

export const birthDateSchema = z.string().refine(isValidDateString, '생년월일을 YYYY-MM-DD 형식으로 입력해 주세요');

export const genderSchema = z.enum(['male', 'female'], { error: '성별을 선택해 주세요' });

export const avatarSchema = z.object({
  emoji: z.string().min(1).max(8),
  color: z.enum(['violet', 'sky', 'mint', 'peach', 'yellow', 'pink', 'navy']),
});

export const privacySchema = z.object({
  age: z.enum(['exact', 'decade', 'hidden']),
  gender: z.enum(['public', 'hidden']),
  stats: z.enum(['public', 'on_apply', 'private']),
  records: z.enum(['public', 'followers', 'private']),
});

/** 페이스 (초/km): 2'30" ~ 15'00" */
export const paceSchema = z
  .number({ error: '페이스를 입력해 주세요' })
  .int()
  .min(150, "페이스는 2'30\" 이상이에요")
  .max(900, "페이스는 15'00\" 이하예요");

export const distanceKmSchema = z
  .number({ error: '거리를 입력해 주세요' })
  .min(1, '거리는 1km 이상이에요')
  .max(100, '거리는 100km 이하예요');

export const meetingPlaceSchema = z.object({
  placeId: z.string().max(64).nullish(),
  name: z.string().trim().min(2, '집결 장소 이름을 입력해 주세요').max(40),
  address: z.string().trim().max(120).optional(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  detail: z.string().trim().max(60).optional(),
});

export const isoDateTimeSchema = z.string().refine((s) => !Number.isNaN(Date.parse(s)), '날짜·시간을 확인해 주세요');

export const cursorSchema = z.string().max(80).optional();

export const dataUrlSchema = z
  .string()
  .max(6_000_000, '사진 용량이 너무 커요')
  .regex(/^data:image\/(jpeg|png|webp);base64,/, '이미지 파일만 올릴 수 있어요');

export const limitSchema = z.number().int().min(1).max(100).optional();
