export type StartAlertRecord = {
  id: string;
  exhibition_id: string;
  user_id: string;
  notify_days_before: number;
  sent_at: string | null;
  created_at: string;
};

export function parseStartAlertPayload(
  input: unknown,
): { ok: true; exhibitionId: string; notifyDaysBefore: number } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const body = input as Record<string, unknown>;
  const exhibitionId = typeof body.exhibitionId === 'string' ? body.exhibitionId.trim() : '';
  if (!exhibitionId) {
    return { ok: false, error: '전시 ID가 필요합니다.' };
  }

  const rawDays = body.notifyDaysBefore;
  const parsedDays = rawDays === undefined || rawDays === null || rawDays === '' ? 1 : Number(rawDays);
  if (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 30) {
    return { ok: false, error: 'notifyDaysBefore는 0~30 사이 정수여야 합니다.' };
  }

  return {
    ok: true,
    exhibitionId,
    notifyDaysBefore: parsedDays,
  };
}

export function getStartAlertExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
