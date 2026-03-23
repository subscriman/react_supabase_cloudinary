import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  PartnerRecord,
  generatePasswordSalt,
  generateTemporaryPassword,
  hashPartnerPassword,
  slugifyLoginId,
} from '../lib/partners';

interface PartnerManagerProps {
  partners: PartnerRecord[];
  loading: boolean;
  onReload: () => Promise<void>;
}

interface PartnerDraft {
  id: string;
  partnerName: string;
  contactEmail: string;
  businessRegistrationNumber: string;
  phoneNumber: string;
  loginId: string;
  isActive: boolean;
  managerPrimaryName: string;
  managerPrimaryPhone: string;
  managerSecondaryName: string;
  managerSecondaryPhone: string;
  managerTertiaryName: string;
  managerTertiaryPhone: string;
  businessAddress: string;
  notes: string;
  contractStartedAt: string;
  contractEndedAt: string;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string;
  lastLoginAt: string;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500';

const textAreaClassName = `${inputClassName} min-h-[112px] resize-y`;

function createEmptyDraft(): PartnerDraft {
  return {
    id: '',
    partnerName: '',
    contactEmail: '',
    businessRegistrationNumber: '',
    phoneNumber: '',
    loginId: '',
    isActive: true,
    managerPrimaryName: '',
    managerPrimaryPhone: '',
    managerSecondaryName: '',
    managerSecondaryPhone: '',
    managerTertiaryName: '',
    managerTertiaryPhone: '',
    businessAddress: '',
    notes: '',
    contractStartedAt: '',
    contractEndedAt: '',
    createdAt: '',
    updatedAt: '',
    passwordUpdatedAt: '',
    lastLoginAt: '',
  };
}

function toDraft(partner: PartnerRecord): PartnerDraft {
  return {
    id: partner.id,
    partnerName: partner.partner_name,
    contactEmail: partner.contact_email || '',
    businessRegistrationNumber: partner.business_registration_number,
    phoneNumber: partner.phone_number || '',
    loginId: partner.login_id,
    isActive: partner.is_active ?? true,
    managerPrimaryName: partner.manager_primary_name || '',
    managerPrimaryPhone: partner.manager_primary_phone || '',
    managerSecondaryName: partner.manager_secondary_name || '',
    managerSecondaryPhone: partner.manager_secondary_phone || '',
    managerTertiaryName: partner.manager_tertiary_name || '',
    managerTertiaryPhone: partner.manager_tertiary_phone || '',
    businessAddress: partner.business_address || '',
    notes: partner.notes || '',
    contractStartedAt: partner.contract_started_at || '',
    contractEndedAt: partner.contract_ended_at || '',
    createdAt: partner.created_at || '',
    updatedAt: partner.updated_at || '',
    passwordUpdatedAt: partner.password_updated_at || '',
    lastLoginAt: partner.last_login_at || '',
  };
}

function formatDateTime(value: string) {
  if (!value) return '없음';

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PartnerManager({
  partners,
  loading,
  onReload,
}: PartnerManagerProps) {
  const [draft, setDraft] = useState<PartnerDraft>(createEmptyDraft());
  const [saving, setSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => setMessage(''), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const startNewDraft = () => {
    setDraft(createEmptyDraft());
    setGeneratedPassword('');
  };

  const handleSelectPartner = (partner: PartnerRecord) => {
    setDraft(toDraft(partner));
    setGeneratedPassword('');
  };

  const buildPayload = () => ({
    partner_name: draft.partnerName.trim(),
    contact_email: draft.contactEmail.trim() || null,
    business_registration_number: draft.businessRegistrationNumber.trim(),
    phone_number: draft.phoneNumber.trim() || null,
    login_id: draft.loginId.trim(),
    is_active: draft.isActive,
    manager_primary_name: draft.managerPrimaryName.trim() || null,
    manager_primary_phone: draft.managerPrimaryPhone.trim() || null,
    manager_secondary_name: draft.managerSecondaryName.trim() || null,
    manager_secondary_phone: draft.managerSecondaryPhone.trim() || null,
    manager_tertiary_name: draft.managerTertiaryName.trim() || null,
    manager_tertiary_phone: draft.managerTertiaryPhone.trim() || null,
    business_address: draft.businessAddress.trim() || null,
    notes: draft.notes.trim() || null,
    contract_started_at: draft.contractStartedAt || null,
    contract_ended_at: draft.contractEndedAt || null,
    updated_at: new Date().toISOString(),
  });

  const handleSave = async () => {
    if (!draft.partnerName.trim() || !draft.businessRegistrationNumber.trim()) {
      alert('파트너명과 사업자번호를 입력해 주세요.');
      return;
    }

    const loginId = draft.loginId.trim() || slugifyLoginId(draft.partnerName);

    setSaving(true);

    try {
      if (draft.id) {
        const { data, error } = await supabase
          .from('partners')
          .update({
            ...buildPayload(),
            login_id: loginId,
          })
          .eq('id', draft.id)
          .select('*')
          .single();

        if (error) throw error;

        setDraft(toDraft(data));
        setGeneratedPassword('');
        setMessage('파트너 정보를 수정했습니다.');
      } else {
        const temporaryPassword = generateTemporaryPassword();
        const passwordSalt = generatePasswordSalt();
        const passwordHash = await hashPartnerPassword(temporaryPassword, passwordSalt);

        const { data, error } = await supabase
          .from('partners')
          .insert([
            {
              ...buildPayload(),
              login_id: loginId,
              password_hash: passwordHash,
              password_salt: passwordSalt,
              password_algorithm: 'sha256',
              password_temporary: true,
              password_generated_at: new Date().toISOString(),
              password_updated_at: new Date().toISOString(),
            },
          ])
          .select('*')
          .single();

        if (error) throw error;

        setDraft(toDraft(data));
        setGeneratedPassword(temporaryPassword);
        setMessage('파트너사를 등록했습니다.');
      }

      await onReload();
    } catch (error) {
      console.error('Failed to save partner:', error);
      alert('파트너 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!draft.id) {
      alert('저장된 파트너를 먼저 선택해 주세요.');
      return;
    }

    if (!confirm(`"${draft.partnerName}"의 임시 비밀번호를 재발급할까요?`)) {
      return;
    }

    setSaving(true);

    try {
      const temporaryPassword = generateTemporaryPassword();
      const passwordSalt = generatePasswordSalt();
      const passwordHash = await hashPartnerPassword(temporaryPassword, passwordSalt);

      const { data, error } = await supabase
        .from('partners')
        .update({
          password_hash: passwordHash,
          password_salt: passwordSalt,
          password_algorithm: 'sha256',
          password_temporary: true,
          password_generated_at: new Date().toISOString(),
          password_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .select('*')
        .single();

      if (error) throw error;

      setDraft(toDraft(data));
      setGeneratedPassword(temporaryPassword);
      setMessage('임시 비밀번호를 재발급했습니다.');
      await onReload();
    } catch (error) {
      console.error('Failed to reset partner password:', error);
      alert('임시 비밀번호 재발급에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) {
      startNewDraft();
      return;
    }

    if (!confirm(`"${draft.partnerName}" 파트너를 삭제할까요? 연결된 상품의 파트너 매칭은 해제됩니다.`)) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from('partners').delete().eq('id', draft.id);

      if (error) throw error;

      setGeneratedPassword('');
      setMessage('파트너를 삭제했습니다.');
      startNewDraft();
      await onReload();
    } catch (error) {
      console.error('Failed to delete partner:', error);
      alert('파트너 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
      <aside className="space-y-6">
        <section className="rounded-[28px] border border-white/60 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">파트너사 목록</h2>
              <p className="mt-1 text-sm text-slate-500">
                상품과 연결할 파트너 계정을 관리합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewDraft}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              새 파트너
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                파트너 목록을 불러오는 중입니다.
              </div>
            ) : partners.length ? (
              partners.map((partner) => {
                const isSelected = partner.id === draft.id;

                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleSelectPartner(partner)}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{partner.partner_name}</p>
                        <p
                          className={`mt-1 text-xs ${
                            isSelected ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {partner.login_id}
                        </p>
                      </div>
                      <span className="rounded-full border border-current/20 px-2 py-1 text-[11px]">
                        {partner.is_active === false ? '비활성' : '활성'}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                등록된 파트너가 아직 없습니다.
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-teal)]">
              Partner
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {draft.id ? '파트너 수정' : '새 파트너 등록'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              로그인 ID는 직접 지정할 수 있고, 비밀번호는 임시 비밀번호로 자동 생성합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResetPassword}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              임시 비밀번호 재발급
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              {draft.id ? '삭제' : '초기화'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        {generatedPassword ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-semibold">임시 비밀번호</p>
            <p className="mt-2 font-mono text-base">{generatedPassword}</p>
            <p className="mt-2 text-xs text-amber-700">
              이 값은 화면에서만 한 번 보여줍니다. 파트너사에 안전하게 전달해 주세요.
            </p>
          </div>
        ) : null}

        <div className="mt-8 space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">파트너명</label>
              <input
                value={draft.partnerName}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, partnerName: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: 올리브영 제휴팀"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                사업자번호
              </label>
              <input
                value={draft.businessRegistrationNumber}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    businessRegistrationNumber: event.target.value,
                  }))
                }
                className={inputClassName}
                placeholder="예: 123-45-67890"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">로그인 ID</label>
              <div className="flex gap-2">
                <input
                  value={draft.loginId}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, loginId: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="예: oliveyoung-partner"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      loginId: slugifyLoginId(prev.partnerName || prev.businessRegistrationNumber),
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-3 text-sm text-slate-600"
                >
                  자동
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, isActive: event.target.checked }))
                }
                className="h-4 w-4 accent-slate-900"
              />
              활성 상태
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                연락처 이메일
              </label>
              <input
                type="email"
                value={draft.contactEmail}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contactEmail: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: partner@company.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                대표 전화번호
              </label>
              <input
                value={draft.phoneNumber}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, phoneNumber: event.target.value }))
                }
                className={inputClassName}
                placeholder="예: 02-1234-5678"
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-base font-semibold text-slate-900">담당자 정보</h3>
            <div className="mt-4 space-y-4">
              {[
                {
                  title: '담당자 1',
                  nameKey: 'managerPrimaryName' as const,
                  phoneKey: 'managerPrimaryPhone' as const,
                },
                {
                  title: '담당자 2',
                  nameKey: 'managerSecondaryName' as const,
                  phoneKey: 'managerSecondaryPhone' as const,
                },
                {
                  title: '담당자 3',
                  nameKey: 'managerTertiaryName' as const,
                  phoneKey: 'managerTertiaryPhone' as const,
                },
              ].map((manager) => (
                <div
                  key={manager.title}
                  className="grid gap-4 rounded-[22px] border border-white bg-white p-4 md:grid-cols-2"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {manager.title} 이름
                    </label>
                    <input
                      value={draft[manager.nameKey]}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          [manager.nameKey]: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      placeholder="담당자명"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {manager.title} 전화번호
                    </label>
                    <input
                      value={draft[manager.phoneKey]}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          [manager.phoneKey]: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      placeholder="전화번호"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                사업장 주소
              </label>
              <textarea
                value={draft.businessAddress}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, businessAddress: event.target.value }))
                }
                className={textAreaClassName}
                placeholder="계약/정산에 필요한 주소"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">메모</label>
              <textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, notes: event.target.value }))
                }
                className={textAreaClassName}
                placeholder="추가 메모"
              />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">계약 시작일</label>
              <input
                type="date"
                value={draft.contractStartedAt}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contractStartedAt: event.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">계약 종료일</label>
              <input
                type="date"
                value={draft.contractEndedAt}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, contractEndedAt: event.target.value }))
                }
                className={inputClassName}
              />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">생성일</p>
              <p className="mt-1">{formatDateTime(draft.createdAt)}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">수정일</p>
              <p className="mt-1">{formatDateTime(draft.updatedAt)}</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">비밀번호 변경일</p>
              <p className="mt-1">{formatDateTime(draft.passwordUpdatedAt)}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">마지막 로그인</p>
              <p className="mt-1">{formatDateTime(draft.lastLoginAt)}</p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
