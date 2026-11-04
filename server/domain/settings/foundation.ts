import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { foundationSettings } from '../../db/schema';

export interface FoundationInfo {
  foundationName: string;
  skKemenkumham: string;
  headOfficeAddress: string;
  officialPhone: string;
  officialEmail: string;
  officialWebsite: string;
  bankAccounts: Array<{ bankName: string; accountNumber: string; accountHolder: string; branch: string; category?: 'infaq' | 'waqf'; bankCode?: string }>;
}

export const FOUNDATION_DEFAULT: FoundationInfo = {
  foundationName: 'Yayasan Tarbiyah Sunnah', skKemenkumham: '',
  headOfficeAddress: 'Jl. Jurang No.64, Pasteur, Sukajadi, Bandung',
  officialPhone: '0811-2401-476', officialEmail: 'info@tarbiyahsunnah.id', officialWebsite: 'https://tarbiyahsunnah.id',
  bankAccounts: [],
};

export async function getFoundation(): Promise<FoundationInfo> {
  const row = await getDb().query.foundationSettings.findFirst({ where: eq(foundationSettings.id, 'yts') });
  return { ...FOUNDATION_DEFAULT, ...(row?.data as Partial<FoundationInfo> | undefined) };
}

export async function saveFoundation(data: FoundationInfo): Promise<void> {
  await getDb().insert(foundationSettings).values({ id: 'yts', data }).onConflictDoUpdate({ target: foundationSettings.id, set: { data, updatedAt: new Date() } });
}
