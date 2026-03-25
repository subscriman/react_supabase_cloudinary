import { useMemo, useState } from 'react';
import ImageUploadArrayField from './ImageUploadArrayField';
import {
  BenefitTrackerState,
  PaymentCycle,
  PaymentMethodType,
  ReminderRepeatUnit,
  SeedPreset,
  UsageEntry,
  UserMembershipConfig,
} from '../lib/user-membership';

interface SubscriptionMobileEditorProps {
  draft: UserMembershipConfig;
  selectedPreset: SeedPreset;
  carrierLabel: string;
  productTypeLabel: string;
  statusMessage: string;
  paymentCycleLabels: Record<PaymentCycle, string>;
  paymentMethodLabels: Record<PaymentMethodType, string>;
  onUpdateDraft: <K extends keyof UserMembershipConfig>(
    key: K,
    value: UserMembershipConfig[K]
  ) => void;
  onUpdateReminder: (
    key: keyof UserMembershipConfig['reminder'],
    value: string | boolean | number
  ) => void;
  onUpdateUsageEntry: (slotIndex: number) => void;
  onRemoveUsageHistoryEntry: (entryId: string) => void;
  onAddTrackerCheckboxEntry: (trackerId: string) => void;
  onRemoveTrackerEntry: (trackerId: string, entryId: string) => void;
  onUpdatePhoto: (index: number, value: string) => void;
  onAddPhotoField: () => void;
  onRemovePhotoField: (index: number) => void;
  onResetDraft: () => void;
  onSaveDraft: () => void;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-coral)] focus:ring-2 focus:ring-[rgba(226,111,81,0.18)]';

const compactInputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-coral)] focus:ring-2 focus:ring-[rgba(226,111,81,0.18)]';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMonthLabel(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`;
}

function formatPrice(value: number | null) {
  if (typeof value !== 'number') {
    return '미입력';
  }

  return `${value.toLocaleString('ko-KR')}원`;
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

function getCurrentCycleEntry(
  entries: UsageEntry[],
  cycleUnit: ReminderRepeatUnit
) {
  const now = new Date().toISOString();
  return [...entries]
    .reverse()
    .find((entry) => isSameCycle(entry.checkedAt, now, cycleUnit));
}

function groupEntriesByMonth(entries: UsageEntry[]) {
  const groups = new Map<string, UsageEntry[]>();

  [...entries]
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .forEach((entry) => {
      const key = entry.checkedAt.slice(0, 7);
      const current = groups.get(key) || [];
      current.push(entry);
      groups.set(key, current);
    });

  return Array.from(groups.entries()).map(([key, groupedEntries]) => ({
    key,
    label: formatMonthLabel(`${key}-01`),
    entries: groupedEntries,
  }));
}

function groupTrackerHistoryByMonth(trackers: BenefitTrackerState[]) {
  const merged = trackers.flatMap((tracker) =>
    tracker.entries.map((entry) => ({
      ...entry,
      trackerId: tracker.id,
      trackerTitle: tracker.title,
      groupTitle: tracker.groupTitle || '',
    }))
  );

  const groups = new Map<
    string,
    Array<UsageEntry & { trackerId: string; trackerTitle: string; groupTitle: string }>
  >();

  merged
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
    .forEach((entry) => {
      const key = entry.checkedAt.slice(0, 7);
      const current = groups.get(key) || [];
      current.push(entry);
      groups.set(key, current);
    });

  return Array.from(groups.entries()).map(([key, entries]) => ({
    key,
    label: formatMonthLabel(`${key}-01`),
    entries,
  }));
}

function calculateElapsedCycles(startedAt: string, billingCycle: PaymentCycle) {
  if (!startedAt) return 0;

  const start = new Date(startedAt);
  const now = new Date();

  if (Number.isNaN(start.getTime()) || start > now) {
    return 0;
  }

  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    (now.getDate() >= start.getDate() ? 1 : 0);

  if (billingCycle === 'yearly') {
    return Math.max(1, Math.ceil(totalMonths / 12));
  }

  return Math.max(1, totalMonths);
}

function buildElapsedLabel(cycleCount: number, billingCycle: PaymentCycle) {
  if (!cycleCount) {
    return '시작일을 입력하면 자동 계산됩니다.';
  }

  if (billingCycle === 'yearly') {
    return `${cycleCount}년째 사용 중`;
  }

  return `${cycleCount}달째 사용 중`;
}

function getPreviewPhoto(draft: UserMembershipConfig, selectedPreset: SeedPreset) {
  const presetPhotos = selectedPreset.template.seedMeta?.photos || [];
  const firstPresetPhoto = presetPhotos.find((photo) => photo.trim());
  const firstDraftPhoto = draft.photos.find((photo) => photo.trim());
  return firstPresetPhoto || firstDraftPhoto || '';
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

export default function SubscriptionMobileEditor({
  draft,
  selectedPreset,
  carrierLabel,
  productTypeLabel,
  statusMessage,
  paymentCycleLabels,
  paymentMethodLabels,
  onUpdateDraft,
  onUpdateReminder,
  onUpdateUsageEntry,
  onRemoveUsageHistoryEntry,
  onAddTrackerCheckboxEntry,
  onRemoveTrackerEntry,
  onUpdatePhoto,
  onAddPhotoField,
  onRemovePhotoField,
  onResetDraft,
  onSaveDraft,
}: SubscriptionMobileEditorProps) {
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [showBenefitHistory, setShowBenefitHistory] = useState(false);

  const previewPhoto = getPreviewPhoto(draft, selectedPreset);
  const elapsedCycles = calculateElapsedCycles(draft.startedAt, draft.billingCycle);
  const estimatedSpend =
    typeof draft.price === 'number' && elapsedCycles > 0
      ? draft.price * elapsedCycles
      : null;

  const usageHistory = useMemo(
    () => groupEntriesByMonth(draft.usageEntries),
    [draft.usageEntries]
  );

  const checkTrackers = useMemo(
    () => draft.benefitTrackers.filter((tracker) => tracker.displayMode !== 'info'),
    [draft.benefitTrackers]
  );

  const groupedCheckTrackers = useMemo(() => {
    return checkTrackers.reduce<Record<string, BenefitTrackerState[]>>((acc, tracker) => {
      const key = tracker.groupTitle || tracker.title;
      acc[key] = [...(acc[key] || []), tracker];
      return acc;
    }, {});
  }, [checkTrackers]);

  const infoTrackers = useMemo(
    () => draft.benefitTrackers.filter((tracker) => tracker.displayMode === 'info'),
    [draft.benefitTrackers]
  );

  const trackerHistory = useMemo(
    () => groupTrackerHistoryByMonth(checkTrackers),
    [checkTrackers]
  );

  const renderPhotoPreview = () => {
    if (previewPhoto) {
      return (
        <img
          src={previewPhoto}
          alt={draft.displayName}
          className="h-full w-full object-cover"
        />
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(42,157,143,0.12),rgba(226,111,81,0.12))] text-sm font-medium text-slate-500">
        상품 IMG
      </div>
    );
  };

  const renderSourceBlock = () => (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">공식 안내 URL</p>
          <p className="mt-1 text-xs text-slate-500">
            통신사/브랜드 원문 페이지를 바로 확인할 수 있습니다.
          </p>
        </div>
        {draft.sourceCheckedAt ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
            {draft.sourceCheckedAt}
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        {draft.sourceUrls.length ? (
          draft.sourceUrls.map((url, index) => (
            <a
              key={`${draft.seedKey}-source-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 underline decoration-slate-300 underline-offset-4 transition hover:text-[var(--brand-coral)] hover:decoration-[var(--brand-coral)]"
            >
              {url}
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            연결된 공식 안내 URL이 없습니다.
          </div>
        )}
      </div>
    </section>
  );

  const renderAttachmentSection = () => (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <ImageUploadArrayField
        title="첨부 이미지"
        description="참고 이미지를 Cloudinary에 업로드해 저장합니다."
        images={draft.photos}
        onAdd={onAddPhotoField}
        onChange={onUpdatePhoto}
        onRemove={onRemovePhotoField}
        customNamePrefix={`mobile-editor-${draft.id}`}
        uploadFolderPath={`user-attachments/mobile/${draft.productType.toLowerCase()}`}
        addButtonLabel="+ 추가"
        gridClassName="grid-cols-2"
        slotEmptyLabel="첨부 이미지"
      />
    </section>
  );

  const renderPaymentSection = () => (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">결제정보</p>
          <p className="mt-1 text-xs text-slate-500">
            타입 A/B/C 공통으로 결제와 이용 이력을 함께 저장합니다.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
          수정 가능
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">상품 티어</label>
          <input
            value={draft.selectedTier}
            onChange={(event) => onUpdateDraft('selectedTier', event.target.value)}
            className={compactInputClassName}
            placeholder="예: 프리미엄 / 월간 결제"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">가격</label>
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
            className={compactInputClassName}
            placeholder="예: 17000"
          />
        </div>
      </div>

      {draft.tierSuggestions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.tierSuggestions.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => onUpdateDraft('selectedTier', tier)}
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">결제 주기</label>
          <select
            value={draft.billingCycle}
            onChange={(event) =>
              onUpdateDraft('billingCycle', event.target.value as PaymentCycle)
            }
            className={compactInputClassName}
          >
            {(Object.keys(paymentCycleLabels) as PaymentCycle[]).map((cycle) => (
              <option key={cycle} value={cycle}>
                {paymentCycleLabels[cycle]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">결제수단 유형</label>
          <select
            value={draft.paymentMethodType}
            onChange={(event) =>
              onUpdateDraft(
                'paymentMethodType',
                event.target.value as PaymentMethodType
              )
            }
            className={compactInputClassName}
          >
            {(Object.keys(paymentMethodLabels) as PaymentMethodType[]).map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabels[method]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">시작일</label>
          <input
            type="date"
            value={draft.startedAt}
            onChange={(event) => onUpdateDraft('startedAt', event.target.value)}
            className={compactInputClassName}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">결제일</label>
          <input
            type="date"
            value={draft.paymentDate}
            onChange={(event) => onUpdateDraft('paymentDate', event.target.value)}
            className={compactInputClassName}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">상품 갱신일</label>
          <input
            type="date"
            value={draft.renewalDate}
            onChange={(event) => onUpdateDraft('renewalDate', event.target.value)}
            className={compactInputClassName}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600">결제수단 이름</label>
          <input
            value={draft.paymentMethodLabel}
            onChange={(event) => onUpdateDraft('paymentMethodLabel', event.target.value)}
            className={compactInputClassName}
            placeholder={
              draft.paymentMethodType === 'card' ? '예: 국민카드' : '예: 생활비 계좌'
            }
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <p>총 이용기간: {buildElapsedLabel(elapsedCycles, draft.billingCycle)}</p>
        <p className="mt-2">지불금액: {formatPrice(estimatedSpend)}</p>
      </div>
    </section>
  );

  const renderMemoSection = () => (
    <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">사용자 메모</p>
          <p className="mt-1 text-xs text-slate-500">
            내가 직접 남기는 기록은 상품 기본 설명과 분리해서 보관합니다.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
          수정 가능
        </span>
      </div>

      <textarea
        value={draft.userMemo}
        onChange={(event) => onUpdateDraft('userMemo', event.target.value)}
        rows={4}
        className={`${inputClassName} mt-4`}
        placeholder="예: 프로필 4개 사용 / 지난달 기록 누락 / 이번 달엔 영화부터 사용"
      />
    </section>
  );

  const renderTypeASections = () => (
    <>
      {renderMemoSection()}
      {renderAttachmentSection()}
      {renderPaymentSection()}
    </>
  );

  const renderTypeBSections = () => {
    const annualLimit = draft.customRules.annualLimit || 6;

    return (
      <>
        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">사용 체크 관리</p>
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
              onClick={() => setShowUsageHistory((prev) => !prev)}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)]"
            >
              월별 기록
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {Array.from({ length: annualLimit }).map((_, slotIndex) => {
              const entry = draft.usageEntries[slotIndex];
              const isNextAvailable = slotIndex <= draft.usageEntries.length;

              return (
                <label
                  key={`${draft.id}-mobile-usage-slot-${slotIndex}`}
                  className={`flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3 ${
                    entry
                      ? 'border-[rgba(42,157,143,0.25)] bg-[rgba(42,157,143,0.06)]'
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
                    <p className="text-sm font-medium text-slate-800">사용 {slotIndex + 1}</p>
                  </div>
                  <p className="text-right text-xs text-slate-500">
                    {entry ? formatDateTime(entry.checkedAt) : '미기록'}
                  </p>
                </label>
              );
            })}
          </div>

          {showUsageHistory ? (
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              {usageHistory.length ? (
                usageHistory.map((group) => (
                  <div key={group.key} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {group.label}
                    </p>
                    <div className="mt-2 space-y-2">
                      {group.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700"
                        >
                          <span>{formatDateTime(entry.checkedAt)}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveUsageHistoryEntry(entry.id)}
                            className="rounded-full border border-red-200 px-3 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  기록된 월별 사용 이력이 없습니다.
                </div>
              )}
            </div>
          ) : null}
        </section>

        {renderMemoSection()}
        {renderAttachmentSection()}
        {renderPaymentSection()}
      </>
    );
  };

  const renderTypeCSections = () => (
    <>
      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">사용 체크 관리</p>
            <p className="mt-1 text-xs text-slate-500">
              단순 횟수 제한 항목은 체크하고, 복잡한 조건은 정보 카드로 노출합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBenefitHistory((prev) => !prev)}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-[var(--brand-teal)] hover:text-[var(--brand-teal)]"
          >
            월별 기록
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {Object.entries(groupedCheckTrackers).map(([groupTitle, trackers]) => (
            <div
              key={groupTitle}
              className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
            >
              <h4 className="text-base font-semibold text-slate-900">{groupTitle}</h4>
              <div className="mt-4 space-y-3">
                {trackers.map((tracker) => {
                  const currentEntry = getCurrentCycleEntry(
                    tracker.entries,
                    tracker.cycleUnit
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

                              onAddTrackerCheckboxEntry(tracker.id);
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
                          <span className="text-[11px] text-slate-500">
                            {currentEntry ? formatDateTime(currentEntry.checkedAt) : '미사용'}
                          </span>
                          {currentEntry ? (
                            <button
                              type="button"
                              onClick={() => onAddTrackerCheckboxEntry(tracker.id)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:border-[var(--brand-coral)] hover:text-[var(--brand-coral)]"
                            >
                              추가 기록
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
              <h4 className="text-base font-semibold text-slate-900">{tracker.title}</h4>
              <p className="mt-3 text-sm leading-6 text-slate-600">{tracker.description}</p>
            </div>
          ))}
        </div>

        {showBenefitHistory ? (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            {trackerHistory.length ? (
              trackerHistory.map((group) => (
                <div key={group.key} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {group.label}
                  </p>
                  <div className="mt-2 space-y-2">
                    {group.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{entry.trackerTitle}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(entry.checkedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveTrackerEntry(entry.trackerId, entry.id)}
                          className="rounded-full border border-red-200 px-3 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                기록된 월별 사용 이력이 없습니다.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {renderMemoSection()}
      {renderAttachmentSection()}
      {renderPaymentSection()}
    </>
  );

  const renderUserSections = () => {
    if (draft.productType === 'B') return renderTypeBSections();
    if (draft.productType === 'C') return renderTypeCSections();
    return renderTypeASections();
  };

  return (
    <div className="space-y-6">
      {statusMessage ? (
        <div className="rounded-[26px] bg-[rgba(42,157,143,0.10)] px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[440px] space-y-5">
        <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between bg-slate-700 px-4 py-3 text-white">
            <span className="text-lg leading-none">&larr;</span>
            <span className="text-sm font-medium">title</span>
            <span className="w-4" />
          </div>

          <div className="space-y-4 bg-[linear-gradient(180deg,#fcfaf5_0%,#f7f4ed_100%)] p-4">
            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-[104px,minmax(0,1fr)] gap-4">
                <div className="h-28 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
                  {renderPhotoPreview()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                      {carrierLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                      {productTypeLabel}
                    </span>
                  </div>

                  <input
                    value={draft.displayName}
                    onChange={(event) => onUpdateDraft('displayName', event.target.value)}
                    className="mt-3 w-full border-none bg-transparent p-0 text-[28px] font-semibold leading-tight text-slate-900 outline-none"
                    placeholder="상품 이름"
                  />

                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                    {draft.provider}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-700">상품 활성화</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      꺼도 목록에는 남아 있습니다.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(event) => onUpdateDraft('isActive', event.target.checked)}
                    className="h-5 w-5 accent-[var(--brand-coral)]"
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium text-slate-700">알림 설정 저장</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      웹에서는 값만 저장합니다.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.reminder.enabled}
                    onChange={(event) =>
                      onUpdateReminder('enabled', event.target.checked)
                    }
                    className="h-5 w-5 accent-[var(--brand-coral)]"
                  />
                </label>
              </div>
            </div>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">상품설명</p>
                  <p className="mt-1 text-xs text-slate-500">
                    기본 설명은 사용자 메모와 분리해서 관리합니다.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-500">
                  수정 가능
                </span>
              </div>

              <textarea
                value={draft.description}
                onChange={(event) => onUpdateDraft('description', event.target.value)}
                rows={4}
                className={`${inputClassName} mt-4`}
                placeholder="상품 기본 설명"
              />
            </section>

            {renderSourceBlock()}
          </div>
        </section>

        <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-16 rounded-full bg-slate-300" />
          </div>

          <div className="space-y-4 bg-white p-4">
            {renderUserSections()}

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-6 text-slate-600">
                  저장하면 이 브라우저에서 다시 불러와 수정하고 체크 기록을 이어갈 수 있습니다.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onResetDraft}
                    className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                  >
                    공식값으로 되돌리기
                  </button>
                  <button
                    type="button"
                    onClick={onSaveDraft}
                    className="flex-1 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                  >
                    개인 설정 저장
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
