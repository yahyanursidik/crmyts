import { eq, inArray, desc } from 'drizzle-orm';
import { eventAttendance, events } from '../../db/schema';

export type LoyaltyTier = 'perdana' | 'aktif' | 'setia' | 'istiqomah';

export interface LoyaltyTierInfo {
  tier: LoyaltyTier;
  label: string;
  badge: string;
  color: 'emerald' | 'sky' | 'purple' | 'amber';
  description: string;
}

export interface PersonAttendanceStats {
  personId: string;
  pastAttendedCount: number;
  totalAttendedCount: number;
  pastRegisteredCount: number;
  currentKajianNumber: number;
  loyaltyTier: LoyaltyTier;
  loyaltyLabel: string;
  lastAttendedTitle?: string | null;
  lastAttendedDate?: string | null;
}

/**
 * Mendapatkan tier loyalitas berdasarkan nomor kajian/kehadiran
 */
export function getLoyaltyTierInfo(kajianNumber: number): LoyaltyTierInfo {
  if (kajianNumber <= 1) {
    return {
      tier: 'perdana',
      label: 'Kajian Perdana',
      badge: '🌱 Jamaah Baru',
      color: 'emerald',
      description: 'Pertama kali menghadiri kajian bersama Yayasan Tarbiyah Sunnah',
    };
  }
  if (kajianNumber <= 4) {
    return {
      tier: 'aktif',
      label: 'Jamaah Aktif',
      badge: '🔷 Jamaah Aktif',
      color: 'sky',
      description: 'Mulai rutin menghadiri kajian majelis ilmu',
    };
  }
  if (kajianNumber <= 9) {
    return {
      tier: 'setia',
      label: 'Jamaah Setia',
      badge: '⭐ Jamaah Setia',
      color: 'purple',
      description: 'Setia dan konsisten menghadiri majelis ilmu yayasan',
    };
  }
  return {
    tier: 'istiqomah',
    label: 'Jamaah Istiqomah',
    badge: '👑 Jamaah Istiqomah',
    color: 'amber',
    description: 'Masya Allah, istiqomah menuntut ilmu secara berkesinambungan',
  };
}

/**
 * Menghasilkan kalimat sapaan ramah dan hangat berdasarkan gender dan frekuensi keikutsertaan kajian
 */
export function buildPersonalizedGreeting(
  fullName: string,
  gender: 'ikhwan' | 'akhwat' | string = 'ikhwan',
  currentKajianNumber: number = 1
): {
  prefix: string;
  firstName: string;
  sapaan: string;
  fullGreeting: string;
  shortGreeting: string;
  isFirstTimer: boolean;
} {
  const isIkhwan = gender === 'ikhwan';
  const prefix = isIkhwan ? 'Akhi' : 'Ukhti';
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || fullName;
  const isFirstTimer = currentKajianNumber <= 1;

  let fullGreeting: string;
  let shortGreeting: string;

  if (isFirstTimer) {
    fullGreeting = `Ahlan wa Sahlan, ${prefix} ${firstName}! Selamat datang di kajian perdana bersama Yayasan Tarbiyah Sunnah.`;
    shortGreeting = `Ahlan ${prefix} ${firstName} (Kajian ke-1)`;
  } else if (currentKajianNumber <= 4) {
    fullGreeting = `Ahlan wa Sahlan kembali, ${prefix} ${firstName}! Alhamdulillah ini kehadiran ke-${currentKajianNumber} di majelis ilmu Yayasan Tarbiyah Sunnah.`;
    shortGreeting = `Ahlan ${prefix} ${firstName} (Kajian ke-${currentKajianNumber})`;
  } else if (currentKajianNumber <= 9) {
    fullGreeting = `Ahlan wa Sahlan kembali, ${prefix} ${firstName}! Barakallahu fiik, ini kehadiran ke-${currentKajianNumber} Akhi/Ukhti di Yayasan Tarbiyah Sunnah.`;
    shortGreeting = `Ahlan ${prefix} ${firstName} (Kajian ke-${currentKajianNumber} ⭐)`;
  } else {
    fullGreeting = `Ahlan wa Sahlan kembali, ${prefix} ${firstName}! Masya Allah, keistiqomahan ke-${currentKajianNumber} dalam menuntut ilmu di Yayasan Tarbiyah Sunnah.`;
    shortGreeting = `Ahlan ${prefix} ${firstName} (Kajian ke-${currentKajianNumber} 👑)`;
  }

  return {
    prefix,
    firstName,
    sapaan: `${prefix} ${firstName}`,
    fullGreeting,
    shortGreeting,
    isFirstTimer,
  };
}

/**
 * Menghitung riwayat dan frekuensi kehadiran secara batch untuk sekumpulan person ID
 * Memperhitungkan status 'attended' pada kajian-kajian sebelumnya
 */
export async function getPersonsAttendanceStats(
  db: any,
  personIds: string[],
  currentEventId?: string | null
): Promise<Map<string, PersonAttendanceStats>> {
  const statsMap = new Map<string, PersonAttendanceStats>();
  if (!personIds || personIds.length === 0) return statsMap;

  // Inisialisasi default
  for (const pid of personIds) {
    statsMap.set(pid, {
      personId: pid,
      pastAttendedCount: 0,
      totalAttendedCount: 0,
      pastRegisteredCount: 0,
      currentKajianNumber: 1,
      loyaltyTier: 'perdana',
      loyaltyLabel: 'Kajian Perdana',
      lastAttendedTitle: null,
      lastAttendedDate: null,
    });
  }

  // 1. Ambil seluruh catatan kehadiran jamaah di kajian secara aman
  let allAtts: any[] = [];
  try {
    if (typeof db?.select === 'function') {
      const selectBuilder = db
        .select({
          personId: eventAttendance.personId,
          eventId: eventAttendance.eventId,
          status: eventAttendance.status,
          checkInAt: eventAttendance.checkInAt,
          eventTitle: events.title,
          eventStartAt: events.startAt,
        })
        .from(eventAttendance);

      if (typeof selectBuilder?.innerJoin === 'function') {
        allAtts = await selectBuilder
          .innerJoin(events, eq(eventAttendance.eventId, events.id))
          .where(inArray(eventAttendance.personId, personIds))
          .orderBy(desc(events.startAt));
      } else if (typeof selectBuilder?.where === 'function') {
        allAtts = await selectBuilder.where(inArray(eventAttendance.personId, personIds));
      }
    } else if (db?.query?.eventAttendance?.findMany) {
      const rawRecords = await db.query.eventAttendance.findMany({
        where: inArray(eventAttendance.personId, personIds),
        with: { event: true },
      });
      allAtts = (rawRecords || []).map((a: any) => ({
        personId: a.personId,
        eventId: a.eventId,
        status: a.status,
        checkInAt: a.checkInAt,
        eventTitle: a.event?.title || null,
        eventStartAt: a.event?.startAt || null,
      }));
    }
  } catch {
    allAtts = [];
  }

  if (!Array.isArray(allAtts)) {
    allAtts = [];
  }

  // 2. Agregasi per personId
  const tempStats = new Map<
    string,
    {
      pastAttended: number;
      currentIsAttended: boolean;
      totalRegistered: number;
      lastAttendedTitle: string | null;
      lastAttendedDate: string | null;
    }
  >();

  for (const att of allAtts) {
    let current = tempStats.get(att.personId);
    if (!current) {
      current = {
        pastAttended: 0,
        currentIsAttended: false,
        totalRegistered: 0,
        lastAttendedTitle: null,
        lastAttendedDate: null,
      };
      tempStats.set(att.personId, current);
    }

    current.totalRegistered += 1;

    const isCurrentEvent = Boolean(currentEventId && att.eventId === currentEventId);
    if (isCurrentEvent) {
      if (att.status === 'attended') {
        current.currentIsAttended = true;
      }
    } else {
      if (att.status === 'attended') {
        current.pastAttended += 1;
        // Simpan event terakhir yang dihadiri (karena sudah diurutkan desc)
        if (!current.lastAttendedTitle) {
          current.lastAttendedTitle = att.eventTitle;
          current.lastAttendedDate = att.eventStartAt ? new Date(att.eventStartAt).toISOString() : null;
        }
      }
    }
  }

  // 3. Buat statistik final
  for (const pid of personIds) {
    const raw = tempStats.get(pid);
    if (raw) {
      const pastCount = raw.pastAttended;
      const currentNumber = pastCount + 1;
      const totalCount = pastCount + (raw.currentIsAttended ? 1 : 0);
      const tierInfo = getLoyaltyTierInfo(currentNumber);

      statsMap.set(pid, {
        personId: pid,
        pastAttendedCount: pastCount,
        totalAttendedCount: totalCount,
        pastRegisteredCount: raw.totalRegistered,
        currentKajianNumber: currentNumber,
        loyaltyTier: tierInfo.tier,
        loyaltyLabel: tierInfo.badge,
        lastAttendedTitle: raw.lastAttendedTitle,
        lastAttendedDate: raw.lastAttendedDate,
      });
    }
  }

  return statsMap;
}

/**
 * Menghitung riwayat kehadiran untuk 1 person tunggal
 */
export async function getSinglePersonAttendanceStats(
  db: any,
  personId: string,
  currentEventId?: string | null
): Promise<PersonAttendanceStats> {
  const map = await getPersonsAttendanceStats(db, [personId], currentEventId);
  return (
    map.get(personId) || {
      personId,
      pastAttendedCount: 0,
      totalAttendedCount: 0,
      pastRegisteredCount: 0,
      currentKajianNumber: 1,
      loyaltyTier: 'perdana',
      loyaltyLabel: 'Kajian Perdana',
      lastAttendedTitle: null,
      lastAttendedDate: null,
    }
  );
}
