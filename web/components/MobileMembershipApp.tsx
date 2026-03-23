import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  PaymentCycle,
  PaymentMethodType,
  ReminderRepeatUnit,
  SeedData,
  SeedPreset,
  UsageEntry,
  UserMembershipConfig,
  buildCatalogPresets,
  createDraftFromSeedPreset,
  getMobileCategoryKey,
  loadSavedMembershipConfigs,
  normalizePresetRowToManagedSeedPreset,
  normalizePhotos,
  persistMembershipConfigs,
} from '../lib/user-membership';

type MobileTab = 'home' | 'recommend' | 'saved' | 'settings';
type MobileFilter = 'all' | 'ott' | 'delivery' | 'telecom' | 't-universe';

interface MobileMembershipAppProps {
  seedData: SeedData;
}

type HomeCategoryId = Exclude<MobileFilter, 'all'>;

interface CategoryViewState {
  id: HomeCategoryId;
  title: string;
}

interface DetailState {
  draft: UserMembershipConfig;
  preset: SeedPreset | null;
  source: 'catalog' | 'saved';
}

interface CalendarRecord {
  id: string;
  label: string;
  checkedAt: string;
}

const paymentCycleLabels: Record<PaymentCycle, string> = {
  monthly: '월 결제',
  yearly: '연간 결제',
};

const paymentMethodLabels: Record<PaymentMethodType, string> = {
  card: '카드',
  account: '계좌',
};

const mobileNavItems: Array<{ id: MobileTab; label: string }> = [
  { id: 'home', label: '홈' },
  { id: 'recommend', label: '추천' },
  { id: 'saved', label: '내 구독' },
  { id: 'settings', label: '설정' },
];

const myFilters: Array<{ id: MobileFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'ott', label: 'OTT' },
  { id: 'delivery', label: '배달' },
  { id: 'telecom', label: '통신사' },
  { id: 't-universe', label: 'T우주' },
];

const inputClassName =
  'w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500';

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
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

function buildRuleSummary(
  cycleUnit: ReminderRepeatUnit,
  cycleLimit: number | null,
  annualLimit: number | null
) {
  const labelMap: Record<ReminderRepeatUnit, string> = {
    day: '일',
    week: '주',
    month: '월',
    year: '년',
    event_window: '이벤트 기간',
  };

  const parts: string[] = [];
  if (cycleLimit) parts.push(`${labelMap[cycleUnit]} ${cycleLimit}회`);
  if (annualLimit) parts.push(`연 ${annualLimit}회`);
  return parts.join(', ') || '조건 확인 필요';
}

function getPreviewImage(
  preset: SeedPreset | null,
  config?: UserMembershipConfig | null
) {
  const configPhoto = config?.photos.find((photo) => photo.trim());
  const presetPhoto = preset?.template.seedMeta?.photos?.find((photo) => photo.trim());
  return configPhoto || presetPhoto || '';
}

function getFeaturedPresets(presets: SeedPreset[]) {
  const configured = [...presets]
    .filter((preset) => preset.template.seedMeta?.homeFeatured)
    .sort((left, right) => {
      const leftOrder = left.template.seedMeta?.homeFeaturedOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        right.template.seedMeta?.homeFeaturedOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left.name.localeCompare(right.name, 'ko-KR');
    });

  if (configured.length) {
    return configured;
  }

  const preferredKeys = [
    'sample-netflix-type-a',
    'sample-olive-young-calendar-type-d',
    'sample-t-universe-life-type-c',
    'sample-kt-vip-choice-type-b',
  ];

  const mapped = preferredKeys
    .map((key) => presets.find((preset) => preset.seedKey === key))
    .filter(Boolean) as SeedPreset[];

  return mapped.length ? mapped : presets.slice(0, 4);
}

function getRecommendedPresets(presets: SeedPreset[]) {
  const configured = [...presets]
    .filter((preset) => preset.template.seedMeta?.recommendVisible)
    .sort((left, right) => {
      const leftOrder = left.template.seedMeta?.recommendOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder =
        right.template.seedMeta?.recommendOrder ?? Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left.name.localeCompare(right.name, 'ko-KR');
    });

  if (configured.length) {
    return configured;
  }

  const recommendedKeys = [
    'sample-netflix-type-a',
    'sample-tving-type-a',
    'sample-kt-vip-choice-type-b',
    'sample-t-universe-life-type-c',
    'sample-olive-young-calendar-type-d',
    'sample-wavve-type-a',
  ];

  const items = recommendedKeys
    .map((key) => presets.find((preset) => preset.seedKey === key))
    .filter(Boolean) as SeedPreset[];

  return items.length ? items : presets.slice(0, 6);
}

function buildCalendarDays(year: number, month: number) {
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];

  for (let i = 0; i < startDay; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

interface MobileCalendarPanelProps {
  records: CalendarRecord[];
  selectedDateKey?: string;
  onSelectDate?: (dateKey: string) => void;
  showRecordsPanel?: boolean;
  helperText?: string;
  emptyText?: string;
}

function MobileCalendarPanel({
  records,
  selectedDateKey: controlledSelectedDateKey,
  onSelectDate,
  showRecordsPanel = true,
  helperText = '날짜를 선택하면 해당 날짜의 사용 기록을 볼 수 있습니다.',
  emptyText = '선택한 날짜의 기록이 없습니다.',
}: MobileCalendarPanelProps) {
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [internalSelectedDateKey, setInternalSelectedDateKey] = useState('');

  const grouped = useMemo(() => {
    return records.reduce<Record<string, CalendarRecord[]>>((acc, record) => {
      const key = record.checkedAt.slice(0, 10);
      acc[key] = [...(acc[key] || []), record];
      return acc;
    }, {});
  }, [records]);

  const selectedDateKey = controlledSelectedDateKey ?? internalSelectedDateKey;

  const monthCells = useMemo(
    () => buildCalendarDays(cursor.year, cursor.month),
    [cursor.month, cursor.year]
  );

  const visibleMonthLabel = `${cursor.year}. ${String(cursor.month + 1).padStart(2, '0')}`;

  const selectedRecords = selectedDateKey ? grouped[selectedDateKey] || [] : [];

  useEffect(() => {
    if (controlledSelectedDateKey !== undefined || selectedDateKey || !records.length) {
      return;
    }

    setInternalSelectedDateKey(records[0].checkedAt.slice(0, 10));
  }, [controlledSelectedDateKey, records, selectedDateKey]);

  useEffect(() => {
    if (!selectedDateKey) return;

    const selectedDate = new Date(selectedDateKey);
    if (Number.isNaN(selectedDate.getTime())) return;

    setCursor({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth(),
    });
  }, [selectedDateKey]);

  const handleSelectDate = (dateKey: string) => {
    if (controlledSelectedDateKey === undefined) {
      setInternalSelectedDateKey(dateKey);
    }

    onSelectDate?.(dateKey);
  };

  return (
    <div className="rounded-[24px] border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setCursor((prev) => {
              const nextMonth = prev.month === 0 ? 11 : prev.month - 1;
              const nextYear = prev.month === 0 ? prev.year - 1 : prev.year;
              return { year: nextYear, month: nextMonth };
            })
          }
          className="rounded-full px-3 py-2 text-sm text-slate-600"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-slate-900">{visibleMonthLabel}</p>
        <button
          type="button"
          onClick={() =>
            setCursor((prev) => {
              const nextMonth = prev.month === 11 ? 0 : prev.month + 1;
              const nextYear = prev.month === 11 ? prev.year + 1 : prev.year;
              return { year: nextYear, month: nextMonth };
            })
          }
          className="rounded-full px-3 py-2 text-sm text-slate-600"
        >
          →
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] text-slate-500">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {monthCells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-9 rounded-full" />;
          }

          const dateKey = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasRecords = Boolean(grouped[dateKey]?.length);
          const isSelected = selectedDateKey === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => handleSelectDate(dateKey)}
              className={`relative h-9 rounded-full text-sm transition ${
                isSelected
                  ? 'bg-slate-900 text-white'
                  : hasRecords
                    ? 'bg-[rgba(148,163,184,0.18)] text-slate-900'
                    : 'text-slate-600'
              }`}
            >
              {day}
              {hasRecords ? (
                <span
                  className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-[var(--brand-coral)]'
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {showRecordsPanel ? (
        <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
          {selectedDateKey ? (
            <>
              <p className="text-sm font-semibold text-slate-900">
                {formatDateLabel(selectedDateKey)}
              </p>
              <div className="mt-2 space-y-2">
                {selectedRecords.length ? (
                  selectedRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                    >
                      <p className="font-medium text-slate-900">{record.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(record.checkedAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">{emptyText}</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{helperText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface MobileDetailViewProps {
  detail: DetailState;
  onBack: () => void;
  onSave: () => void;
  onUpdateDraft: <K extends keyof UserMembershipConfig>(
    key: K,
    value: UserMembershipConfig[K]
  ) => void;
  onUpdatePhoto: (index: number, value: string) => void;
  onAddPhotoField: () => void;
  onRemovePhotoField: (index: number) => void;
  onUpdateUsageEntry: (slotIndex: number) => void;
  onRemoveUsageEntry: (entryId: string) => void;
  onAddTrackerEntry: (trackerId: string) => void;
  onRemoveTrackerEntry: (trackerId: string, entryId: string) => void;
  onSaveCalendarEntry: (dateKey: string, note: string) => void;
}

function MobileDetailView({
  detail,
  onBack,
  onSave,
  onUpdateDraft,
  onUpdatePhoto,
  onAddPhotoField,
  onRemovePhotoField,
  onUpdateUsageEntry,
  onRemoveUsageEntry,
  onAddTrackerEntry,
  onRemoveTrackerEntry,
  onSaveCalendarEntry,
}: MobileDetailViewProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState('');
  const [calendarNoteDraft, setCalendarNoteDraft] = useState('');
  const { draft, preset } = detail;
  const previewImage = getPreviewImage(preset, draft);

  const trackerGroups = useMemo(() => {
    return draft.benefitTrackers
      .filter((tracker) => tracker.displayMode !== 'info')
      .reduce<Record<string, typeof draft.benefitTrackers>>((acc, tracker) => {
        const key = tracker.groupTitle || tracker.title;
        acc[key] = [...(acc[key] || []), tracker];
        return acc;
      }, {});
  }, [draft.benefitTrackers]);

  const infoTrackers = useMemo(
    () => draft.benefitTrackers.filter((tracker) => tracker.displayMode === 'info'),
    [draft.benefitTrackers]
  );

  const usageCalendarRecords = useMemo<CalendarRecord[]>(() => {
    if (draft.productType === 'B') {
      return draft.usageEntries.map((entry, index) => ({
        id: entry.id,
        label: `사용 ${index + 1}`,
        checkedAt: entry.checkedAt,
      }));
    }

    if (draft.productType === 'C') {
      return draft.benefitTrackers
        .filter((tracker) => tracker.displayMode !== 'info')
        .flatMap((tracker) =>
          tracker.entries.map((entry) => ({
            id: entry.id,
            label: tracker.title,
            checkedAt: entry.checkedAt,
          }))
        );
    }

    return [];
  }, [draft.benefitTrackers, draft.productType, draft.usageEntries]);

  const typeDCalendarRecords = useMemo<CalendarRecord[]>(() => {
    if (draft.productType !== 'D') {
      return [];
    }

    return draft.calendarEntries.map((entry) => ({
      id: entry.id,
      label: entry.note,
      checkedAt: `${entry.dateKey}T12:00:00`,
    }));
  }, [draft.calendarEntries, draft.productType]);

  const selectedCalendarEntry =
    draft.productType === 'D' && selectedCalendarDateKey
      ? draft.calendarEntries.find((entry) => entry.dateKey === selectedCalendarDateKey) || null
      : null;

  useEffect(() => {
    setShowCalendar(false);

    if (draft.productType === 'D') {
      const defaultDateKey = draft.calendarEntries[0]?.dateKey || getTodayDateKey();
      const existingEntry =
        draft.calendarEntries.find((entry) => entry.dateKey === defaultDateKey) || null;
      setSelectedCalendarDateKey(defaultDateKey);
      setCalendarNoteDraft(existingEntry?.note || '');
      return;
    }

    setSelectedCalendarDateKey('');
    setCalendarNoteDraft('');
  }, [draft.id, draft.productType]);

  useEffect(() => {
    if (draft.productType !== 'D' || !selectedCalendarDateKey) {
      return;
    }

    const existingEntry =
      draft.calendarEntries.find((entry) => entry.dateKey === selectedCalendarDateKey) || null;
    setCalendarNoteDraft(existingEntry?.note || '');
  }, [draft.calendarEntries, draft.productType, selectedCalendarDateKey]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-400 bg-[#8d8d8d] px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="text-lg leading-none">
            ←
          </button>
          <p className="text-sm font-medium">{draft.displayName || 'title'}</p>
          <span className="w-5" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f4ef] px-4 pb-28 pt-4">
        <div className="space-y-4">
          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <div className="grid grid-cols-[92px,minmax(0,1fr)] gap-4">
              <div className="flex h-24 items-center justify-center overflow-hidden rounded-[22px] border border-slate-300 bg-[#f4f4f2] text-xs text-slate-500">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={draft.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  '상품 IMG'
                )}
              </div>
              <div className="min-w-0">
                <input
                  value={draft.displayName}
                  onChange={(event) => onUpdateDraft('displayName', event.target.value)}
                  className="w-full border-none bg-transparent p-0 text-[28px] font-semibold leading-tight text-slate-900 outline-none"
                />
                <p className="mt-3 text-sm text-slate-500">{draft.provider}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <p className="text-base font-semibold text-slate-900">상품설명</p>
            <textarea
              value={draft.description}
              onChange={(event) => onUpdateDraft('description', event.target.value)}
              rows={4}
              className={`${inputClassName} mt-3`}
            />
          </section>

          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <p className="text-base font-semibold text-slate-900">공식 안내 URL</p>
            <div className="mt-3 space-y-3">
              {draft.sourceUrls.length ? (
                draft.sourceUrls.map((url, index) => (
                  <a
                    key={`${draft.id}-mobile-url-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {url}
                  </a>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  연결된 공식 안내 URL이 없습니다.
                </p>
              )}
            </div>
          </section>

          {draft.productType === 'B' ? (
            <section className="rounded-[26px] border border-slate-300 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">사용 체크 관리</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {buildRuleSummary(
                      draft.customRules.usageCycleUnit,
                      draft.customRules.usageCycleLimit,
                      draft.customRules.annualLimit
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendar((prev) => !prev)}
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  월별 기록
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {Array.from({ length: draft.customRules.annualLimit || 6 }).map(
                  (_, slotIndex) => {
                    const entry = draft.usageEntries[slotIndex];
                    const isNextAvailable = slotIndex <= draft.usageEntries.length;

                    return (
                      <label
                        key={`${draft.id}-mobile-b-slot-${slotIndex}`}
                        className={`flex items-center justify-between rounded-[22px] border px-4 py-3 ${
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
                            onChange={() => onUpdateUsageEntry(slotIndex)}
                            className="h-5 w-5 accent-[var(--brand-coral)] disabled:cursor-not-allowed"
                          />
                          <p className="text-sm font-medium text-slate-800">
                            사용 {slotIndex + 1}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {entry ? formatDateTime(entry.checkedAt) : '미기록'}
                        </p>
                      </label>
                    );
                  }
                )}
              </div>

              {showCalendar ? (
                <div className="mt-4 space-y-3">
                  <MobileCalendarPanel records={usageCalendarRecords} />
                  {draft.usageEntries.length ? (
                    <div className="space-y-2">
                      {draft.usageEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onRemoveUsageEntry(entry.id)}
                          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          <span>{formatDateTime(entry.checkedAt)}</span>
                          <span className="text-red-500">삭제</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {draft.productType === 'C' ? (
            <section className="rounded-[26px] border border-slate-300 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">사용 체크 관리</p>
                  <p className="mt-1 text-xs text-slate-500">
                    체크형 혜택과 정보형 혜택을 분리해서 보여줍니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalendar((prev) => !prev)}
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                >
                  월별 기록
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {Object.entries(trackerGroups).map(([groupTitle, trackers]) => (
                  <div
                    key={groupTitle}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{groupTitle}</p>
                    <div className="mt-3 space-y-3">
                      {trackers.map((tracker) => {
                        const currentEntry = [...tracker.entries]
                          .reverse()
                          .find((entry) =>
                            isSameCycle(entry.checkedAt, new Date().toISOString(), tracker.cycleUnit)
                          );

                        return (
                          <div
                            key={tracker.id}
                            className="rounded-2xl border border-white bg-white px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <label className="flex min-w-0 flex-1 items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(currentEntry)}
                                  onChange={() => {
                                    if (currentEntry) {
                                      if (!confirm('이번 주기 체크를 해제할까요?')) return;
                                      onRemoveTrackerEntry(tracker.id, currentEntry.id);
                                      return;
                                    }

                                    onAddTrackerEntry(tracker.id);
                                  }}
                                  className="mt-1 h-5 w-5 accent-[var(--brand-coral)]"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800">
                                    {tracker.title}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {tracker.description}
                                  </p>
                                </div>
                              </label>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <p className="text-[11px] text-slate-500">
                                  {currentEntry
                                    ? formatDateTime(currentEntry.checkedAt)
                                    : '미사용'}
                                </p>
                                {currentEntry ? (
                                  <button
                                    type="button"
                                    onClick={() => onAddTrackerEntry(tracker.id)}
                                    className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-600"
                                  >
                                    + 기록
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {infoTrackers.map((tracker) => (
                  <div
                    key={tracker.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{tracker.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {tracker.description}
                    </p>
                  </div>
                ))}
              </div>

              {showCalendar ? (
                <div className="mt-4">
                  <MobileCalendarPanel records={usageCalendarRecords} />
                </div>
              ) : null}
            </section>
          ) : null}

          {draft.productType === 'D' ? (
            <section className="rounded-[26px] border border-slate-300 bg-white p-4">
              <div>
                <p className="text-base font-semibold text-slate-900">사용 체크 관리</p>
                <p className="mt-1 text-xs text-slate-500">
                  캘린더에서 날짜를 고르고 사용 메모를 저장하는 타입 D 화면입니다.
                </p>
              </div>

              <div className="mt-4">
                <MobileCalendarPanel
                  records={typeDCalendarRecords}
                  selectedDateKey={selectedCalendarDateKey}
                  onSelectDate={setSelectedCalendarDateKey}
                  showRecordsPanel={false}
                />
              </div>

              <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedCalendarDateKey
                    ? formatDateLabel(selectedCalendarDateKey)
                    : '날짜 선택'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedCalendarEntry
                    ? `마지막 저장 ${formatDateTime(selectedCalendarEntry.savedAt)}`
                    : '선택한 날짜에 남길 메모를 입력해 저장하세요.'}
                </p>
                <textarea
                  value={calendarNoteDraft}
                  onChange={(event) => setCalendarNoteDraft(event.target.value)}
                  rows={3}
                  className={`${inputClassName} mt-3`}
                  placeholder="예: 사용자가 생성한 메모 입력"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCalendarDateKey) {
                      alert('날짜를 선택해 주세요.');
                      return;
                    }

                    if (!calendarNoteDraft.trim()) {
                      alert('메모를 입력한 뒤 저장해 주세요.');
                      return;
                    }

                    onSaveCalendarEntry(selectedCalendarDateKey, calendarNoteDraft);
                  }}
                  className="mt-3 w-full rounded-[20px] bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  저장
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <p className="text-base font-semibold text-slate-900">사용자 메모</p>
            <textarea
              value={draft.userMemo}
              onChange={(event) => onUpdateDraft('userMemo', event.target.value)}
              rows={4}
              className={`${inputClassName} mt-3`}
              placeholder="예: 프로필 4개 사용 / 가족 공유 / 사용 메모"
            />
          </section>

          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-slate-900">첨부 이미지</p>
              <button
                type="button"
                onClick={onAddPhotoField}
                disabled={draft.photos.length >= 10}
                className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
              >
                + 추가
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {draft.photos.map((photo, index) => (
                <div key={`${draft.id}-mobile-photo-${index}`}>
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[20px] border border-slate-300 bg-[#f4f4f2] text-xs text-slate-500">
                    {photo ? (
                      <img
                        src={photo}
                        alt={`첨부 이미지 ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      'IMG'
                    )}
                  </div>
                  <input
                    value={photo}
                    onChange={(event) => onUpdatePhoto(index, event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-[11px] text-slate-700 outline-none"
                    placeholder={`URL ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => onRemovePhotoField(index)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-2 py-2 text-[11px] text-slate-600"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-300 bg-white p-4">
            <p className="text-base font-semibold text-slate-900">결제정보</p>
            <div className="mt-4 grid gap-3">
              <input
                value={draft.selectedTier}
                onChange={(event) => onUpdateDraft('selectedTier', event.target.value)}
                className={inputClassName}
                placeholder="상품 티어 또는 플랜명"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={draft.billingCycle}
                  onChange={(event) =>
                    onUpdateDraft('billingCycle', event.target.value as PaymentCycle)
                  }
                  className={inputClassName}
                >
                  {(Object.keys(paymentCycleLabels) as PaymentCycle[]).map((cycle) => (
                    <option key={cycle} value={cycle}>
                      {paymentCycleLabels[cycle]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={draft.price ?? ''}
                  onChange={(event) =>
                    onUpdateDraft(
                      'price',
                      event.target.value === '' ? null : Number(event.target.value)
                    )
                  }
                  className={inputClassName}
                  placeholder="가격"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={draft.paymentDate}
                  onChange={(event) => onUpdateDraft('paymentDate', event.target.value)}
                  className={inputClassName}
                />
                <input
                  type="date"
                  value={draft.startedAt}
                  onChange={(event) => onUpdateDraft('startedAt', event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={draft.paymentMethodType}
                  onChange={(event) =>
                    onUpdateDraft(
                      'paymentMethodType',
                      event.target.value as PaymentMethodType
                    )
                  }
                  className={inputClassName}
                >
                  {(Object.keys(paymentMethodLabels) as PaymentMethodType[]).map((method) => (
                    <option key={method} value={method}>
                      {paymentMethodLabels[method]}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.paymentMethodLabel}
                  onChange={(event) =>
                    onUpdateDraft('paymentMethodLabel', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="카드명 또는 계좌명"
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onBack}
              className="rounded-[22px] border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded-[22px] bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              {detail.source === 'saved' ? '수정 저장' : '개인 설정 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MobileMembershipApp({ seedData }: MobileMembershipAppProps) {
  const [remoteProductPresets, setRemoteProductPresets] = useState<SeedPreset[]>([]);
  const presets = useMemo(
    () =>
      buildCatalogPresets(seedData, remoteProductPresets).filter((preset) => {
        const seedMeta = preset.template.seedMeta || {};

        return (
          (seedMeta.catalogKind || 'telecom') === 'subscription' &&
          seedMeta.mobileEnabled !== false
        );
      }),
    [remoteProductPresets, seedData]
  );
  const featuredPresets = useMemo(() => getFeaturedPresets(presets), [presets]);
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [savedConfigs, setSavedConfigs] = useState<UserMembershipConfig[]>([]);
  const [activeFilter, setActiveFilter] = useState<MobileFilter>('all');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [categoryView, setCategoryView] = useState<CategoryViewState | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    setSavedConfigs(loadSavedMembershipConfigs());
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRemoteProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_presets')
          .select('*')
          .eq('is_official', true)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const nextPresets =
          data
            ?.map((row) => normalizePresetRowToManagedSeedPreset(row))
            .filter(
              (preset) =>
                (preset.template.seedMeta?.catalogKind || 'telecom') === 'subscription'
            ) || [];

        if (isMounted) {
          setRemoteProductPresets(nextPresets);
        }
      } catch (error) {
        console.error('Failed to load mobile products:', error);
      }
    };

    void loadRemoteProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage('');
    }, 2400);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (featuredIndex < featuredPresets.length) {
      return;
    }

    setFeaturedIndex(0);
  }, [featuredIndex, featuredPresets.length]);

  const homeSections = useMemo(() => {
    const sectionOrder: Array<{ id: HomeCategoryId; title: string }> = [
      { id: 'ott', title: 'OTT 스트리밍' },
      { id: 'delivery', title: '배달' },
      { id: 'telecom', title: '통신사 & 혜택' },
      { id: 't-universe', title: 'T우주 / 생활' },
    ];

    return sectionOrder
      .map((section) => ({
        ...section,
        items: presets.filter((preset) => {
          const category = getMobileCategoryKey({
            name: preset.name,
            provider: preset.provider,
            carrier: preset.template.seedMeta?.carrier,
            sourceUrls: preset.template.seedMeta?.sourceUrls,
            mobileCategory: preset.template.seedMeta?.mobileCategory,
          });
          return category === section.id;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [presets]);

  const recommendedPresets = useMemo(() => {
    return getRecommendedPresets(presets);
  }, [presets]);

  const filteredSavedConfigs = useMemo(() => {
    if (activeFilter === 'all') {
      return savedConfigs;
    }

    return savedConfigs.filter((config) => {
      const category = getMobileCategoryKey({
        displayName: config.displayName,
        provider: config.provider,
        carrier: config.carrier,
        sourceUrls: config.sourceUrls,
        mobileCategory: config.mobileCategory,
      });
      return category === activeFilter;
    });
  }, [activeFilter, savedConfigs]);

  const activeCategorySection = useMemo(() => {
    if (!categoryView) return null;
    return homeSections.find((section) => section.id === categoryView.id) || null;
  }, [categoryView, homeSections]);

  const openPresetDetail = (preset: SeedPreset) => {
    setDetail({
      draft: createDraftFromSeedPreset(preset),
      preset,
      source: 'catalog',
    });
  };

  const openSavedDetail = (config: UserMembershipConfig) => {
    setCategoryView(null);
    setDetail({
      draft: cloneConfig(config),
      preset: presets.find((preset) => preset.seedKey === config.seedKey) || null,
      source: 'saved',
    });
  };

  const updateDetailDraft = <K extends keyof UserMembershipConfig>(
    key: K,
    value: UserMembershipConfig[K]
  ) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              [key]: value,
            },
          }
        : prev
    );
  };

  const updateDetailPhoto = (index: number, value: string) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const nextPhotos = [...prev.draft.photos];
      nextPhotos[index] = value;

      return {
        ...prev,
        draft: {
          ...prev.draft,
          photos: nextPhotos.slice(0, 10),
        },
      };
    });
  };

  const addDetailPhotoField = () => {
    setDetail((prev) => {
      if (!prev || prev.draft.photos.length >= 10) return prev;

      return {
        ...prev,
        draft: {
          ...prev.draft,
          photos: [...prev.draft.photos, ''],
        },
      };
    });
  };

  const removeDetailPhotoField = (index: number) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const nextPhotos = prev.draft.photos.filter((_, photoIndex) => photoIndex !== index);

      return {
        ...prev,
        draft: {
          ...prev.draft,
          photos: nextPhotos.length ? nextPhotos : [''],
        },
      };
    });
  };

  const updateDetailUsageEntry = (slotIndex: number) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const annualLimit = prev.draft.customRules.annualLimit;
      const nextEntries = [...prev.draft.usageEntries];

      if (slotIndex < nextEntries.length) {
        if (!confirm('이 사용 기록을 해제할까요?')) return prev;
        nextEntries.splice(slotIndex, 1);
      } else {
        if (annualLimit && nextEntries.length >= annualLimit) {
          alert(`이 상품은 연 ${annualLimit}회까지만 기록할 수 있습니다.`);
          return prev;
        }

        const now = new Date().toISOString();
        const cycleLimit = prev.draft.customRules.usageCycleLimit;
        const cycleUnit = prev.draft.customRules.usageCycleUnit;
        const cycleCount = countEntriesInCycle(nextEntries, now, cycleUnit);

        if (
          cycleLimit &&
          cycleCount >= cycleLimit &&
          !confirm(
            prev.draft.usageOverflowMessage ||
              `${prev.draft.displayName}는 ${buildRuleSummary(
                cycleUnit,
                cycleLimit,
                prev.draft.customRules.annualLimit
              )} 조건입니다. 그래도 기록할까요?`
          )
        ) {
          return prev;
        }

        nextEntries.push({
          id: `${prev.draft.id}-mobile-usage-${Date.now()}`,
          checkedAt: now,
        });
      }

      return {
        ...prev,
        draft: {
          ...prev.draft,
          usageEntries: nextEntries,
        },
      };
    });
  };

  const removeDetailUsageEntry = (entryId: string) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              usageEntries: prev.draft.usageEntries.filter((entry) => entry.id !== entryId),
            },
          }
        : prev
    );
  };

  const addDetailTrackerEntry = (trackerId: string) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const now = new Date().toISOString();
      const nextTrackers = prev.draft.benefitTrackers.map((tracker) => {
        if (tracker.id !== trackerId) return tracker;

        const cycleCount = countEntriesInCycle(tracker.entries, now, tracker.cycleUnit);

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
        draft: {
          ...prev.draft,
          benefitTrackers: nextTrackers,
        },
      };
    });
  };

  const removeDetailTrackerEntry = (trackerId: string, entryId: string) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              benefitTrackers: prev.draft.benefitTrackers.map((tracker) =>
                tracker.id === trackerId
                  ? {
                      ...tracker,
                      entries: tracker.entries.filter((entry) => entry.id !== entryId),
                    }
                  : tracker
              ),
            },
          }
        : prev
    );
  };

  const saveDetailCalendarEntry = (dateKey: string, note: string) => {
    setDetail((prev) => {
      if (!prev) return prev;

      const trimmedNote = note.trim();
      if (!trimmedNote) return prev;

      const now = new Date().toISOString();
      const existingEntry =
        prev.draft.calendarEntries.find((entry) => entry.dateKey === dateKey) || null;
      const nextEntry = existingEntry
        ? {
            ...existingEntry,
            note: trimmedNote,
            savedAt: now,
          }
        : {
            id: `${prev.draft.id}-calendar-${Date.now()}`,
            dateKey,
            note: trimmedNote,
            savedAt: now,
          };

      return {
        ...prev,
        draft: {
          ...prev.draft,
          calendarEntries: [
            ...prev.draft.calendarEntries.filter((entry) => entry.dateKey !== dateKey),
            nextEntry,
          ].sort((left, right) => left.dateKey.localeCompare(right.dateKey)),
        },
      };
    });
  };

  const saveDetail = () => {
    if (!detail) return;

    const normalizedDraft: UserMembershipConfig = {
      ...detail.draft,
      photos: normalizePhotos(detail.draft.photos),
      benefitTrackers: detail.draft.benefitTrackers.map((tracker) => ({
        ...tracker,
        photos: normalizePhotos(tracker.photos),
      })),
      updatedAt: new Date().toISOString(),
    };

    const isExisting = savedConfigs.some((config) => config.id === normalizedDraft.id);
    const nextDraft = {
      ...normalizedDraft,
      createdAt: isExisting ? normalizedDraft.createdAt : new Date().toISOString(),
      id: isExisting
        ? normalizedDraft.id
        : `saved-mobile-${normalizedDraft.seedKey}-${Date.now()}`,
    };

    const nextConfigs = isExisting
      ? savedConfigs.map((config) => (config.id === nextDraft.id ? nextDraft : config))
      : [nextDraft, ...savedConfigs];

    setSavedConfigs(nextConfigs);
    persistMembershipConfigs(nextConfigs);
    setStatusMessage(
      isExisting ? '내 구독 항목을 수정했습니다.' : '내 구독에 저장했습니다.'
    );
    setActiveTab('saved');
    setCategoryView(null);
    setDetail(null);
  };

  const renderPreviewCard = (preset: SeedPreset, emphasis = false) => {
    const image = getPreviewImage(preset, null);

    return (
      <button
        key={preset.seedKey}
        type="button"
        onClick={() => openPresetDetail(preset)}
        className={`w-full rounded-[28px] border border-slate-300 bg-white p-4 text-left shadow-sm transition ${
          emphasis ? 'min-h-[260px]' : 'min-h-[220px]'
        }`}
      >
        <p className="text-[29px] font-semibold leading-tight text-slate-900">
          {preset.name}
        </p>
        <p className="mt-1 text-lg text-slate-600">{preset.description}</p>
        <div className="mt-5 flex min-h-[140px] items-center justify-center overflow-hidden rounded-[24px] border border-slate-300 bg-[#f4f4f2] text-center text-2xl text-slate-500">
          {image ? (
            <img src={image} alt={preset.name} className="h-full w-full object-cover" />
          ) : (
            <div className="px-6 leading-snug">
              {preset.name}
              <br />
              안내 이미지
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#ecebe7] py-0 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col overflow-hidden border-x border-slate-300 bg-[#f8f7f3] shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {detail ? (
          <MobileDetailView
            detail={detail}
            onBack={() => setDetail(null)}
            onSave={saveDetail}
            onUpdateDraft={updateDetailDraft}
            onUpdatePhoto={updateDetailPhoto}
            onAddPhotoField={addDetailPhotoField}
            onRemovePhotoField={removeDetailPhotoField}
            onUpdateUsageEntry={updateDetailUsageEntry}
            onRemoveUsageEntry={removeDetailUsageEntry}
            onAddTrackerEntry={addDetailTrackerEntry}
            onRemoveTrackerEntry={removeDetailTrackerEntry}
            onSaveCalendarEntry={saveDetailCalendarEntry}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-28">
            {categoryView ? (
              <div className="border-b border-slate-400 bg-[#8d8d8d] px-4 py-3 text-white">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCategoryView(null)}
                    className="text-lg leading-none"
                  >
                    ←
                  </button>
                  <p className="text-lg font-medium">{categoryView.title}</p>
                  <span className="w-5" />
                </div>
              </div>
            ) : (
              <div className="border-b border-slate-400 bg-[#8d8d8d] px-4 py-4 text-center text-2xl font-medium text-white">
                {activeTab === 'home'
                  ? '구독관리'
                  : activeTab === 'recommend'
                    ? '추천'
                    : activeTab === 'saved'
                      ? '내 구독 상품'
                      : '설정'}
              </div>
            )}

            {statusMessage ? (
              <div className="px-4 pt-4">
                <div className="rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
                  {statusMessage}
                </div>
              </div>
            ) : null}

            {categoryView ? (
              <div className="space-y-5 px-4 py-5">
                <div className="rounded-[24px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                  {activeCategorySection
                    ? `${activeCategorySection.title} 카테고리 상품 ${activeCategorySection.items.length}개`
                    : '선택한 카테고리 상품을 불러오는 중입니다.'}
                </div>

                {activeCategorySection?.items.length ? (
                  activeCategorySection.items.map((preset) => renderPreviewCard(preset, true))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
                    이 카테고리에 표시할 상품이 아직 없습니다.
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'home' && !categoryView ? (
              <div className="space-y-8 px-4 py-5">
                <section>
                  <div
                    onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX || null)}
                    onTouchEnd={(event) => {
                      if (touchStartX === null) return;
                      const delta = (event.changedTouches[0]?.clientX || 0) - touchStartX;
                      if (delta > 36) {
                        setFeaturedIndex((prev) =>
                          prev === 0 ? featuredPresets.length - 1 : prev - 1
                        );
                      } else if (delta < -36) {
                        setFeaturedIndex((prev) =>
                          prev === featuredPresets.length - 1 ? 0 : prev + 1
                        );
                      }
                      setTouchStartX(null);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openPresetDetail(featuredPresets[featuredIndex])}
                      className="w-full rounded-[30px] border border-slate-300 bg-white p-4 text-left shadow-sm"
                    >
                      <div className="grid grid-cols-[116px,minmax(0,1fr)] gap-4">
                        <div className="flex h-28 items-center justify-center overflow-hidden rounded-[22px] border border-slate-300 bg-[#f4f4f2] text-sm text-slate-500">
                          {getPreviewImage(featuredPresets[featuredIndex], null) ? (
                            <img
                              src={getPreviewImage(featuredPresets[featuredIndex], null)}
                              alt={featuredPresets[featuredIndex].name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            '상품 IMG'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-4xl font-semibold leading-tight text-slate-900">
                            {featuredPresets[featuredIndex].name}
                          </p>
                          <p className="mt-3 text-lg leading-7 text-slate-600">
                            {featuredPresets[featuredIndex].description}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center gap-2">
                    {featuredPresets.map((preset, index) => (
                      <button
                        key={preset.seedKey}
                        type="button"
                        onClick={() => setFeaturedIndex(index)}
                        className={`h-3 w-3 rounded-full ${
                          featuredIndex === index ? 'bg-slate-700' : 'bg-slate-300'
                        }`}
                        aria-label={`${preset.name} 보기`}
                      />
                    ))}
                  </div>
                </section>

                {homeSections.map((section) => (
                  <section key={section.id}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-[32px] font-semibold leading-tight text-slate-900">
                        {section.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryView({
                            id: section.id,
                            title: section.title,
                          })
                        }
                        className="text-sm text-slate-500"
                      >
                        전체 보기
                      </button>
                    </div>
                    <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                      {section.items.map((preset) => (
                        <button
                          key={preset.seedKey}
                          type="button"
                          onClick={() => openPresetDetail(preset)}
                          className="min-w-[164px] rounded-[26px] border border-slate-300 bg-white p-4 text-left shadow-sm"
                        >
                          <div className="flex h-32 items-center justify-center rounded-[22px] border border-slate-300 bg-[#f4f4f2] text-lg font-medium text-slate-600">
                            {preset.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {activeTab === 'recommend' ? (
              <div className="space-y-5 px-4 py-5">
                {recommendedPresets.map((preset) => renderPreviewCard(preset, true))}
              </div>
            ) : null}

            {activeTab === 'saved' ? (
              <div className="px-4 py-5">
                <div className="flex gap-2 overflow-x-auto pb-3">
                  {myFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                      className={`whitespace-nowrap rounded-2xl border px-4 py-2 text-sm transition ${
                        activeFilter === filter.id
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 space-y-3">
                  {filteredSavedConfigs.map((config) => {
                    const linkedPreset =
                      presets.find((preset) => preset.seedKey === config.seedKey) || null;

                    return (
                      <button
                        key={config.id}
                        type="button"
                        onClick={() => openSavedDetail(config)}
                        className="flex w-full items-center gap-4 rounded-[24px] border border-slate-300 bg-white p-4 text-left shadow-sm"
                      >
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[18px] border border-slate-300 bg-[#f4f4f2] text-xs text-slate-500">
                          {getPreviewImage(linkedPreset, config) ? (
                            <img
                              src={getPreviewImage(linkedPreset, config)}
                              alt={config.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            '상품 IMG'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[30px] font-semibold leading-tight text-slate-900">
                            {config.displayName}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">{config.provider}</p>
                        </div>
                      </button>
                    );
                  })}

                  {filteredSavedConfigs.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
                      아직 저장된 내 구독이 없습니다.
                      <br />
                      홈이나 추천에서 상품을 골라 저장해보세요.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === 'settings' ? (
              <div className="space-y-4 px-4 py-5">
                <div className="rounded-[26px] border border-slate-300 bg-white p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">저장 위치</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    현재 모바일 샘플은 브라우저에만 저장됩니다.
                  </p>
                </div>
                <div className="rounded-[26px] border border-slate-300 bg-white p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">내 구독 개수</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {savedConfigs.length}
                  </p>
                </div>
                <div className="rounded-[26px] border border-slate-300 bg-white p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">빠른 이동</p>
                  <div className="mt-4 grid gap-3">
                    <Link
                      href="/"
                      className="rounded-[20px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      PC 버전 열기
                    </Link>
                    <Link
                      href="/admin"
                      className="rounded-[20px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      관리자 페이지 열기
                    </Link>
                  </div>
                </div>
                <div className="rounded-[26px] border border-slate-300 bg-white p-4 shadow-sm">
                  <p className="text-base font-semibold text-slate-900">안내</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    모바일 화면은 현재 앱 흐름 검증용 샘플입니다. 실제 푸시 알림과 이미지
                    업로드는 앱 단계에서 연결할 예정입니다.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-slate-300 bg-white">
          {mobileNavItems.map((item) => {
            const isActive = activeTab === item.id && !detail;

            return (
              <button
                key={item.id}
                type="button"
                    onClick={() => {
                      setDetail(null);
                      setCategoryView(null);
                      setActiveTab(item.id);
                    }}
                    className={`px-2 py-4 text-base font-medium transition ${
                  isActive ? 'bg-[#d8d8d8] text-slate-900' : 'text-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
