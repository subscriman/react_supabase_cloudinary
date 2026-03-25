import {
  BenefitTrackerState,
  PaymentCycle,
  PaymentMethodType,
  ReminderRepeatUnit,
  SeedSubProduct,
  UsageEntry,
  UserMembershipConfig,
} from '../lib/user-membership';
import ImageUploadArrayField from './ImageUploadArrayField';

interface SubscriptionDesktopEditorProps {
  draft: UserMembershipConfig;
  statusMessage: string;
  paymentCycleLabels: Record<PaymentCycle, string>;
  paymentMethodLabels: Record<PaymentMethodType, string>;
  trackerAmountInputs: Record<string, string>;
  onUpdateDraft: <K extends keyof UserMembershipConfig>(
    key: K,
    value: UserMembershipConfig[K]
  ) => void;
  onUpdateUsageEntry: (slotIndex: number) => void;
  onRemoveUsageHistoryEntry: (entryId: string) => void;
  onUpdatePhoto: (index: number, value: string) => void;
  onAddPhotoField: () => void;
  onRemovePhotoField: (index: number) => void;
  onUpdateSubProduct: (
    index: number,
    key: keyof SeedSubProduct,
    value: string | number | undefined
  ) => void;
  onUpdateTrackerNote: (trackerId: string, value: string) => void;
  onUpdateTrackerPhoto: (
    trackerId: string,
    photoIndex: number,
    value: string
  ) => void;
  onAddTrackerPhotoField: (trackerId: string) => void;
  onRemoveTrackerPhotoField: (trackerId: string, photoIndex: number) => void;
  onAddTrackerCheckboxEntry: (trackerId: string) => void;
  onAddTrackerAmountEntry: (trackerId: string) => void;
  onRemoveTrackerEntry: (trackerId: string, entryId: string) => void;
  onSetTrackerAmountInput: (trackerId: string, value: string) => void;
  onResetDraft: () => void;
  onSaveDraft: () => void;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-coral)] focus:ring-2 focus:ring-[rgba(226,111,81,0.18)]';

const sectionCardClassName =
  'rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur';

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

export default function SubscriptionDesktopEditor({
  draft,
  statusMessage,
  paymentCycleLabels,
  paymentMethodLabels,
  trackerAmountInputs,
  onUpdateDraft,
  onUpdateUsageEntry,
  onRemoveUsageHistoryEntry,
  onUpdatePhoto,
  onAddPhotoField,
  onRemovePhotoField,
  onUpdateSubProduct,
  onUpdateTrackerNote,
  onUpdateTrackerPhoto,
  onAddTrackerPhotoField,
  onRemoveTrackerPhotoField,
  onAddTrackerCheckboxEntry,
  onAddTrackerAmountEntry,
  onRemoveTrackerEntry,
  onSetTrackerAmountInput,
  onResetDraft,
  onSaveDraft,
}: SubscriptionDesktopEditorProps) {
  return (
    <div className="space-y-6">
      {statusMessage ? (
        <div className="rounded-2xl bg-[rgba(42,157,143,0.10)] px-4 py-3 text-sm text-slate-700">
          {statusMessage}
        </div>
      ) : null}

      <section className={sectionCardClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">상품 기본정보 영역</h3>
            <p className="mt-1 text-sm text-slate-500">
              상품 기본 설명, 제공사, 공식 안내 URL 등 프리셋 중심 정보를 확인하고
              필요한 범위만 수정합니다.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            기본 정보
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              상품명
            </label>
            <input
              value={draft.displayName}
              onChange={(event) => onUpdateDraft('displayName', event.target.value)}
              className={inputClassName}
              placeholder="내가 구분하기 쉬운 이름"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              제공업체
            </label>
            <input
              value={draft.provider}
              readOnly
              className={`${inputClassName} bg-slate-50`}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            상품 설명
          </label>
          <textarea
            value={draft.description}
            onChange={(event) => onUpdateDraft('description', event.target.value)}
            rows={4}
            className={inputClassName}
            placeholder="서비스 설명 또는 기본 혜택 요약"
          />
        </div>

        <div className="mt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">
                통신사 / 공식 안내 URL
              </h4>
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
        </div>

        {draft.subProducts.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-base font-semibold text-slate-900">
              기본 혜택 / 서브 항목
            </h4>
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
                          onUpdateSubProduct(index, 'name', event.target.value)
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
                          onUpdateSubProduct(index, 'type', event.target.value)
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
                          onUpdateSubProduct(
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
                          onUpdateSubProduct(
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
                          onUpdateSubProduct(index, 'description', event.target.value)
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
          </div>
        ) : null}
      </section>

      <section className={sectionCardClassName}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">사용자 설정 영역</h3>
            <p className="mt-1 text-sm text-slate-500">
              메모, 이미지, 결제 정보, 사용 체크처럼 사용자가 직접 관리하는 값을
              저장합니다.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            사용자 관리
          </span>
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
              onChange={(event) => onUpdateDraft('isActive', event.target.checked)}
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
              onChange={(event) => onUpdateDraft('reminder', {
                ...draft.reminder,
                enabled: event.target.checked,
              })}
              className="h-5 w-5 accent-[var(--brand-coral)]"
            />
          </label>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            사용자 메모
          </label>
          <textarea
            value={draft.userMemo}
            onChange={(event) => onUpdateDraft('userMemo', event.target.value)}
            rows={4}
            className={inputClassName}
            placeholder="예: 프로필 공유 현황, 쿠폰 사용 메모, 지난달 기록 누락 등"
          />
        </div>

        {draft.supportsBilling ? (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-900">
                  결제 / 갱신 정보
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  결제일, 티어, 가격, 결제수단을 함께 저장합니다.
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
                  onChange={(event) => onUpdateDraft('selectedTier', event.target.value)}
                  className={inputClassName}
                  placeholder="예: 광고형 스탠다드 / 월간 결제"
                />
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
                            : 'bg-white text-slate-600 hover:bg-slate-200'
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
                    onUpdateDraft(
                      'price',
                      event.target.value === '' ? null : Number(event.target.value)
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  결제 방법 유형
                </label>
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

            <div className="mt-5 grid gap-5 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  시작일
                </label>
                <input
                  type="date"
                  value={draft.startedAt}
                  onChange={(event) => onUpdateDraft('startedAt', event.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  결제일
                </label>
                <input
                  type="date"
                  value={draft.paymentDate}
                  onChange={(event) => onUpdateDraft('paymentDate', event.target.value)}
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
                  onChange={(event) => onUpdateDraft('renewalDate', event.target.value)}
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
                    onUpdateDraft('paymentMethodLabel', event.target.value)
                  }
                  className={inputClassName}
                  placeholder={`예: ${
                    draft.paymentMethodType === 'card' ? '국민카드' : '생활비 통장'
                  }`}
                />
              </div>
            </div>
          </div>
        ) : null}

        {draft.productType === 'B' ? (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-900">
                  사용 체크 관리
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  사용 시 직접 체크해서 관리하고, 제한을 넘기면 경고 후 강제 기록을 허용합니다.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">
                {buildRuleSummary(
                  draft.customRules.usageCycleUnit,
                  draft.customRules.usageCycleLimit,
                  draft.customRules.annualLimit
                )}
              </span>
            </div>

            {draft.customRules.annualLimit ? (
              <div className="mt-5 grid gap-3">
                {Array.from({ length: draft.customRules.annualLimit }).map((_, slotIndex) => {
                  const entry = draft.usageEntries[slotIndex];
                  const isNextAvailable = slotIndex <= draft.usageEntries.length;

                  return (
                    <label
                      key={`${draft.id}-usage-slot-${slotIndex}`}
                      className={`flex items-center justify-between rounded-[24px] border px-4 py-4 ${
                        entry
                          ? 'border-[rgba(42,157,143,0.28)] bg-[rgba(42,157,143,0.06)]'
                          : 'border-slate-200 bg-white'
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
                })}
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => onUpdateUsageEntry(draft.usageEntries.length)}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
                >
                  사용 기록 추가
                </button>
                {draft.usageEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-white px-4 py-4"
                  >
                    <p className="text-sm text-slate-700">{formatDateTime(entry.checkedAt)}</p>
                    <button
                      type="button"
                      onClick={() => onRemoveUsageHistoryEntry(entry.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {draft.productType === 'C' ? (
          <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-base font-semibold text-slate-900">
                  브랜드별 혜택 관리
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  단순 체크형 혜택과 정보형 혜택을 분리해서 보여줍니다.
                </p>
              </div>
              <span className="text-xs text-slate-500">타입 C 상세 운영 로직 반영</span>
            </div>

            <div className="mt-5 space-y-5">
              {draft.benefitTrackers.map((tracker) => {
                const sharedBudgetTotal =
                  tracker.sharedBudgetKey && tracker.cycleAmountLimit
                    ? draft.benefitTrackers
                        .filter((item) => item.sharedBudgetKey === tracker.sharedBudgetKey)
                        .reduce(
                          (total, item) =>
                            total + sumAmountsInMonth(item.entries, new Date().toISOString()),
                          0
                        )
                    : null;

                return (
                  <div
                    key={tracker.id}
                    className="rounded-[28px] border border-slate-200 bg-white p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-900">
                            {tracker.groupTitle || tracker.title}
                          </h4>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {tracker.displayMode === 'info'
                              ? '정보형'
                              : tracker.entryMode === 'amount'
                                ? '금액 기록형'
                                : '체크형'}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {tracker.description}
                        </p>
                      </div>
                      {(tracker.cycleLimit || tracker.annualLimit || tracker.cycleAmountLimit) && (
                        <div className="flex flex-wrap gap-2">
                          {(tracker.cycleLimit || tracker.annualLimit) ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              {buildRuleSummary(
                                tracker.cycleUnit,
                                tracker.cycleLimit ?? null,
                                tracker.annualLimit ?? null
                              )}
                            </span>
                          ) : null}
                          {tracker.cycleAmountLimit ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              월 {tracker.cycleAmountLimit.toLocaleString('ko-KR')}원
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {sharedBudgetTotal !== null && tracker.cycleAmountLimit ? (
                      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        이번 달 공유 한도 사용액:
                        <span className="ml-2 font-semibold text-slate-900">
                          {sharedBudgetTotal.toLocaleString('ko-KR')}원
                        </span>
                      </div>
                    ) : null}

                    {tracker.displayMode === 'info' ? null : (
                      <>
                        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr),320px]">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              개별 메모
                            </label>
                            <textarea
                              value={tracker.note}
                              onChange={(event) =>
                                onUpdateTrackerNote(tracker.id, event.target.value)
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
                                      onSetTrackerAmountInput(tracker.id, event.target.value)
                                    }
                                    className={inputClassName}
                                    placeholder="예: 8900"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => onAddTrackerAmountEntry(tracker.id)}
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
                                  onClick={() => onAddTrackerCheckboxEntry(tracker.id)}
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
                            description="이 혜택 항목에서만 참고할 이미지를 Cloudinary에 업로드합니다."
                            images={tracker.photos}
                            onAdd={() => onAddTrackerPhotoField(tracker.id)}
                            onChange={(photoIndex, value) =>
                              onUpdateTrackerPhoto(tracker.id, photoIndex, value)
                            }
                            onRemove={(photoIndex) =>
                              onRemoveTrackerPhotoField(tracker.id, photoIndex)
                            }
                            customNamePrefix={`tracker-${draft.id}-${tracker.id}`}
                            addButtonLabel="이미지 추가"
                            gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                            slotEmptyLabel="트래커 이미지"
                          />
                        </div>
                      </>
                    )}

                    {tracker.displayMode === 'info' ? null : (
                      <div className="mt-5 space-y-3">
                        {tracker.entries.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                            아직 기록이 없습니다.
                          </div>
                        ) : (
                          tracker.entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
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
                                onClick={() => onRemoveTrackerEntry(tracker.id, entry.id)}
                                className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                기록 삭제
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <ImageUploadArrayField
            title="첨부 이미지"
            description="상품별 참고 이미지를 Cloudinary에 업로드하고 저장합니다."
            images={draft.photos}
            onAdd={onAddPhotoField}
            onChange={onUpdatePhoto}
            onRemove={onRemovePhotoField}
            customNamePrefix={`subscription-${draft.id}`}
            addButtonLabel="이미지 추가"
            gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            slotEmptyLabel="첨부 이미지"
          />
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm leading-6 text-slate-600">
            <p>저장하면 이 브라우저에서 다시 불러와 수정하고 체크 기록을 이어갈 수 있습니다.</p>
            <p>모바일 앱 단계에서는 이 구조를 서버 저장, 로컬 알림, 이미지 업로드와 연결하면 됩니다.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onResetDraft}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400"
            >
              공식값으로 되돌리기
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-coral)]"
            >
              개인 설정 저장
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
