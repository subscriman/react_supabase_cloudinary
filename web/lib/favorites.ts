export type FavoriteRecord = {
  id: string;
  exhibition_id: string;
  user_id: string;
  created_at: string;
};

export function parseFavoritePayload(input: unknown): { ok: true; exhibitionId: string } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const exhibitionId = typeof body.exhibitionId === 'string' ? body.exhibitionId.trim() : '';
  if (!exhibitionId) {
    return { ok: false, error: '전시 ID가 필요합니다.' };
  }

  return { ok: true, exhibitionId };
}

export function getFavoriteExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
