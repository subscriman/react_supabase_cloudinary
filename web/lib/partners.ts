export interface PartnerRecord {
  id: string;
  partner_name: string;
  contact_email: string | null;
  business_registration_number: string;
  phone_number: string | null;
  manager_primary_name: string | null;
  manager_primary_phone: string | null;
  manager_secondary_name: string | null;
  manager_secondary_phone: string | null;
  manager_tertiary_name: string | null;
  manager_tertiary_phone: string | null;
  login_id: string;
  password_hash: string;
  password_salt: string;
  password_algorithm: string | null;
  password_temporary: boolean | null;
  password_generated_at: string | null;
  password_updated_at: string | null;
  last_login_at: string | null;
  is_active: boolean | null;
  notes: string | null;
  business_address: string | null;
  contract_started_at: string | null;
  contract_ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerOption {
  id: string;
  partnerName: string;
  contactEmail: string;
  businessRegistrationNumber: string;
  phoneNumber: string;
  loginId: string;
  isActive: boolean;
}

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

function randomIndex(max: number) {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function generateSecureToken(length: number) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomIndex(PASSWORD_ALPHABET.length)]).join(
    ''
  );
}

export function generateTemporaryPassword() {
  return generateSecureToken(14);
}

export function generatePasswordSalt() {
  return generateSecureToken(24);
}

export async function hashPartnerPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const payload = encoder.encode(`${salt}:${password}`);

  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('암호화 해시를 생성할 수 없는 환경입니다.');
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizePartnerOption(row: PartnerRecord): PartnerOption {
  return {
    id: row.id,
    partnerName: row.partner_name,
    contactEmail: row.contact_email || '',
    businessRegistrationNumber: row.business_registration_number,
    phoneNumber: row.phone_number || '',
    loginId: row.login_id,
    isActive: row.is_active ?? true,
  };
}

export function slugifyLoginId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized || `partner-${Date.now()}`;
}

export function formatPartnerLabel(option: PartnerOption) {
  return `${option.partnerName}${option.isActive ? '' : ' (비활성)'}`;
}
