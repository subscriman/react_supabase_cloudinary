import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Carrier,
  ReminderRepeatUnit,
  SeedData,
  SeedPreset,
  SeedSubProduct,
  UserMembershipConfig,
  createDraftFromSeedPreset,
  loadSavedMembershipConfigs,
  normalizePhotos,
  persistMembershipConfigs,
} from '../lib/user-membership';

interface UserMembershipWorkspaceProps {
  seedData: SeedData;
}

const carrierLabels: Record<'all' | Carrier, string> = {
  all: '전체',
  kt: 'KT',
  skt: 'SKT',
  lguplus: 'LG U+',
};

const repeatOptions: { value: ReminderRepeatUnit; label: string }[] = [
  { value: 'day', label: '일 반복' },
  { value: 'week', label: '주 반복' },
  { value: 'month', label: '월 반복' },
  { value: 'year', label: '연 반복' },
  { value: 'event_window', label: '이벤트 기간' },
];

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-coral)] focus:ring-2 focus:ring-[rgba(226,111,81,0.18)]';

const sectionCardClassName =
  'rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur';

function getOfficialSourceLabel(url: string, index: number) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host.includes('kt.com')) {
      return `KT 공식 페이지 ${index + 1}`;
    }

    if (host.includes('tworld.co.kr')) {
      return `SKT 공식 페이지 ${index + 1}`;
    }

    if (host.includes('lguplus.com')) {
      return `LG U+ 공식 페이지 ${index + 1}`;
    }

    return `${host} ${index + 1}`;
  } catch {
    return `공식 페이지 ${index + 1}`;
  }
}

export default function UserMembershipWorkspace({
  seedData,
}: UserMembershipWorkspaceProps) {
  const presets = seedData.presets || [];
  const [carrierFilter, setCarrierFilter] = useState<'all' | Carrier>('all');
  const [search, setSearch] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<UserMembershipConfig[]>([]);
  const [selectedSeedKey, setSelectedSeedKey] = useState(
    seedData.recommendedInitialPresetKeys[0] || presets[0]?.seedKey || ''
  );
  const [draft, setDraft] = useState<UserMembershipConfig | null>(
    presets[0] ? createDraftFromSeedPreset(presets[0]) : null
  );
  const [statusMessage, setStatusMessage] = useState('');

  const filteredPresets = useMemo(() => {
    return presets.filter((preset) => {
      const carrier = preset.template.seedMeta?.carrier || 'skt';
      const matchesCarrier = carrierFilter === 'all' || carrier === carrierFilter;
      const keyword = search.trim().toLowerCase();
      const searchable = [
        preset.name,
        preset.description,
        preset.provider,
        preset.template.seedMeta?.benefitCategory || '',
        preset.template.seedMeta?.membershipGrade || '',
      ]
        .join(' ')
        .toLowerCase();

      return matchesCarrier && (!keyword || searchable.includes(keyword));
    });
  }, [carrierFilter, presets, search]);

  const selectedPreset =
    presets.find((preset) => preset.seedKey === selectedSeedKey) || null;
  const officialSourceUrls = selectedPreset?.template.seedMeta?.sourceUrls || [];
  const sourceCheckedAt =
    selectedPreset?.template.seedMeta?.sourceCheckedAt ||
    seedData.generatedFrom.sourceCheckedAt;

  const savedCountBySeed = useMemo(() => {
    return savedConfigs.reduce<Record<string, number>>((acc, config) => {
      acc[config.seedKey] = (acc[config.seedKey] || 0) + 1;
      return acc;
    }, {});
  }, [savedConfigs]);

  useEffect(() => {
    setSavedConfigs(loadSavedMembershipConfigs());
  }, []);

  useEffect(() => {
    if (filteredPresets.length === 0) {
      setDraft(null);
      return;
    }

    const stillVisible = filteredPresets.some(
      (preset) => preset.seedKey === selectedSeedKey
    );

    if (!stillVisible) {
      const nextPreset = filteredPresets[0];
      setSelectedSeedKey(nextPreset.seedKey);
      setDraft(createDraftFromSeedPreset(nextPreset));
      return;
    }

    if (!draft && selectedPreset) {
      setDraft(createDraftFromSeedPreset(selectedPreset));
    }
  }, [draft, filteredPresets, selectedPreset, selectedSeedKey]);

  const handleSelectPreset = (preset: SeedPreset) => {
    setSelectedSeedKey(preset.seedKey);
    setDraft(createDraftFromSeedPreset(preset));
    setStatusMessage('공식 프리셋 값을 불러왔습니다. 필요한 값으로 수정한 뒤 저장하세요.');
  };

  const handleLoadSavedConfig = (config: UserMembershipConfig) => {
    setSelectedSeedKey(config.seedKey);
    setDraft({
      ...config,
      photos: normalizePhotos(config.photos),
      subProducts: config.subProducts.map((subProduct) => ({ ...subProduct })),
    });
    setStatusMessage('저장된 개인 설정을 불러왔습니다.');
  };

  const handleDeleteSavedConfig = (configId: string) => {
    if (!confirm('이 개인 설정을 삭제할까요?')) return;

    const next = savedConfigs.filter((config) => config.id !== configId);
    setSavedConfigs(next);
    persistMembershipConfigs(next);
    setStatusMessage('저장된 개인 설정을 삭제했습니다.');
  };

  const handleSaveDraft = () => {
    if (!draft) return;

    const now = new Date().toISOString();
    const isExisting = savedConfigs.some((config) => config.id === draft.id);
    const nextDraft: UserMembershipConfig = {
      ...draft,
      id: isExisting ? draft.id : `saved-${draft.seedKey}-${Date.now()}`,
      photos: normalizePhotos(draft.photos),
      updatedAt: now,
      createdAt: isExisting ? draft.createdAt : now,
    };

    const next = isExisting
      ? savedConfigs.map((config) =>
          config.id === nextDraft.id ? nextDraft : config
        )
      : [nextDraft, ...savedConfigs];

    setSavedConfigs(next);
    setDraft(nextDraft);
    persistMembershipConfigs(next);
    setStatusMessage(
      isExisting
        ? '개인 설정을 수정해서 다시 저장했습니다.'
        : '개인 설정을 현재 브라우저에 저장했습니다.'
    );
  };

  const handleResetDraft = () => {
    if (!selectedPreset) return;
    setDraft(createDraftFromSeedPreset(selectedPreset));
    setStatusMessage('공식 프리셋 기본값으로 되돌렸습니다.');
  };

  const updateDraft = <K extends keyof UserMembershipConfig>(
    key: K,
    value: UserMembershipConfig[K]
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            [key]: value,
          }
        : prev
    );
  };

  const updateReminder = (
    key: keyof UserMembershipConfig['reminder'],
    value: string | boolean | number
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            reminder: {
              ...prev.reminder,
              [key]: value,
            },
          }
        : prev
    );
  };

  const updateCustomRule = (
    key: keyof UserMembershipConfig['customRules'],
    value: string | number | null
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            customRules: {
              ...prev.customRules,
              [key]: value,
            },
          }
        : prev
    );
  };

  const updateSubProduct = (
    index: number,
    key: keyof SeedSubProduct,
    value: string | number | undefined
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const nextSubProducts = prev.subProducts.map((subProduct, subIndex) =>
        subIndex === index
          ? {
              ...subProduct,
              [key]: value,
            }
          : subProduct
      );

      return {
        ...prev,
        subProducts: nextSubProducts,
      };
    });
  };

  const updatePhoto = (index: number, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const nextPhotos = [...prev.photos];
      nextPhotos[index] = value;

      return {
        ...prev,
        photos: nextPhotos.slice(0, 10),
      };
    });
  };

  const addPhotoField = () => {
    setDraft((prev) => {
      if (!prev || prev.photos.length >= 10) return prev;
      return {
        ...prev,
        photos: [...prev.photos, ''],
      };
    });
  };

  const removePhotoField = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextPhotos = prev.photos.filter((_, photoIndex) => photoIndex !== index);
      return {
        ...prev,
        photos: nextPhotos.length ? nextPhotos : [''],
      };
    });
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-[rgba(15,23,42,0.08)] bg-[rgba(255,250,242,0.82)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--brand-teal)]">
              Membership Beta
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              통신사 혜택을 고르고,
              <br />
              내 사용 루틴에 맞게 저장하세요.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              웹에서는 설정값 저장까지만 먼저 구현했습니다. 안드로이드/iOS 앱 단계에서
              실제 알림 발송을 연결할 수 있도록 반복 주기, 만료 규칙, 개인 메모를
              함께 저장합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              저장 위치: 현재 브라우저
            </div>
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              관리자 페이지
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">공식 프리셋</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {presets.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              통신 3사 멤버십 초기 세트 기반
            </p>
          </article>
          <article className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">내 저장 설정</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {savedConfigs.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              브라우저에 저장된 개인 설정 수
            </p>
          </article>
          <article className="rounded-[28px] border border-white/60 bg-[linear-gradient(135deg,rgba(42,157,143,0.12),rgba(226,111,81,0.10))] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">알림 상태</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              웹에서는 저장만
            </p>
            <p className="mt-2 text-sm text-slate-600">
              실제 푸시 알림은 앱 구현 단계에서 이어집니다.
            </p>
          </article>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className={sectionCardClassName}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">혜택 카탈로그</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  {filteredPresets.length}개
                </span>
              </div>

              <div className="mt-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="영화, VIP, T day, GS25..."
                  className={inputClassName}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(carrierLabels) as Array<'all' | Carrier>).map((carrier) => (
                  <button
                    key={carrier}
                    onClick={() => setCarrierFilter(carrier)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      carrierFilter === carrier
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {carrierLabels[carrier]}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {filteredPresets.map((preset) => {
                  const meta = preset.template.seedMeta || {};
                  const isSelected = preset.seedKey === selectedSeedKey;
                  return (
                    <button
                      key={preset.seedKey}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        isSelected
                          ? 'border-[var(--brand-coral)] bg-[rgba(226,111,81,0.08)] shadow-[0_18px_40px_rgba(226,111,81,0.14)]'
                          : 'border-slate-200 bg-white hover:border-[rgba(42,157,143,0.35)] hover:bg-[rgba(42,157,143,0.05)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-teal)]">
                            {carrierLabels[(meta.carrier as Carrier) || 'skt']}
                          </p>
                          <h3 className="mt-2 text-base font-semibold text-slate-900">
                            {preset.name}
                          </h3>
                        </div>
                        {savedCountBySeed[preset.seedKey] ? (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                            저장 {savedCountBySeed[preset.seedKey]}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {preset.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {meta.membershipGrade ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {meta.membershipGrade}
                          </span>
                        ) : null}
                        {meta.usageCycleUnit ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {repeatOptions.find((option) => option.value === meta.usageCycleUnit)
                              ?.label || meta.usageCycleUnit}
                          </span>
                        ) : null}
                        {meta.annualLimit ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            연 {meta.annualLimit}회
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                {filteredPresets.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                    검색 조건에 맞는 프리셋이 없습니다.
                  </div>
                ) : null}
              </div>
            </section>

            <section className={sectionCardClassName}>
              <h2 className="text-lg font-semibold text-slate-900">주의 사항</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                {seedData.limitations.map((limitation) => (
                  <li key={limitation} className="rounded-2xl bg-slate-50 px-4 py-3">
                    {limitation}
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          <div className="space-y-6">
            {draft && selectedPreset ? (
              <>
                <section className={sectionCardClassName}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--brand-coral)]">
                        Selected Preset
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                        {selectedPreset.name}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        {selectedPreset.description}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p>웹에서는 알림을 실제로 보내지 않습니다.</p>
                      <p className="mt-1">지금은 설정값 저장과 수정 흐름만 먼저 검증합니다.</p>
                    </div>
                  </div>

                  {statusMessage ? (
                    <div className="mt-5 rounded-2xl bg-[rgba(42,157,143,0.10)] px-4 py-3 text-sm text-slate-700">
                      {statusMessage}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {carrierLabels[draft.carrier]}
                    </span>
                    {selectedPreset.template.seedMeta?.membershipGrade ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {selectedPreset.template.seedMeta?.membershipGrade}
                      </span>
                    ) : null}
                    {draft.customRules.remainingCountModel ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {draft.customRules.remainingCountModel}
                      </span>
                    ) : null}
                    {draft.customRules.annualLimit ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        연 {draft.customRules.annualLimit}회
                      </span>
                    ) : null}
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        사용자 제목
                      </label>
                      <input
                        value={draft.displayName}
                        onChange={(event) => updateDraft('displayName', event.target.value)}
                        className={inputClassName}
                        placeholder="내가 구분하기 쉬운 이름"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        제공업체
                      </label>
                      <input value={draft.provider} readOnly className={`${inputClassName} bg-slate-50`} />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      설명 / 메모
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft('description', event.target.value)}
                      rows={4}
                      className={inputClassName}
                      placeholder="예: 영화는 주말 전에 꼭 확인하기"
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-4 md:flex-row">
                    <label className="flex flex-1 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">혜택 활성화</p>
                        <p className="text-xs text-slate-500">꺼도 목록에는 남고 알림만 중지됩니다.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) => updateDraft('isActive', event.target.checked)}
                        className="h-5 w-5 accent-[var(--brand-coral)]"
                      />
                    </label>

                    <label className="flex flex-1 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">알림 설정 저장</p>
                        <p className="text-xs text-slate-500">웹에서는 발송하지 않고 값만 저장합니다.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={draft.reminder.enabled}
                        onChange={(event) => updateReminder('enabled', event.target.checked)}
                        className="h-5 w-5 accent-[var(--brand-coral)]"
                      />
                    </label>
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        통신사 공식 안내 URL
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        혜택 상세 조건과 최신 안내는 아래 통신사 페이지에서 직접 확인할 수 있습니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                      확인 기준 {sourceCheckedAt}
                    </span>
                  </div>

                  {officialSourceUrls.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {officialSourceUrls.map((url, index) => (
                        <div
                          key={`${selectedPreset.seedKey}-source-${index}`}
                          className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-teal)]">
                            {getOfficialSourceLabel(url, index)}
                          </p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block break-all text-sm leading-6 text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-[var(--brand-coral)] hover:decoration-[var(--brand-coral)]"
                          >
                            {url}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      이 프리셋에는 연결된 공식 안내 URL이 아직 없습니다.
                    </div>
                  )}
                </section>

                <section className={sectionCardClassName}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">알림 설정 초안</h3>
                    <span className="text-xs text-slate-500">앱 전환용 설정값</span>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        반복 주기
                      </label>
                      <select
                        value={draft.reminder.repeatUnit}
                        onChange={(event) =>
                          updateReminder(
                            'repeatUnit',
                            event.target.value as ReminderRepeatUnit
                          )
                        }
                        className={inputClassName}
                      >
                        {repeatOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        미리 알림 일수
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.reminder.daysBefore}
                        onChange={(event) =>
                          updateReminder('daysBefore', Number(event.target.value || 0))
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        추적 방식
                      </label>
                      <input
                        value={draft.customRules.remainingCountModel}
                        onChange={(event) =>
                          updateCustomRule('remainingCountModel', event.target.value)
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      알림 메시지
                    </label>
                    <textarea
                      value={draft.reminder.message}
                      onChange={(event) => updateReminder('message', event.target.value)}
                      rows={3}
                      className={inputClassName}
                      placeholder="앱 알림 문구 초안"
                    />
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <h3 className="text-lg font-semibold text-slate-900">추적 규칙 커스터마이징</h3>

                  <div className="mt-5 grid gap-5 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        사용 주기
                      </label>
                      <select
                        value={draft.customRules.usageCycleUnit}
                        onChange={(event) =>
                          updateCustomRule(
                            'usageCycleUnit',
                            event.target.value as ReminderRepeatUnit
                          )
                        }
                        className={inputClassName}
                      >
                        {repeatOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        주기별 한도
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.customRules.usageCycleLimit ?? ''}
                        onChange={(event) =>
                          updateCustomRule(
                            'usageCycleLimit',
                            event.target.value === ''
                              ? null
                              : Number(event.target.value)
                          )
                        }
                        className={inputClassName}
                        placeholder="예: 1"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        연간 한도
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.customRules.annualLimit ?? ''}
                        onChange={(event) =>
                          updateCustomRule(
                            'annualLimit',
                            event.target.value === ''
                              ? null
                              : Number(event.target.value)
                          )
                        }
                        className={inputClassName}
                        placeholder="예: 12"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        이벤트 윈도우 규칙
                      </label>
                      <textarea
                        value={draft.customRules.eventWindowRule}
                        onChange={(event) =>
                          updateCustomRule('eventWindowRule', event.target.value)
                        }
                        rows={3}
                        className={inputClassName}
                        placeholder="예: 매월 25일~말일"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        쿠폰 유효기간 규칙
                      </label>
                      <textarea
                        value={draft.customRules.couponValidityRule}
                        onChange={(event) =>
                          updateCustomRule('couponValidityRule', event.target.value)
                        }
                        rows={3}
                        className={inputClassName}
                        placeholder="예: 다운로드 후 다음달 말일까지"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        혜택 요약 문구
                      </label>
                      <input
                        value={draft.customRules.benefitAmountText}
                        onChange={(event) =>
                          updateCustomRule('benefitAmountText', event.target.value)
                        }
                        className={inputClassName}
                        placeholder="예: 무료 3회 + 1+1 9회"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        사용 조건 메모
                      </label>
                      <input
                        value={draft.customRules.benefitConditionText}
                        onChange={(event) =>
                          updateCustomRule('benefitConditionText', event.target.value)
                        }
                        className={inputClassName}
                        placeholder="예: 같은 달 다른 초이스와 중복 사용 불가"
                      />
                    </div>
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">사진 URL</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        최대 10장까지 저장할 수 있습니다. 웹 샘플에서는 URL만 관리합니다.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addPhotoField}
                      disabled={draft.photos.length >= 10}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      사진 칸 추가
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {draft.photos.map((photo, index) => (
                      <div key={`${draft.id}-photo-${index}`} className="flex gap-3">
                        <input
                          value={photo}
                          onChange={(event) => updatePhoto(index, event.target.value)}
                          className={inputClassName}
                          placeholder={`사진 URL ${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removePhotoField(index)}
                          className="rounded-2xl border border-slate-200 px-4 text-sm text-slate-600 transition hover:border-red-200 hover:text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <h3 className="text-lg font-semibold text-slate-900">서브 혜택 편집</h3>
                  <div className="mt-5 space-y-4">
                    {draft.subProducts.map((subProduct, index) => (
                      <div
                        key={`${draft.id}-subproduct-${index}`}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="grid gap-4 lg:grid-cols-4">
                          <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              혜택명
                            </label>
                            <input
                              value={subProduct.name}
                              onChange={(event) =>
                                updateSubProduct(index, 'name', event.target.value)
                              }
                              className={inputClassName}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              타입
                            </label>
                            <select
                              value={subProduct.type}
                              onChange={(event) =>
                                updateSubProduct(index, 'type', event.target.value)
                              }
                              className={inputClassName}
                            >
                              <option value="benefit">혜택</option>
                              <option value="coupon">쿠폰</option>
                              <option value="service">서비스</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              수량
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={subProduct.quantity ?? ''}
                              onChange={(event) =>
                                updateSubProduct(
                                  index,
                                  'quantity',
                                  event.target.value === ''
                                    ? undefined
                                    : Number(event.target.value)
                                )
                              }
                              className={inputClassName}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              유효기간(일)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={subProduct.validityPeriod ?? ''}
                              onChange={(event) =>
                                updateSubProduct(
                                  index,
                                  'validityPeriod',
                                  event.target.value === ''
                                    ? undefined
                                    : Number(event.target.value)
                                )
                              }
                              className={inputClassName}
                            />
                          </div>

                          <div className="lg:col-span-3">
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              설명
                            </label>
                            <textarea
                              value={subProduct.description || ''}
                              onChange={(event) =>
                                updateSubProduct(index, 'description', event.target.value)
                              }
                              rows={2}
                              className={inputClassName}
                              placeholder="예: 월 1회, 연 12회"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={sectionCardClassName}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm leading-6 text-slate-600">
                      <p>저장하면 이 브라우저에서 다시 불러와 수정할 수 있습니다.</p>
                      <p>모바일 앱 단계에서는 이 설정 구조를 서버 저장/알림과 연결하면 됩니다.</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleResetDraft}
                        className="rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                      >
                        공식값으로 되돌리기
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                      >
                        개인 설정 저장
                      </button>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <section className={sectionCardClassName}>
                <h2 className="text-xl font-semibold text-slate-900">표시할 프리셋이 없습니다.</h2>
                <p className="mt-3 text-sm text-slate-600">
                  왼쪽에서 다른 통신사 필터를 선택하거나 검색어를 지워보세요.
                </p>
              </section>
            )}

            <section className={sectionCardClassName}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">내 저장 설정</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                  {savedConfigs.length}개
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {savedConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {config.displayName}
                          </h3>
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                            {carrierLabels[config.carrier]}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              config.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {config.isActive ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {config.description}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          저장일 {new Date(config.updatedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedConfig(config)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)]"
                        >
                          불러와서 수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedConfig(config.id)}
                          className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {savedConfigs.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                    아직 저장된 개인 설정이 없습니다. 프리셋을 선택해 값을 조정한 뒤
                    저장해보세요.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
