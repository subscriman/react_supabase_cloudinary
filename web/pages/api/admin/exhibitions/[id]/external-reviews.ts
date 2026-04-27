import type { NextApiRequest, NextApiResponse } from 'next';
import {
  parseAdminExternalReviewPayload,
  type AdminExternalReviewRow,
} from '../../../../../lib/admin-exhibitions';
import { sendApiError, sendApiSuccess } from '../../../../../lib/api-response';
import { createSupabaseServerClient, getBearerTokenFromHeader } from '../../../../../lib/supabase-server';

type ErrorResponse = { error: string; errorCode: string };
type SuccessResponse = {
  data:
    | { reviews: AdminExternalReviewRow[] }
    | { review: AdminExternalReviewRow }
    | { deletedId: string };
};

type AdminUserContext = {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
};

function getExhibitionId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getReviewId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidate = (body as Record<string, unknown>).reviewId;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function requireAdmin(req: NextApiRequest): Promise<AdminUserContext | null> {
  const accessToken = getBearerTokenFromHeader(req.headers.authorization);
  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseServerClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || profileData?.role !== 'admin') {
    return null;
  }

  return {
    supabase,
    userId: authData.user.id,
  };
}

async function ensureExhibitionExists(supabase: AdminUserContext['supabase'], exhibitionId: string): Promise<boolean> {
  const { data, error } = await supabase.from('exhibitions').select('id').eq('id', exhibitionId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

async function listExternalReviews(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
  exhibitionId: string,
  context: AdminUserContext,
) {
  const { data, error } = await context.supabase
    .from('exhibition_external_reviews')
    .select('id, exhibition_id, title, source_name, url, summary, sort_order, is_hidden, created_by, created_at, updated_at')
    .eq('exhibition_id', exhibitionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return sendApiError(res, 400, 'BAD_REQUEST', error.message);
  }

  return sendApiSuccess(res, 200, { reviews: (data ?? []) as AdminExternalReviewRow[] });
}

async function createExternalReview(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
  exhibitionId: string,
  context: AdminUserContext,
) {
  const parsed = parseAdminExternalReviewPayload(req.body);
  if (!parsed.ok) {
    const errorMessage = 'error' in parsed ? parsed.error : '요청 값이 올바르지 않습니다.';
    return sendApiError(res, 400, 'INVALID_INPUT', errorMessage);
  }

  const payload = parsed.value;
  const { data, error } = await context.supabase
    .from('exhibition_external_reviews')
    .insert({
      exhibition_id: exhibitionId,
      title: payload.title,
      source_name: payload.sourceName,
      url: payload.url,
      summary: payload.summary,
      sort_order: payload.sortOrder,
      is_hidden: payload.isHidden,
      created_by: context.userId,
    })
    .select('id, exhibition_id, title, source_name, url, summary, sort_order, is_hidden, created_by, created_at, updated_at')
    .maybeSingle();

  if (error) {
    return sendApiError(res, 400, 'BAD_REQUEST', error.message);
  }
  if (!data) {
    return sendApiError(res, 500, 'INTERNAL_ERROR', '외부 후기를 저장하지 못했습니다.');
  }

  return sendApiSuccess(res, 201, { review: data as AdminExternalReviewRow });
}

async function updateExternalReview(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
  exhibitionId: string,
  context: AdminUserContext,
) {
  const reviewId = getReviewId(req.body);
  if (!reviewId) {
    return sendApiError(res, 400, 'INVALID_INPUT', 'reviewId가 필요합니다.');
  }

  const parsed = parseAdminExternalReviewPayload(req.body);
  if (!parsed.ok) {
    const errorMessage = 'error' in parsed ? parsed.error : '요청 값이 올바르지 않습니다.';
    return sendApiError(res, 400, 'INVALID_INPUT', errorMessage);
  }

  const payload = parsed.value;
  const { data, error } = await context.supabase
    .from('exhibition_external_reviews')
    .update({
      title: payload.title,
      source_name: payload.sourceName,
      url: payload.url,
      summary: payload.summary,
      sort_order: payload.sortOrder,
      is_hidden: payload.isHidden,
    })
    .eq('id', reviewId)
    .eq('exhibition_id', exhibitionId)
    .select('id, exhibition_id, title, source_name, url, summary, sort_order, is_hidden, created_by, created_at, updated_at')
    .maybeSingle();

  if (error) {
    return sendApiError(res, 400, 'BAD_REQUEST', error.message);
  }
  if (!data) {
    return sendApiError(res, 404, 'NOT_FOUND', '수정할 외부 후기를 찾지 못했습니다.');
  }

  return sendApiSuccess(res, 200, { review: data as AdminExternalReviewRow });
}

async function deleteExternalReview(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
  exhibitionId: string,
  context: AdminUserContext,
) {
  const reviewId = getReviewId(req.body);
  if (!reviewId) {
    return sendApiError(res, 400, 'INVALID_INPUT', 'reviewId가 필요합니다.');
  }

  const { data, error } = await context.supabase
    .from('exhibition_external_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('exhibition_id', exhibitionId)
    .select('id')
    .maybeSingle();

  if (error) {
    return sendApiError(res, 400, 'BAD_REQUEST', error.message);
  }
  if (!data) {
    return sendApiError(res, 404, 'NOT_FOUND', '삭제할 외부 후기를 찾지 못했습니다.');
  }

  return sendApiSuccess(res, 200, { deletedId: data.id as string });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | SuccessResponse>,
) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const exhibitionId = getExhibitionId(req.query.id);
  if (!exhibitionId) {
    return sendApiError(res, 400, 'INVALID_INPUT', '전시 ID가 필요합니다.');
  }

  try {
    const context = await requireAdmin(req);
    if (!context) {
      return sendApiError(res, 403, 'FORBIDDEN', '관리자만 처리할 수 있습니다.');
    }

    const exhibitionExists = await ensureExhibitionExists(context.supabase, exhibitionId);
    if (!exhibitionExists) {
      return sendApiError(res, 404, 'NOT_FOUND', '전시를 찾을 수 없습니다.');
    }

    if (req.method === 'GET') {
      return listExternalReviews(req, res, exhibitionId, context);
    }
    if (req.method === 'POST') {
      return createExternalReview(req, res, exhibitionId, context);
    }
    if (req.method === 'PATCH') {
      return updateExternalReview(req, res, exhibitionId, context);
    }
    return deleteExternalReview(req, res, exhibitionId, context);
  } catch (error) {
    return sendApiError(
      res,
      500,
      'INTERNAL_ERROR',
      mapUnknownError(error, '외부 후기 큐레이션 처리 중 오류가 발생했습니다.'),
    );
  }
}
