import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SubscriptionDesktopEditor from './SubscriptionDesktopEditor';
import ImageUploadArrayField from './ImageUploadArrayField';
import {
  BenefitTrackerState,
  Carrier,
  PaymentCycle,
  PaymentMethodType,
  ProductType,
  ReminderRepeatUnit,
  SeedData,
  SeedPreset,
  SeedSubProduct,
  UsageEntry,
  UserMembershipConfig,
  buildCatalogPresets,
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
  general: '구독',
  kt: 'KT',
  skt: 'SKT',
  lguplus: 'LG U+',
};

const productTypeLabels: Record<'all' | ProductType, string> = {
  all: '전체',
  telecom: '통신사 혜택',
  A: '타입 A',
  B: '타입 B',
  C: '타입 C',
  D: '타입 D',
};

const paymentCycleLabels: Record<PaymentCycle, string> = {
  monthly: '월 결제',
  yearly: '연간 결제',
};

const paymentMethodLabels: Record<PaymentMethodType, string> = {
  card: '카드',
  account: '계좌',
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

    if (host.includes('kt.com')) return `KT 공식 페이지 ${index + 1}`;
    if (host.includes('tworld.co.kr') || host.includes('sktuniverse.co.kr')) {
      return `SKT 공식 페이지 ${index + 1}`;
    }
    if (host.includes('lguplus.com')) return `LG U+ 공식 페이지 ${index + 1}`;
    return `${host} ${index + 1}`;
  } catch {
    return `공식 페이지 ${index + 1}`;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameCycle(
  dateValue: string,
  compareValue: string,
  cycleUnit: ReminderRepeatUnit
) {
  const date = new Date(dateValue);
  const compare = new Date(compareValue);

  if (cycleUnit === 'day') {
    return (
      date.getFullYear() === compare.getFullYear() &&
      date.getMonth() === compare.getMonth() &&
      date.getDate() === compare.getDate()
    );
  }

  if (cycleUnit === 'week') {
    const getWeekStart = (target: Date) => {
      const copy = new Date(target);
      copy.setHours(0, 0, 0, 0);
      copy.setDate(copy.getDate() - copy.getDay());
      return copy.getTime();
    };

    return getWeekStart(date) === getWeekStart(compare);
  }

  if (cycleUnit === 'month' || cycleUnit === 'event_window') {
    return (
      date.getFullYear() === compare.getFullYear() &&
      date.getMonth() === compare.getMonth()
    );
  }

  return date.getFullYear() === compare.getFullYear();
}

function countEntriesInCycle(
  entries: UsageEntry[],
  referenceValue: string,
  cycleUnit: ReminderRepeatUnit
) {
  return entries.filter((entry) =>
    isSameCycle(entry.checkedAt, referenceValue, cycleUnit)
  ).length;
}

function sumAmountsInMonth(entries: UsageEntry[], referenceValue: string) {
  return entries.reduce((total, entry) => {
    if (!isSameCycle(entry.checkedAt, referenceValue, 'month')) return total;
    return total + (entry.amount || 0);
  }, 0);
}

function buildRuleSummary(
  cycleUnit: ReminderRepeatUnit,
  cycleLimit: number | null,
  annualLimit: number | null
) {
  const unitLabelMap: Record<ReminderRepeatUnit, string> = {
    day: '일',
    week: '주',
    month: '월',
    year: '년',
    event_window: '이벤트 기간',
  };

  const parts: string[] = [];

  if (cycleLimit) {
    parts.push(`${unitLabelMap[cycleUnit]} ${cycleLimit}회`);
  }

  if (annualLimit) {
    parts.push(`연 ${annualLimit}회`);
  }

  return parts.join(', ') || '조건 확인 필요';
}

function cloneConfig(config: UserMembershipConfig): UserMembershipConfig {
  return {
    ...config,
    photos: normalizePhotos(config.photos),
    sourceUrls: [...config.sourceUrls],
    tierSuggestions: [...config.tierSuggestions],
    subProducts: config.subProducts.map((subProduct) => ({ ...subProduct })),
    usageEntries: config.usageEntries.map((entry) => ({ ...entry })),
    calendarEntries: config.calendarEntries.map((entry) => ({ ...entry })),
    benefitTrackers: config.benefitTrackers.map((tracker) => ({
      ...tracker,
      photos: normalizePhotos(tracker.photos),
      entries: tracker.entries.map((entry) => ({ ...entry })),
    })),
  };
}

export default function UserMembershipWorkspace({
  seedData,
}: UserMembershipWorkspaceProps) {
  const presets = useMemo(() => buildCatalogPresets(seedData), [seedData]);
  const savedSectionRef = useRef<HTMLElement | null>(null);
  const [carrierFilter, setCarrierFilter] = useState<'all' | Carrier>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | ProductType>(
    'all'
  );
  const [search, setSearch] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<UserMembershipConfig[]>([]);
  const [selectedSeedKey, setSelectedSeedKey] = useState(
    presets[0]?.seedKey || ''
  );
  const [draft, setDraft] = useState<UserMembershipConfig | null>(
    presets[0] ? createDraftFromSeedPreset(presets[0]) : null
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [trackerAmountInputs, setTrackerAmountInputs] = useState<
    Record<string, string>
  >({});

  const filteredPresets = useMemo(() => {
    return presets.filter((preset) => {
      const meta = preset.template.seedMeta || {};
      const carrier = meta.carrier || 'general';
      const productType = meta.productType || 'telecom';
      const matchesCarrier = carrierFilter === 'all' || carrier === carrierFilter;
      const matchesType =
        productTypeFilter === 'all' || productType === productTypeFilter;
      const keyword = search.trim().toLowerCase();
      const searchable = [
        preset.name,
        preset.description,
        preset.provider,
        meta.membershipGrade || '',
        meta.benefitCategory || '',
        ...(meta.tierSuggestions || []),
      ]
        .join(' ')
        .toLowerCase();

      return matchesCarrier && matchesType && (!keyword || searchable.includes(keyword));
    });
  }, [carrierFilter, presets, productTypeFilter, search]);

  const selectedPreset =
    presets.find((preset) => preset.seedKey === selectedSeedKey) || null;

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
    setTrackerAmountInputs({});
  }, [draft?.id]);

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
    setDraft(cloneConfig(config));
    setStatusMessage('내 구독에 저장된 설정을 불러왔습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSavedConfig = (configId: string) => {
    if (!confirm('이 내 구독 항목을 삭제할까요?')) return;

    const next = savedConfigs.filter((config) => config.id !== configId);
    setSavedConfigs(next);
    persistMembershipConfigs(next);
    setStatusMessage('내 구독 항목을 삭제했습니다.');
  };

  const handleSaveDraft = () => {
    if (!draft) return;

    const now = new Date().toISOString();
    const isExisting = savedConfigs.some((config) => config.id === draft.id);
    const nextDraft: UserMembershipConfig = {
      ...draft,
      photos: normalizePhotos(draft.photos),
      benefitTrackers: draft.benefitTrackers.map((tracker) => ({
        ...tracker,
        photos: normalizePhotos(tracker.photos),
      })),
      updatedAt: now,
      createdAt: isExisting ? draft.createdAt : now,
      id: isExisting ? draft.id : `saved-${draft.seedKey}-${Date.now()}`,
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
        ? '내 구독 설정을 수정해서 다시 저장했습니다.'
        : '개인 설정을 내 구독에 저장했습니다.'
    );

    setTimeout(() => {
      savedSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
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
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
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

  const updateUsageEntry = (slotIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const annualLimit = prev.customRules.annualLimit;
      const nextEntries = [...prev.usageEntries];

      if (slotIndex < nextEntries.length) {
        if (!confirm('이 사용 기록을 해제할까요?')) return prev;
        nextEntries.splice(slotIndex, 1);
      } else {
        if (annualLimit && nextEntries.length >= annualLimit) {
          alert(`이 상품은 연 ${annualLimit}회까지만 기록할 수 있습니다.`);
          return prev;
        }

        const now = new Date().toISOString();
        const cycleLimit = prev.customRules.usageCycleLimit;
        const cycleUnit = prev.customRules.usageCycleUnit;
        const cycleCount = countEntriesInCycle(nextEntries, now, cycleUnit);

        if (
          cycleLimit &&
          cycleCount >= cycleLimit &&
          !confirm(
            prev.usageOverflowMessage ||
              `${prev.displayName}는 ${buildRuleSummary(
                cycleUnit,
                cycleLimit,
                prev.customRules.annualLimit
              )} 조건입니다. 그래도 기록할까요?`
          )
        ) {
          return prev;
        }

        nextEntries.push({
          id: `${prev.id}-usage-${Date.now()}`,
          checkedAt: now,
        });
      }

      return {
        ...prev,
        usageEntries: nextEntries,
      };
    });
  };

  const removeUsageHistoryEntry = (entryId: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            usageEntries: prev.usageEntries.filter((entry) => entry.id !== entryId),
          }
        : prev
    );
  };

  const updateTracker = (
    trackerId: string,
    updater: (tracker: BenefitTrackerState) => BenefitTrackerState
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            benefitTrackers: prev.benefitTrackers.map((tracker) =>
              tracker.id === trackerId ? updater(tracker) : tracker
            ),
          }
        : prev
    );
  };

  const addTrackerCheckboxEntry = (trackerId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const nextTrackers = prev.benefitTrackers.map((tracker) => {
        if (tracker.id !== trackerId) return tracker;

        if (tracker.annualLimit && tracker.entries.length >= tracker.annualLimit) {
          alert(`${tracker.title}는 연 ${tracker.annualLimit}회까지만 기록할 수 있습니다.`);
          return tracker;
        }

        const now = new Date().toISOString();
        const cycleCount = countEntriesInCycle(
          tracker.entries,
          now,
          tracker.cycleUnit
        );

        if (
          tracker.cycleLimit &&
          cycleCount >= tracker.cycleLimit &&
          !confirm(
            tracker.overflowMessage ||
              `${tracker.title}는 ${buildRuleSummary(
                tracker.cycleUnit,
                tracker.cycleLimit ?? null,
                tracker.annualLimit ?? null
              )} 조건입니다. 그래도 기록할까요?`
          )
        ) {
          return tracker;
        }

        return {
          ...tracker,
          entries: [
            ...tracker.entries,
            {
              id: `${tracker.id}-${Date.now()}`,
              checkedAt: now,
            },
          ],
        };
      });

      return {
        ...prev,
        benefitTrackers: nextTrackers,
      };
    });
  };

  const addTrackerAmountEntry = (trackerId: string) => {
    const rawAmount = trackerAmountInputs[trackerId] || '';
    const amount = Number(rawAmount);

    if (!rawAmount || Number.isNaN(amount) || amount <= 0) {
      alert('사용 금액을 입력해주세요.');
      return;
    }

    setDraft((prev) => {
      if (!prev) return prev;

      const nextTrackers = prev.benefitTrackers.map((tracker) => {
        if (tracker.id !== trackerId) return tracker;

        const now = new Date().toISOString();
        const cycleCount = countEntriesInCycle(
          tracker.entries,
          now,
          tracker.cycleUnit
        );

        if (
          tracker.cycleLimit &&
          cycleCount >= tracker.cycleLimit &&
          !confirm(
            tracker.overflowMessage ||
              `${tracker.title}는 ${buildRuleSummary(
                tracker.cycleUnit,
                tracker.cycleLimit ?? null,
                tracker.annualLimit ?? null
              )} 조건입니다. 그래도 기록할까요?`
          )
        ) {
          return tracker;
        }

        if (tracker.cycleAmountLimit && tracker.sharedBudgetKey) {
          const sharedTotal = prev.benefitTrackers
            .filter((item) => item.sharedBudgetKey === tracker.sharedBudgetKey)
            .reduce((total, item) => total + sumAmountsInMonth(item.entries, now), 0);

          if (
            sharedTotal + amount > tracker.cycleAmountLimit &&
            !confirm(
              `이 제휴 묶음은 이번 달 ${tracker.cycleAmountLimit.toLocaleString(
                'ko-KR'
              )}원 한도입니다. 그래도 기록할까요?`
            )
          ) {
            return tracker;
          }
        }

        return {
          ...tracker,
          entries: [
            ...tracker.entries,
            {
              id: `${tracker.id}-${Date.now()}`,
              checkedAt: now,
              amount,
            },
          ],
        };
      });

      return {
        ...prev,
        benefitTrackers: nextTrackers,
      };
    });

    setTrackerAmountInputs((prev) => ({
      ...prev,
      [trackerId]: '',
    }));
  };

  const removeTrackerEntry = (trackerId: string, entryId: string) => {
    updateTracker(trackerId, (tracker) => ({
      ...tracker,
      entries: tracker.entries.filter((entry) => entry.id !== entryId),
    }));
  };

  const updateTrackerNote = (trackerId: string, value: string) => {
    updateTracker(trackerId, (tracker) => ({
      ...tracker,
      note: value,
    }));
  };

  const updateTrackerPhoto = (
    trackerId: string,
    photoIndex: number,
    value: string
  ) => {
    updateTracker(trackerId, (tracker) => {
      const nextPhotos = [...tracker.photos];
      nextPhotos[photoIndex] = value;

      return {
        ...tracker,
        photos: nextPhotos.slice(0, 10),
      };
    });
  };

  const addTrackerPhotoField = (trackerId: string) => {
    updateTracker(trackerId, (tracker) => {
      if (tracker.photos.length >= 10) return tracker;

      return {
        ...tracker,
        photos: [...tracker.photos, ''],
      };
    });
  };

  const removeTrackerPhotoField = (trackerId: string, photoIndex: number) => {
    updateTracker(trackerId, (tracker) => {
      const nextPhotos = tracker.photos.filter((_, index) => index !== photoIndex);
      return {
        ...tracker,
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
              통신사 혜택과 구독 상품을 고르고,
              <br />
              내 사용 루틴에 맞게 저장하세요.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              통신사 혜택 프리셋은 그대로 두고, 타입 A/B/C 샘플 상품까지 함께
              관리할 수 있게 확장했습니다. 웹에서는 저장과 체크 기록만 먼저 구현합니다.
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
            <p className="text-sm text-slate-500">공식 프리셋 + 샘플 상품</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{presets.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              통신사 혜택과 타입 A/B/C 샘플을 함께 관리
            </p>
          </article>
          <article className="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">내 구독</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {savedConfigs.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              브라우저에 저장된 개인 관리 항목 수
            </p>
          </article>
          <article className="rounded-[28px] border border-white/60 bg-[linear-gradient(135deg,rgba(42,157,143,0.12),rgba(226,111,81,0.10))] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-500">체크 관리</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              수동 체크 + 기록 보관
            </p>
            <p className="mt-2 text-sm text-slate-600">
              월 제한 알림은 경고만 하고, 사용자의 기록 목적을 위해 강제 저장을 허용합니다.
            </p>
          </article>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className={sectionCardClassName}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">상품 카탈로그</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  {filteredPresets.length}개
                </span>
              </div>

              <div className="mt-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="넷플릭스, KT VIP, T 우주패스, 영화..."
                  className={inputClassName}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(['all', 'general', 'kt', 'skt', 'lguplus'] as Array<
                  'all' | Carrier
                >).map((carrier) => (
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

              <div className="mt-3 flex flex-wrap gap-2">
                {(['all', 'telecom', 'A', 'B', 'C', 'D'] as Array<
                  'all' | ProductType
                >).map((type) => (
                  <button
                    key={type}
                    onClick={() => setProductTypeFilter(type)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      productTypeFilter === type
                        ? 'bg-[var(--brand-coral)] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {productTypeLabels[type]}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {filteredPresets.map((preset) => {
                  const meta = preset.template.seedMeta || {};
                  const carrier = meta.carrier || 'general';
                  const productType = meta.productType || 'telecom';
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-teal)]">
                              {carrierLabels[carrier]}
                            </span>
                            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                              {productTypeLabels[productType]}
                            </span>
                          </div>
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
                        {meta.tierSuggestions?.length ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            티어 선택
                          </span>
                        ) : null}
                        {meta.usageCycleLimit ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {buildRuleSummary(
                              meta.usageCycleUnit || 'month',
                              meta.usageCycleLimit ?? null,
                              meta.annualLimit ?? null
                            )}
                          </span>
                        ) : null}
                        {meta.supportsBilling ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            결제/갱신 관리
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                {filteredPresets.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                    검색 조건에 맞는 항목이 없습니다.
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--brand-coral)]">
                          Selected Preset
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          {productTypeLabels[draft.productType]}
                        </span>
                      </div>
                      <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                        {selectedPreset.name}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                        {selectedPreset.description}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p>웹에서는 실제 푸시 알림을 보내지 않습니다.</p>
                      <p className="mt-1">지금은 저장, 수정, 사용 체크 흐름을 먼저 검증합니다.</p>
                    </div>
                  </div>

                  {statusMessage && draft.catalogKind !== 'subscription' ? (
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
                        {selectedPreset.template.seedMeta.membershipGrade}
                      </span>
                    ) : null}
                    {draft.selectedTier ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {draft.selectedTier}
                      </span>
                    ) : null}
                    {draft.price ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {draft.price.toLocaleString('ko-KR')}원
                      </span>
                    ) : null}
                  </div>
                </section>

                {draft.catalogKind === 'subscription' ? (
                  <SubscriptionDesktopEditor
                    draft={draft}
                    statusMessage={statusMessage}
                    paymentCycleLabels={paymentCycleLabels}
                    paymentMethodLabels={paymentMethodLabels}
                    trackerAmountInputs={trackerAmountInputs}
                    onUpdateDraft={updateDraft}
                    onUpdateUsageEntry={updateUsageEntry}
                    onRemoveUsageHistoryEntry={removeUsageHistoryEntry}
                    onUpdatePhoto={updatePhoto}
                    onAddPhotoField={addPhotoField}
                    onRemovePhotoField={removePhotoField}
                    onUpdateSubProduct={updateSubProduct}
                    onUpdateTrackerNote={updateTrackerNote}
                    onUpdateTrackerPhoto={updateTrackerPhoto}
                    onAddTrackerPhotoField={addTrackerPhotoField}
                    onRemoveTrackerPhotoField={removeTrackerPhotoField}
                    onAddTrackerCheckboxEntry={addTrackerCheckboxEntry}
                    onAddTrackerAmountEntry={addTrackerAmountEntry}
                    onRemoveTrackerEntry={removeTrackerEntry}
                    onSetTrackerAmountInput={(trackerId, value) =>
                      setTrackerAmountInputs((prev) => ({
                        ...prev,
                        [trackerId]: value,
                      }))
                    }
                    onResetDraft={handleResetDraft}
                    onSaveDraft={handleSaveDraft}
                  />
                ) : (
                  <>
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
                      설명 / 상품 메모
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft('description', event.target.value)}
                      rows={4}
                      className={inputClassName}
                      placeholder="예: 이번 달엔 영화 예매 먼저 사용 / 결제카드 변경 예정"
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-4 md:flex-row">
                    <label className="flex flex-1 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">상품 활성화</p>
                        <p className="text-xs text-slate-500">꺼도 목록에는 남고 관리만 멈춥니다.</p>
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

                {draft.supportsBilling ? (
                  <section className={sectionCardClassName}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          결제 / 갱신 정보
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          타입 A와 C 상품에서 결제일, 티어, 가격, 결제수단을 함께 저장합니다.
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        저장 후 내 구독에서 다시 수정 가능
                      </span>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          상품 티어
                        </label>
                        <input
                          value={draft.selectedTier}
                          onChange={(event) => updateDraft('selectedTier', event.target.value)}
                          className={inputClassName}
                          placeholder="예: 광고형 스탠다드 / 월간 결제"
                        />
                        {draft.tierSuggestions.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {draft.tierSuggestions.map((tier) => (
                              <button
                                key={tier}
                                type="button"
                                onClick={() => updateDraft('selectedTier', tier)}
                                className={`rounded-full px-3 py-1 text-xs transition ${
                                  draft.selectedTier === tier
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {tier}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          가격
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={draft.price ?? ''}
                          onChange={(event) =>
                            updateDraft(
                              'price',
                              event.target.value === ''
                                ? null
                                : Number(event.target.value)
                            )
                          }
                          className={inputClassName}
                          placeholder="예: 9900"
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          결제 주기
                        </label>
                        <select
                          value={draft.billingCycle}
                          onChange={(event) =>
                            updateDraft('billingCycle', event.target.value as PaymentCycle)
                          }
                          className={inputClassName}
                        >
                          {(Object.keys(paymentCycleLabels) as PaymentCycle[]).map((cycle) => (
                            <option key={cycle} value={cycle}>
                              {paymentCycleLabels[cycle]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          결제 방법 유형
                        </label>
                        <select
                          value={draft.paymentMethodType}
                          onChange={(event) =>
                            updateDraft(
                              'paymentMethodType',
                              event.target.value as PaymentMethodType
                            )
                          }
                          className={inputClassName}
                        >
                          {(Object.keys(paymentMethodLabels) as PaymentMethodType[]).map(
                            (method) => (
                              <option key={method} value={method}>
                                {paymentMethodLabels[method]}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          결제일
                        </label>
                        <input
                          type="date"
                          value={draft.paymentDate}
                          onChange={(event) => updateDraft('paymentDate', event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          상품 갱신일
                        </label>
                        <input
                          type="date"
                          value={draft.renewalDate}
                          onChange={(event) => updateDraft('renewalDate', event.target.value)}
                          className={inputClassName}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          결제수단 이름
                        </label>
                        <input
                          value={draft.paymentMethodLabel}
                          onChange={(event) =>
                            updateDraft('paymentMethodLabel', event.target.value)
                          }
                          className={inputClassName}
                          placeholder={`예: ${
                            draft.paymentMethodType === 'card' ? '국민카드' : '생활비 통장'
                          }`}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className={sectionCardClassName}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        통신사 / 공식 안내 URL
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        원문 페이지에서 최신 조건과 혜택 상세를 직접 확인할 수 있습니다.
                      </p>
                    </div>
                    {draft.sourceCheckedAt ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                        확인 기준 {draft.sourceCheckedAt}
                      </span>
                    ) : null}
                  </div>

                  {draft.sourceUrls.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {draft.sourceUrls.map((url, index) => (
                        <div
                          key={`${draft.seedKey}-source-${index}`}
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
                      이 항목에는 연결된 공식 안내 URL이 아직 없습니다.
                    </div>
                  )}
                </section>

                {draft.productType === 'B' ? (
                  <section className={sectionCardClassName}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          사용 체크 관리
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          사용 시 직접 체크해서 관리하고, 제한을 넘기면 경고 후 강제 기록을 허용합니다.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {buildRuleSummary(
                          draft.customRules.usageCycleUnit,
                          draft.customRules.usageCycleLimit,
                          draft.customRules.annualLimit
                        )}
                      </span>
                    </div>

                    {draft.customRules.annualLimit ? (
                      <div className="mt-5 grid gap-3">
                        {Array.from({ length: draft.customRules.annualLimit }).map(
                          (_, slotIndex) => {
                            const entry = draft.usageEntries[slotIndex];
                            const isNextAvailable = slotIndex <= draft.usageEntries.length;

                            return (
                              <label
                                key={`${draft.id}-usage-slot-${slotIndex}`}
                                className={`flex items-center justify-between rounded-[24px] border px-4 py-4 ${
                                  entry
                                    ? 'border-[rgba(42,157,143,0.28)] bg-[rgba(42,157,143,0.06)]'
                                    : 'border-slate-200 bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(entry)}
                                    disabled={!entry && !isNextAvailable}
                                    onChange={() => updateUsageEntry(slotIndex)}
                                    className="h-5 w-5 accent-[var(--brand-coral)] disabled:cursor-not-allowed"
                                  />
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">
                                      사용 {slotIndex + 1}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {entry
                                        ? '체크 완료'
                                        : isNextAvailable
                                          ? '터치해서 기록'
                                          : '앞선 사용 기록부터 순서대로 체크'}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-sm text-slate-600">
                                  {entry ? formatDateTime(entry.checkedAt) : '미기록'}
                                </p>
                              </label>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        <button
                          type="button"
                          onClick={() => updateUsageEntry(draft.usageEntries.length)}
                          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                        >
                          사용 기록 추가
                        </button>
                        {draft.usageEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                          >
                            <p className="text-sm text-slate-700">
                              {formatDateTime(entry.checkedAt)}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeUsageHistoryEntry(entry.id)}
                              className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

                {draft.productType === 'C' ? (
                  <section className={sectionCardClassName}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          브랜드별 혜택 관리
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          제휴처별로 체크 기록, 금액 사용 내역, 개별 메모와 이미지까지 따로 관리합니다.
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        타입 C 상세 운영 로직 반영
                      </span>
                    </div>

                    <div className="mt-5 space-y-5">
                      {draft.benefitTrackers.map((tracker) => {
                        const sharedBudgetTotal =
                          tracker.sharedBudgetKey && tracker.cycleAmountLimit
                            ? draft.benefitTrackers
                                .filter(
                                  (item) => item.sharedBudgetKey === tracker.sharedBudgetKey
                                )
                                .reduce(
                                  (total, item) =>
                                    total + sumAmountsInMonth(item.entries, new Date().toISOString()),
                                  0
                                )
                            : null;

                        return (
                          <div
                            key={tracker.id}
                            className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-semibold text-slate-900">
                                    {tracker.title}
                                  </h4>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                                    {tracker.entryMode === 'amount' ? '금액 기록형' : '체크형'}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  {tracker.description}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                                  {buildRuleSummary(
                                    tracker.cycleUnit,
                                    tracker.cycleLimit ?? null,
                                    tracker.annualLimit ?? null
                                  )}
                                </span>
                                {tracker.cycleAmountLimit ? (
                                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                                    월 {tracker.cycleAmountLimit.toLocaleString('ko-KR')}원
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {sharedBudgetTotal !== null && tracker.cycleAmountLimit ? (
                              <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                                이번 달 세븐일레븐/투썸플레이스 합산 사용액:
                                <span className="ml-2 font-semibold text-slate-900">
                                  {sharedBudgetTotal.toLocaleString('ko-KR')}원
                                </span>
                              </div>
                            ) : null}

                            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr),320px]">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                  개별 메모
                                </label>
                                <textarea
                                  value={tracker.note}
                                  onChange={(event) =>
                                    updateTrackerNote(tracker.id, event.target.value)
                                  }
                                  rows={3}
                                  className={inputClassName}
                                  placeholder={
                                    tracker.notePlaceholder ||
                                    '기프트카드 번호, 바코드 위치, 사용 메모 등을 적어두세요.'
                                  }
                                />
                              </div>

                              <div>
                                {tracker.entryMode === 'amount' ? (
                                  <>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      이번 사용 금액
                                    </label>
                                    <div className="flex gap-3">
                                      <input
                                        type="number"
                                        min="0"
                                        value={trackerAmountInputs[tracker.id] || ''}
                                        onChange={(event) =>
                                          setTrackerAmountInputs((prev) => ({
                                            ...prev,
                                            [tracker.id]: event.target.value,
                                          }))
                                        }
                                        className={inputClassName}
                                        placeholder="예: 8900"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => addTrackerAmountEntry(tracker.id)}
                                        className="rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                                      >
                                        기록
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <label className="mb-2 block text-sm font-medium text-slate-700">
                                      사용 체크
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => addTrackerCheckboxEntry(tracker.id)}
                                      className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                                    >
                                      체크 기록 추가
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-5">
                              <ImageUploadArrayField
                                title="개별 첨부 이미지"
                                description="혜택별 메모와 함께 볼 이미지를 Cloudinary에 업로드합니다."
                                images={tracker.photos}
                                onAdd={() => addTrackerPhotoField(tracker.id)}
                                onChange={(photoIndex, value) =>
                                  updateTrackerPhoto(tracker.id, photoIndex, value)
                                }
                                onRemove={(photoIndex) =>
                                  removeTrackerPhotoField(tracker.id, photoIndex)
                                }
                                customNamePrefix={`workspace-${draft.id}-${tracker.id}`}
                                addButtonLabel="이미지 추가"
                                gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                                slotEmptyLabel="트래커 이미지"
                              />
                            </div>

                            <div className="mt-5 space-y-3">
                              {tracker.entries.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                  아직 기록이 없습니다.
                                </div>
                              ) : (
                                tracker.entries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-white bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-slate-800">
                                        {formatDateTime(entry.checkedAt)}
                                      </p>
                                      {typeof entry.amount === 'number' ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                          사용 금액 {entry.amount.toLocaleString('ko-KR')}원
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeTrackerEntry(tracker.id, entry.id)}
                                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                    >
                                      기록 삭제
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {draft.catalogKind === 'telecom' ? (
                  <>
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
                      <h3 className="text-lg font-semibold text-slate-900">
                        추적 규칙 커스터마이징
                      </h3>

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
                  </>
                ) : null}

                <section className={sectionCardClassName}>
                  <ImageUploadArrayField
                    title="첨부 이미지"
                    description="상품 관련 이미지를 Cloudinary에 업로드해 저장합니다."
                    images={draft.photos}
                    onAdd={addPhotoField}
                    onChange={updatePhoto}
                    onRemove={removePhotoField}
                    customNamePrefix={`workspace-${draft.id}`}
                    addButtonLabel="이미지 추가"
                    gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    slotEmptyLabel="첨부 이미지"
                  />
                </section>

                {draft.subProducts.length > 0 ? (
                  <section className={sectionCardClassName}>
                    <h3 className="text-lg font-semibold text-slate-900">
                      기본 혜택 / 서브 항목
                    </h3>
                    <div className="mt-5 space-y-4">
                      {draft.subProducts.map((subProduct, index) => (
                        <div
                          key={`${draft.id}-subproduct-${index}`}
                          className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="grid gap-4 lg:grid-cols-4">
                            <div className="lg:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-slate-700">
                                항목명
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
                ) : null}

                <section className={sectionCardClassName}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm leading-6 text-slate-600">
                      <p>저장하면 이 브라우저에서 다시 불러와 수정하고 체크 기록을 이어갈 수 있습니다.</p>
                      <p>모바일 앱 단계에서는 이 구조를 서버 저장, 로컬 알림, 이미지 업로드와 연결하면 됩니다.</p>
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
                )}
              </>
            ) : (
              <section className={sectionCardClassName}>
                <h2 className="text-xl font-semibold text-slate-900">표시할 항목이 없습니다.</h2>
                <p className="mt-3 text-sm text-slate-600">
                  왼쪽에서 다른 필터를 선택하거나 검색어를 지워보세요.
                </p>
              </section>
            )}

            <section ref={savedSectionRef} className={sectionCardClassName}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">내 구독</h2>
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
                          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                            {productTypeLabels[config.productType]}
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
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {config.selectedTier ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              {config.selectedTier}
                            </span>
                          ) : null}
                          {config.price ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              {config.price.toLocaleString('ko-KR')}원
                            </span>
                          ) : null}
                          {config.paymentDate ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              결제일 {config.paymentDate}
                            </span>
                          ) : null}
                          {config.renewalDate ? (
                            <span className="rounded-full bg-white px-3 py-1">
                              갱신일 {config.renewalDate}
                            </span>
                          ) : null}
                        </div>
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
                          불러와서 관리
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
                    아직 저장된 내 구독 항목이 없습니다. 상품을 선택해 값을 조정한 뒤 저장해보세요.
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
