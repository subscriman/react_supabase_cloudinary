import type { NextApiRequest, NextApiResponse } from 'next';
import { sendApiError, sendApiSuccess } from '../../../lib/api-response';

type ProviderId = 'google' | 'kakao' | 'naver';

type ProviderItem = {
  id: ProviderId;
  label: string;
  enabled: boolean;
  presentInSettings: boolean;
};

type SuccessResponse = {
  checkedAt: string;
  providers: ProviderItem[];
};

type ErrorResponse = {
  error: string;
  errorCode: string;
};

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: 'google', label: 'Google 로그인' },
  { id: 'kakao', label: 'Kakao 로그인' },
  { id: 'naver', label: 'Naver 로그인' },
];

function toSafeSupabaseUrl(input: string): string {
  return input.replace(/\/+$/, '');
}

function mapProviders(external: Record<string, unknown>): ProviderItem[] {
  return PROVIDERS.map((provider) => {
    const hasKey = Object.prototype.hasOwnProperty.call(external, provider.id);
    const rawValue = external[provider.id];
    return {
      id: provider.id,
      label: provider.label,
      enabled: rawValue === true,
      presentInSettings: hasKey,
    };
  });
}

async function fetchAuthSettings(supabaseUrl: string, anonKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${toSafeSupabaseUrl(supabaseUrl)}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Auth settings 조회 실패: ${response.status} ${text.slice(0, 160)}`);
    }

    const json = JSON.parse(text) as { external?: Record<string, unknown> };
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SuccessResponse | ErrorResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', '허용되지 않은 메서드입니다.');
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !anonKey) {
    return sendApiSuccess(res, 200, {
      checkedAt: new Date().toISOString(),
      providers: PROVIDERS.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: false,
        presentInSettings: false,
      })),
    });
  }

  try {
    const settings = await fetchAuthSettings(supabaseUrl, anonKey);
    const external = settings.external && typeof settings.external === 'object' ? settings.external : {};
    return sendApiSuccess(res, 200, {
      checkedAt: new Date().toISOString(),
      providers: mapProviders(external),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendApiError(res, 500, 'INTERNAL_ERROR', `Auth 공급자 설정 조회 실패: ${message}`);
  }
}
