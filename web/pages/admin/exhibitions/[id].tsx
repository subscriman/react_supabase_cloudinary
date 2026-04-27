import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import AdminSubNav from '../../../components/AdminSubNav';
import AuthTopBar from '../../../components/AuthTopBar';
import { useAuthSession } from '../../../hooks/useAuthSession';
import { aiDecisionLabel, extractAiReview, formatConfidencePercent, type AiReviewResult } from '../../../lib/admin-ai-review';
import {
  rowToUpdatePayload,
  type AdminExternalReviewRow,
  type AdminExhibitionEditableRow,
  type AdminExhibitionUpdatePayload,
} from '../../../lib/admin-exhibitions';
import { trackEvent } from '../../../lib/analytics';
import { formatDateOnlyLocal, formatDateTimeLocal } from '../../../lib/date-time';
import { supabase } from '../../../lib/supabase';

type ModerationAction = 'approve' | 'reject' | 'hold';

type AdminPageMeta = {
  venueName: string;
  venueCity: string | null;
  sourceSiteName: string | null;
  sourceListUrl: string | null;
};

type TagOption = {
  id: string;
  name: string;
  type: string;
};

type LoadRow = AdminExhibitionEditableRow & {
  source_site_id: string | null;
  source_external_id: string | null;
  venues:
    | {
        name?: string | null;
        city?: string | null;
      }
    | Array<{
        name?: string | null;
        city?: string | null;
      }>
    | null;
  source_sites:
    | {
        name?: string | null;
        list_url?: string | null;
      }
    | Array<{
        name?: string | null;
        list_url?: string | null;
      }>
    | null;
};

type RawAiReviewRow = {
  id: string;
  status: string;
  raw_payload: unknown;
  normalized_payload: unknown;
  created_at: string;
  updated_at: string;
};

type UpdateApiResponse = {
  data?: {
    exhibition?: AdminExhibitionEditableRow;
  };
  exhibition?: AdminExhibitionEditableRow;
  error?: string;
};

type ModerateApiResponse = {
  data?: {
    exhibition?: {
      id: string;
      status: string;
      published_at: string | null;
      updated_at: string;
    };
  };
  exhibition?: {
    id: string;
    status: string;
    published_at: string | null;
    updated_at: string;
  };
  error?: string;
};

type TagsApiResponse = {
  data?: {
    tagIds?: string[];
  };
  tagIds?: string[];
  error?: string;
};

type ExternalReviewsApiResponse = {
  data?: {
    reviews?: AdminExternalReviewRow[];
    review?: AdminExternalReviewRow;
    deletedId?: string;
  };
  reviews?: AdminExternalReviewRow[];
  review?: AdminExternalReviewRow;
  deletedId?: string;
  error?: string;
};

type ExternalReviewFormState = {
  title: string;
  sourceName: string;
  url: string;
  summary: string;
  sortOrder: string;
  isHidden: boolean;
};

const DEFAULT_EXTERNAL_REVIEW_FORM: ExternalReviewFormState = {
  title: '',
  sourceName: '',
  url: '',
  summary: '',
  sortOrder: '100',
  isHidden: false,
};

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayNullable(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function formatDate(date: string): string {
  return formatDateOnlyLocal(date);
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return formatDateTimeLocal(date);
}

function formatQualityScore(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null;
  return `${Math.round(score)}점`;
}

function aiBadgeClass(decision: AiReviewResult['decision']): string {
  if (decision === 'accept') return 'border-lime-700 text-lime-300';
  if (decision === 'reject') return 'border-rose-800 text-rose-300';
  return 'border-amber-700 text-amber-300';
}

function sortExternalReviews(items: AdminExternalReviewRow[]): AdminExternalReviewRow[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return b.created_at.localeCompare(a.created_at);
  });
}

export default function AdminExhibitionDetailPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const exhibitionId = Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '';

  const { user, role, session, loading } = useAuthSession();
  const [exhibition, setExhibition] = useState<AdminExhibitionEditableRow | null>(null);
  const [draft, setDraft] = useState<AdminExhibitionUpdatePayload | null>(null);
  const [meta, setMeta] = useState<AdminPageMeta>({
    venueName: '장소 정보 없음',
    venueCity: null,
    sourceSiteName: null,
    sourceListUrl: null,
  });
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagKeyword, setTagKeyword] = useState('');
  const [externalReviews, setExternalReviews] = useState<AdminExternalReviewRow[]>([]);
  const [externalReviewForm, setExternalReviewForm] = useState<ExternalReviewFormState>(DEFAULT_EXTERNAL_REVIEW_FORM);
  const [editingExternalReviewId, setEditingExternalReviewId] = useState<string | null>(null);
  const [externalReviewSaving, setExternalReviewSaving] = useState(false);
  const [externalReviewDeletingId, setExternalReviewDeletingId] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [aiReviewedAt, setAiReviewedAt] = useState<string | null>(null);
  const [aiRawStatus, setAiRawStatus] = useState<string | null>(null);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!exhibitionId || !user || role !== 'admin') return;

    const load = async () => {
      setFetching(true);
      setError(null);
      setMessage(null);
      setAiReview(null);
      setAiReviewedAt(null);
      setAiRawStatus(null);
      setAiReviewError(null);

      const [detailResult, tagsResult, selectedTagsResult, externalReviewsResult] = await Promise.all([
        supabase
          .from('exhibitions')
          .select(
            `
              id,
              slug,
              title,
              subtitle,
              status,
              source_site_id,
              source_external_id,
              start_date,
              end_date,
              operating_hours,
              admission_fee,
              summary,
              description,
              official_url,
              booking_url,
              poster_image_url,
              updated_at,
              published_at,
              venues (
                name,
                city
              ),
              source_sites (
                name,
                list_url
              )
            `,
          )
          .eq('id', exhibitionId)
          .maybeSingle(),
        supabase.from('tags').select('id, name, type').order('name', { ascending: true }).limit(300),
        supabase.from('exhibition_tags').select('tag_id').eq('exhibition_id', exhibitionId),
        supabase
          .from('exhibition_external_reviews')
          .select(
            'id, exhibition_id, title, source_name, url, summary, sort_order, is_hidden, created_by, created_at, updated_at',
          )
          .eq('exhibition_id', exhibitionId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false }),
      ]);

      if (detailResult.error) {
        setError(detailResult.error.message);
        setFetching(false);
        return;
      }
      if (tagsResult.error) {
        setError(tagsResult.error.message);
        setFetching(false);
        return;
      }
      if (selectedTagsResult.error) {
        setError(selectedTagsResult.error.message);
        setFetching(false);
        return;
      }
      if (externalReviewsResult.error) {
        setError(externalReviewsResult.error.message);
        setFetching(false);
        return;
      }

      if (!detailResult.data) {
        setError('전시를 찾지 못했습니다.');
        setFetching(false);
        return;
      }

      const row = detailResult.data as LoadRow;
      const venue = pickRelation(row.venues);
      const sourceSite = pickRelation(row.source_sites);
      const normalizedRow: AdminExhibitionEditableRow = {
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle,
        status: row.status,
        start_date: row.start_date,
        end_date: row.end_date,
        operating_hours: row.operating_hours,
        admission_fee: row.admission_fee,
        summary: row.summary,
        description: row.description,
        official_url: row.official_url,
        booking_url: row.booking_url,
        poster_image_url: row.poster_image_url,
        updated_at: row.updated_at,
        published_at: row.published_at,
      };

      setExhibition(normalizedRow);
      setDraft(rowToUpdatePayload(normalizedRow));
      setMeta({
        venueName: venue?.name ?? '장소 정보 없음',
        venueCity: venue?.city ?? null,
        sourceSiteName: sourceSite?.name ?? null,
        sourceListUrl: sourceSite?.list_url ?? null,
      });

      if (row.source_site_id && row.source_external_id) {
        const { data: rawItemData, error: rawItemError } = await supabase
          .from('ingestion_raw_items')
          .select('id, status, raw_payload, normalized_payload, created_at, updated_at')
          .eq('source_site_id', row.source_site_id)
          .eq('source_external_id', row.source_external_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rawItemError) {
          setAiReviewError(rawItemError.message);
        } else if (rawItemData) {
          const rawItem = rawItemData as RawAiReviewRow;
          setAiReview(extractAiReview(rawItem.normalized_payload, rawItem.raw_payload));
          setAiReviewedAt(rawItem.updated_at ?? rawItem.created_at ?? null);
          setAiRawStatus(rawItem.status ?? null);
        }
      }

      const tagOptions = (tagsResult.data ?? []).map((tag: any) => ({
        id: tag.id as string,
        name: tag.name as string,
        type: tag.type as string,
      }));
      const currentTagIds = Array.from(
        new Set((selectedTagsResult.data ?? []).map((item: any) => item.tag_id as string)),
      );
      setAvailableTags(tagOptions);
      setSelectedTagIds(currentTagIds);
      setExternalReviews(sortExternalReviews((externalReviewsResult.data ?? []) as AdminExternalReviewRow[]));
      setExternalReviewForm(DEFAULT_EXTERNAL_REVIEW_FORM);
      setEditingExternalReviewId(null);
      setFetching(false);
    };

    load();
  }, [exhibitionId, role, user]);

  const comparisons = useMemo(() => {
    if (!exhibition || !draft) return [];
    const beforePeriod = `${exhibition.start_date} ~ ${exhibition.end_date}`;
    const afterPeriod = `${draft.startDate} ~ ${draft.endDate}`;

    return [
      { key: 'title', label: '전시 제목', before: exhibition.title, after: draft.title },
      { key: 'subtitle', label: '부제목', before: exhibition.subtitle ?? '', after: draft.subtitle ?? '' },
      { key: 'period', label: '전시 기간', before: beforePeriod, after: afterPeriod },
      {
        key: 'operatingHours',
        label: '운영 시간',
        before: exhibition.operating_hours ?? '',
        after: draft.operatingHours ?? '',
      },
      {
        key: 'admissionFee',
        label: '관람료',
        before: exhibition.admission_fee ?? '',
        after: draft.admissionFee ?? '',
      },
      { key: 'summary', label: '요약', before: exhibition.summary ?? '', after: draft.summary ?? '' },
      {
        key: 'description',
        label: '전시 소개',
        before: exhibition.description ?? '',
        after: draft.description ?? '',
      },
      {
        key: 'officialUrl',
        label: '공식 링크',
        before: exhibition.official_url ?? '',
        after: draft.officialUrl ?? '',
      },
      {
        key: 'bookingUrl',
        label: '예매 링크',
        before: exhibition.booking_url ?? '',
        after: draft.bookingUrl ?? '',
      },
      {
        key: 'posterImageUrl',
        label: '포스터 이미지 URL',
        before: exhibition.poster_image_url ?? '',
        after: draft.posterImageUrl ?? '',
      },
    ].map((item) => ({
      ...item,
      changed: displayNullable(item.before) !== displayNullable(item.after),
    }));
  }, [draft, exhibition]);

  const changedCount = comparisons.filter((item) => item.changed).length;
  const filteredTags = useMemo(() => {
    const keyword = tagKeyword.trim().toLowerCase();
    if (keyword.length === 0) return availableTags;
    return availableTags.filter((tag) => {
      return tag.name.toLowerCase().includes(keyword) || tag.type.toLowerCase().includes(keyword);
    });
  }, [availableTags, tagKeyword]);

  const onDraftChange =
    (
      key:
        | 'subtitle'
        | 'operatingHours'
        | 'admissionFee'
        | 'officialUrl'
        | 'bookingUrl'
        | 'posterImageUrl'
        | 'summary'
        | 'description',
    ) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [key]: value.length === 0 ? null : value,
        };
      });
    };

  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        title: value,
      };
    });
  };

  const onDateChange =
    (key: 'startDate' | 'endDate') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [key]: value,
        };
      });
    };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const handleSaveTags = async () => {
    if (!session?.access_token || !exhibitionId) {
      setError('태그 저장에 필요한 정보가 부족합니다.');
      return;
    }

    setTagSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tagIds: selectedTagIds,
        }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as TagsApiResponse;
      const tagIds = body.data?.tagIds ?? body.tagIds;
      if (!response.ok || !tagIds) {
        setError(body.error ?? '태그 저장에 실패했습니다.');
        return;
      }

      setSelectedTagIds(tagIds);
      setMessage('태그를 저장했습니다.');
    } finally {
      setTagSaving(false);
    }
  };

  const onExternalReviewFormChange =
    (key: 'title' | 'sourceName' | 'url' | 'summary' | 'sortOrder') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setExternalReviewForm((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

  const onExternalReviewHiddenChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setExternalReviewForm((prev) => ({
      ...prev,
      isHidden: checked,
    }));
  };

  const resetExternalReviewForm = () => {
    setExternalReviewForm(DEFAULT_EXTERNAL_REVIEW_FORM);
    setEditingExternalReviewId(null);
  };

  const handleSaveExternalReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token || !exhibitionId) {
      setError('외부 후기 저장에 필요한 정보가 부족합니다.');
      return;
    }

    const title = externalReviewForm.title.trim();
    const sourceName = externalReviewForm.sourceName.trim();
    const url = externalReviewForm.url.trim();
    const summary = externalReviewForm.summary.trim();
    const sortOrder = Number(externalReviewForm.sortOrder);

    if (!title || !sourceName || !url) {
      setError('후기 제목, 출처 이름, URL은 필수입니다.');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      setError('정렬 순서는 0~9999 범위의 정수여야 합니다.');
      return;
    }

    setExternalReviewSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/external-reviews`, {
        method: editingExternalReviewId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reviewId: editingExternalReviewId,
          title,
          sourceName,
          url,
          summary: summary.length > 0 ? summary : null,
          sortOrder,
          isHidden: externalReviewForm.isHidden,
        }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as ExternalReviewsApiResponse;
      const savedReview = body.data?.review ?? body.review;
      if (!response.ok || !savedReview) {
        setError(body.error ?? '외부 후기 저장에 실패했습니다.');
        return;
      }

      setExternalReviews((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== savedReview.id);
        return sortExternalReviews([savedReview, ...withoutCurrent]);
      });

      const isEdit = Boolean(editingExternalReviewId);
      resetExternalReviewForm();
      setMessage(isEdit ? '외부 후기 링크를 수정했습니다.' : '외부 후기 링크를 추가했습니다.');
    } finally {
      setExternalReviewSaving(false);
    }
  };

  const handleEditExternalReview = (review: AdminExternalReviewRow) => {
    setEditingExternalReviewId(review.id);
    setExternalReviewForm({
      title: review.title,
      sourceName: review.source_name,
      url: review.url,
      summary: review.summary ?? '',
      sortOrder: String(review.sort_order),
      isHidden: review.is_hidden,
    });
    setError(null);
    setMessage(null);
  };

  const handleDeleteExternalReview = async (reviewId: string) => {
    if (!session?.access_token || !exhibitionId) {
      setError('외부 후기 삭제에 필요한 정보가 부족합니다.');
      return;
    }

    setExternalReviewDeletingId(reviewId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/external-reviews`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reviewId,
        }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as ExternalReviewsApiResponse;
      const deletedId = body.data?.deletedId ?? body.deletedId;
      if (!response.ok || !deletedId) {
        setError(body.error ?? '외부 후기 삭제에 실패했습니다.');
        return;
      }

      setExternalReviews((prev) => prev.filter((item) => item.id !== deletedId));
      if (editingExternalReviewId === deletedId) {
        resetExternalReviewForm();
      }
      setMessage('외부 후기 링크를 삭제했습니다.');
    } finally {
      setExternalReviewDeletingId(null);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token || !draft || !exhibitionId) {
      setError('저장에 필요한 정보가 부족합니다.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(draft),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as UpdateApiResponse;
      const exhibitionBody = body.data?.exhibition ?? body.exhibition;
      if (!response.ok || !exhibitionBody) {
        setError(body.error ?? '전시 저장에 실패했습니다.');
        return;
      }

      setExhibition(exhibitionBody);
      setDraft(rowToUpdatePayload(exhibitionBody));
      setMessage('전시 정보를 저장했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleModeration = async (action: ModerationAction) => {
    if (!session?.access_token || !exhibitionId || !exhibition) {
      setError('승인 처리에 필요한 정보가 부족합니다.');
      return;
    }

    setModerating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/exhibitions/${exhibitionId}/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });

      const body = ((await response.json().catch(() => ({}))) ?? {}) as ModerateApiResponse;
      const exhibitionBody = body.data?.exhibition ?? body.exhibition;
      if (!response.ok || !exhibitionBody) {
        setError(body.error ?? '승인 처리에 실패했습니다.');
        return;
      }

      setExhibition((prev) =>
        prev
          ? {
              ...prev,
              status: exhibitionBody.status ?? prev.status,
              published_at: exhibitionBody.published_at ?? prev.published_at,
              updated_at: exhibitionBody.updated_at ?? prev.updated_at,
            }
          : prev,
      );

      trackEvent('admin_approval_action', {
        exhibition_id: exhibition.id,
        action,
        next_status: exhibitionBody.status,
      });
      setMessage(`상태를 ${exhibitionBody.status}로 변경했습니다.`);
    } finally {
      setModerating(false);
    }
  };

  return (
    <>
      <Head>
        <title>관리자 전시 상세 검수 | ArtTomato</title>
        <meta name="description" content="수집 전시 상세 비교 및 수정 화면" />
      </Head>

      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
          <AuthTopBar />

          <header className="mb-6">
            <Link href="/admin/exhibitions" className="text-sm text-zinc-400 hover:text-zinc-200">
              ← 검수 목록으로 돌아가기
            </Link>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-lime-300">Admin Detail</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">수집 상세 비교 및 수정</h1>
            <p className="mt-2 text-sm text-zinc-400">
              원본 저장값과 현재 수정 입력값을 비교하면서 전시 정보를 보정할 수 있습니다.
            </p>
          </header>
          <AdminSubNav />

          {loading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
              세션 확인 중...
            </div>
          ) : !user ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              관리자 페이지는 로그인 후 이용할 수 있습니다.{' '}
              <Link href="/auth" className="underline">
                로그인하러 가기
              </Link>
            </div>
          ) : role !== 'admin' ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
              관리자 권한이 없습니다.
            </div>
          ) : fetching ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
              전시 상세 정보를 불러오는 중...
            </div>
          ) : !exhibition || !draft ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">
              {error ?? '전시 정보를 찾지 못했습니다.'}
            </div>
          ) : (
            <>
              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-medium">{exhibition.title}</h2>
                  <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                    상태: {exhibition.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  장소: {meta.venueName}
                  {meta.venueCity ? ` · ${meta.venueCity}` : ''}
                </p>
                <p className="mt-1 text-xs text-zinc-500">수정 시각: {formatDateTime(exhibition.updated_at)}</p>
                <p className="mt-1 text-xs text-zinc-500">공개 시각: {formatDateTime(exhibition.published_at)}</p>
                {meta.sourceSiteName || meta.sourceListUrl ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    수집 출처: {meta.sourceSiteName ?? '미상'}
                    {meta.sourceListUrl ? (
                      <>
                        {' '}
                        ·{' '}
                        <a href={meta.sourceListUrl} target="_blank" rel="noreferrer" className="underline">
                          목록 링크
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/exhibitions/${exhibition.slug}`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500"
                  >
                    공개 상세 보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleModeration('approve')}
                    disabled={moderating}
                    className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeration('reject')}
                    disabled={moderating}
                    className="rounded-lg border border-rose-900 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-70"
                  >
                    반려
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeration('hold')}
                    disabled={moderating}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                  >
                    보류
                  </button>
                </div>
              </section>

              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-medium">AI 검수 결과</h3>
                  {aiReview ? (
                    <span className={`rounded-full border px-2 py-1 text-xs ${aiBadgeClass(aiReview.decision)}`}>
                      {aiDecisionLabel(aiReview.decision)}
                      {formatConfidencePercent(aiReview.confidence) ? ` · ${formatConfidencePercent(aiReview.confidence)}` : ''}
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-500">검수 데이터 없음</span>
                  )}
                </div>
                {aiReviewError ? (
                  <p className="mb-2 rounded-lg border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
                    AI 검수 조회 실패: {aiReviewError}
                  </p>
                ) : null}
                {aiReview ? (
                  <>
                    <p className="text-xs text-zinc-400">
                      신뢰도: {formatConfidencePercent(aiReview.confidence) ?? '—'} · 품질 점수:{' '}
                      {formatQualityScore(aiReview.qualityScore) ?? '—'}
                      {aiRawStatus ? ` · raw 상태: ${aiRawStatus}` : ''}
                    </p>
                    {aiReview.reasons.length > 0 ? (
                      <p className="mt-2 text-sm text-zinc-200">판단 근거: {aiReview.reasons.join(' / ')}</p>
                    ) : null}
                    {aiReview.rationale ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{aiReview.rationale}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-500">검수 시각: {formatDateTime(aiReviewedAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-400">
                    연결된 수집 raw 데이터에서 AI 검수 메타데이터를 찾지 못했습니다.
                  </p>
                )}
              </section>

              {message ? (
                <div className="mb-4 rounded-xl border border-lime-900 bg-lime-950/40 px-4 py-3 text-sm text-lime-300">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="mb-4 rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-medium">수집 상세 비교</h3>
                  <p className="text-xs text-zinc-400">변경 감지 항목 {changedCount}개</p>
                </div>
                <div className="space-y-2">
                  {comparisons.map((item) => (
                    <article
                      key={item.key}
                      className={`rounded-lg border px-3 py-3 ${
                        item.changed ? 'border-lime-800 bg-lime-950/20' : 'border-zinc-800 bg-zinc-950/50'
                      }`}
                    >
                      <p className="mb-2 text-xs text-zinc-400">{item.label}</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">현재 저장값</p>
                          <p className="whitespace-pre-line text-sm text-zinc-200">{displayNullable(item.before)}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">수정 입력값</p>
                          <p className="whitespace-pre-line text-sm text-zinc-100">{displayNullable(item.after)}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-medium">태그 수동 보정</h3>
                    <p className="mt-1 text-xs text-zinc-400">선택된 태그 {selectedTagIds.length}개</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTags}
                    disabled={tagSaving}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-70"
                  >
                    {tagSaving ? '태그 저장 중...' : '태그 저장'}
                  </button>
                </div>

                <div className="mb-3">
                  <input
                    value={tagKeyword}
                    onChange={(event) => setTagKeyword(event.target.value)}
                    placeholder="태그명 또는 유형 검색"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-lime-400 focus:outline-none"
                  />
                </div>

                {filteredTags.length === 0 ? (
                  <p className="text-sm text-zinc-400">검색 조건에 맞는 태그가 없습니다.</p>
                ) : (
                  <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {filteredTags.map((tag) => {
                      const checked = selectedTagIds.includes(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? 'border-lime-700 bg-lime-950/20 text-lime-200'
                              : 'border-zinc-800 bg-zinc-950/50 text-zinc-200'
                          }`}
                        >
                          <span className="truncate pr-3">#{tag.name}</span>
                          <span className="text-[11px] text-zinc-400">{tag.type}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTag(tag.id)}
                            className="ml-3 h-4 w-4 accent-lime-400"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-medium">외부 후기 큐레이션</h3>
                    <p className="mt-1 text-xs text-zinc-400">
                      공개 페이지에 노출할 외부 후기 링크를 관리자 수동 큐레이션으로 관리합니다.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">등록 {externalReviews.length}건</span>
                </div>

                {externalReviews.length === 0 ? (
                  <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-sm text-zinc-400">
                    등록된 외부 후기 링크가 없습니다.
                  </p>
                ) : (
                  <div className="mb-4 space-y-2">
                    {externalReviews.map((review) => (
                      <article key={review.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{review.title}</p>
                            <p className="mt-1 text-xs text-zinc-400">
                              출처: {review.source_name} · 순서: {review.sort_order} · 상태:{' '}
                              {review.is_hidden ? '숨김' : '노출'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditExternalReview(review)}
                              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('이 외부 후기 링크를 삭제할까요?')) {
                                  void handleDeleteExternalReview(review.id);
                                }
                              }}
                              disabled={externalReviewDeletingId === review.id}
                              className="rounded-lg border border-rose-900 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-70"
                            >
                              {externalReviewDeletingId === review.id ? '삭제 중...' : '삭제'}
                            </button>
                          </div>
                        </div>
                        <a
                          href={review.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-lime-300 underline"
                        >
                          {review.url}
                        </a>
                        {review.summary ? (
                          <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{review.summary}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSaveExternalReview} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-zinc-200">
                      {editingExternalReviewId ? '외부 후기 수정' : '외부 후기 추가'}
                    </h4>
                    {editingExternalReviewId ? (
                      <button
                        type="button"
                        onClick={resetExternalReviewForm}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                      >
                        수정 취소
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label htmlFor="externalReviewTitle" className="mb-1 block text-xs text-zinc-400">
                        후기 제목
                      </label>
                      <input
                        id="externalReviewTitle"
                        value={externalReviewForm.title}
                        onChange={onExternalReviewFormChange('title')}
                        required
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="externalReviewSourceName" className="mb-1 block text-xs text-zinc-400">
                        출처 이름
                      </label>
                      <input
                        id="externalReviewSourceName"
                        value={externalReviewForm.sourceName}
                        onChange={onExternalReviewFormChange('sourceName')}
                        required
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="externalReviewSortOrder" className="mb-1 block text-xs text-zinc-400">
                        정렬 순서 (0~9999)
                      </label>
                      <input
                        id="externalReviewSortOrder"
                        type="number"
                        min={0}
                        max={9999}
                        step={1}
                        value={externalReviewForm.sortOrder}
                        onChange={onExternalReviewFormChange('sortOrder')}
                        required
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="externalReviewUrl" className="mb-1 block text-xs text-zinc-400">
                        후기 URL
                      </label>
                      <input
                        id="externalReviewUrl"
                        type="url"
                        value={externalReviewForm.url}
                        onChange={onExternalReviewFormChange('url')}
                        required
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="externalReviewSummary" className="mb-1 block text-xs text-zinc-400">
                        요약 (선택)
                      </label>
                      <textarea
                        id="externalReviewSummary"
                        rows={3}
                        value={externalReviewForm.summary}
                        onChange={onExternalReviewFormChange('summary')}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={externalReviewForm.isHidden}
                      onChange={onExternalReviewHiddenChange}
                      className="h-4 w-4 accent-lime-400"
                    />
                    공개 상세 페이지에서 숨김 처리
                  </label>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={externalReviewSaving}
                      className="rounded-lg bg-lime-400 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                    >
                      {externalReviewSaving
                        ? '저장 중...'
                        : editingExternalReviewId
                          ? '외부 후기 수정 저장'
                          : '외부 후기 추가'}
                    </button>
                  </div>
                </form>
              </section>

              <form onSubmit={handleSave} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                <h3 className="mb-3 text-base font-medium">전시 정보 수정 폼</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="title" className="mb-1 block text-xs text-zinc-400">
                      전시 제목
                    </label>
                    <input
                      id="title"
                      value={draft.title}
                      onChange={onTitleChange}
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="subtitle" className="mb-1 block text-xs text-zinc-400">
                      부제목
                    </label>
                    <input
                      id="subtitle"
                      value={draft.subtitle ?? ''}
                      onChange={onDraftChange('subtitle')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="startDate" className="mb-1 block text-xs text-zinc-400">
                      시작일
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={draft.startDate}
                      onChange={onDateChange('startDate')}
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="mb-1 block text-xs text-zinc-400">
                      종료일
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={draft.endDate}
                      onChange={onDateChange('endDate')}
                      required
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="operatingHours" className="mb-1 block text-xs text-zinc-400">
                      운영 시간
                    </label>
                    <input
                      id="operatingHours"
                      value={draft.operatingHours ?? ''}
                      onChange={onDraftChange('operatingHours')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="admissionFee" className="mb-1 block text-xs text-zinc-400">
                      관람료
                    </label>
                    <input
                      id="admissionFee"
                      value={draft.admissionFee ?? ''}
                      onChange={onDraftChange('admissionFee')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="officialUrl" className="mb-1 block text-xs text-zinc-400">
                      공식 링크
                    </label>
                    <input
                      id="officialUrl"
                      type="url"
                      value={draft.officialUrl ?? ''}
                      onChange={onDraftChange('officialUrl')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="bookingUrl" className="mb-1 block text-xs text-zinc-400">
                      예매 링크
                    </label>
                    <input
                      id="bookingUrl"
                      type="url"
                      value={draft.bookingUrl ?? ''}
                      onChange={onDraftChange('bookingUrl')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="posterImageUrl" className="mb-1 block text-xs text-zinc-400">
                      포스터 이미지 URL
                    </label>
                    <input
                      id="posterImageUrl"
                      type="url"
                      value={draft.posterImageUrl ?? ''}
                      onChange={onDraftChange('posterImageUrl')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="summary" className="mb-1 block text-xs text-zinc-400">
                      요약
                    </label>
                    <textarea
                      id="summary"
                      rows={3}
                      value={draft.summary ?? ''}
                      onChange={onDraftChange('summary')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="description" className="mb-1 block text-xs text-zinc-400">
                      전시 소개
                    </label>
                    <textarea
                      id="description"
                      rows={8}
                      value={draft.description ?? ''}
                      onChange={onDraftChange('description')}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-lime-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-lime-300 disabled:opacity-70"
                  >
                    {saving ? '저장 중...' : '수정 내용 저장'}
                  </button>
                  <span className="text-xs text-zinc-500">
                    현재 상태: {exhibition.status} · 전시 기간: {formatDate(exhibition.start_date)} - {formatDate(exhibition.end_date)}
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
