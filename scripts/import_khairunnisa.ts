import 'dotenv/config';
import fs from 'fs';
import { getDb } from '../server/db/client';
import { events, eventAttendance, persons, appUsers } from '../server/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { normalizeIndonesianPhone } from '../server/lib/phone';

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    const next = clean[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      currentRow.push(currentVal.trim());
      if (currentRow.some((v) => v !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += c;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((v) => v !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

async function run() {
  console.log('--- Starting Ultra-Fast Batch Import to BAIT-BAIT KHAIRUNNISA ---');

  const db = getDb();

  // 1. Get or create creator user
  let adminUser = await db.query.appUsers.findFirst({
    where: eq(appUsers.email, 'admin@tarbiyahsunnah.id'),
  });

  if (!adminUser) {
    adminUser = await db.query.appUsers.findFirst();
  }

  // 2. Find or create the Event "BAIT-BAIT KHAIRUNNISA"
  let event = await db.query.events.findFirst({
    where: ilike(events.title, '%KHAIRUNNISA%'),
  });

  if (!event) {
    console.log('Event "BAIT-BAIT KHAIRUNNISA" not found, creating new event...');
    const [created] = await db
      .insert(events)
      .values({
        title: 'BAIT-BAIT KHAIRUNNISA',
        category: 'Daurah & Tabligh Akbar',
        speaker: 'Asatidzah Tarbiyah Sunnah',
        description: 'Daurah & Majelis Ilmu Khusus Muslimah: Bait-Bait Khairunnisa.',
        startAt: new Date('2025-12-07T08:00:00Z'),
        endAt: new Date('2025-12-07T12:00:00Z'),
        deliveryMode: 'offline',
        locationName: 'Masjid Tarbiyah Sunnah Bandung',
        targetAudience: 'akhwat_only',
        quota: 2000,
        quotaAkhwat: 2000,
        isRegistrationOpen: true,
        createdBy: adminUser!.id,
      })
      .returning();
    event = created;
  }

  console.log(`Target Event: "${event.title}" (ID: ${event.id})`);

  // 3. Read CSV
  const csvPath = 'C:/Users/P R E D A T O R/.gemini/antigravity/brain/cb246d5c-9509-4656-8c01-2dd10f5a1037/.user_uploaded/media_1786794894641.csv';
  const rawContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(rawContent);
  const dataRows = rows.slice(1);
  console.log(`Total valid data rows: ${dataRows.length}`);

  const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
  const nameIdx = headers.findIndex((h) => h === 'nama');
  const phoneIdx = headers.findIndex((h) => h === 'whatsapp');
  const genderIdx = headers.findIndex((h) => h === 'jenis kelamin');
  const ageIdx = headers.findIndex((h) => h === 'umur');
  const provIdx = headers.findIndex((h) => h === 'provinsi');
  const cityIdx = headers.findIndex((h) => h === 'kabupaten/kota');
  const distIdx = headers.findIndex((h) => h === 'kecamatan');
  const addrIdx = headers.findIndex((h) => h === 'alamat lengkap');
  const codeIdx = headers.findIndex((h) => h === 'kode registrasi' || h === 'barcode');
  const checkInIdx = headers.findIndex((h) => h === 'status check in');
  const mahramNameIdx = headers.findIndex((h) => h === 'nama mahram');
  const mahramWaIdx = headers.findIndex((h) => h === 'whatsapp mahram');

  // 4. Preload all existing persons to memory Map
  console.log('Preloading existing persons from DB...');
  const allPersons = await db.query.persons.findMany({
    columns: { id: true, phoneE164: true, fullName: true },
  });

  const personPhoneMap = new Map<string, string>(); // phoneE164 -> personId
  allPersons.forEach((p) => {
    if (p.phoneE164) personPhoneMap.set(p.phoneE164, p.id);
  });
  console.log(`Preloaded ${personPhoneMap.size} existing persons with phone numbers.`);

  // 5. Preload existing attendance for this event
  const existingAttendances = await db.query.eventAttendance.findMany({
    where: eq(eventAttendance.eventId, event.id),
    columns: { personId: true },
  });
  const attendedPersonIds = new Set(existingAttendances.map((a) => a.personId));
  console.log(`Preloaded ${attendedPersonIds.size} existing event attendances.`);

  // 6. Identify persons to insert
  const uniqueNewPersonsToInsert: Array<{
    fullName: string;
    phoneE164: string;
    gender: 'ikhwan' | 'akhwat';
    province: string | null;
    cityRegency: string | null;
    district: string | null;
    sourceCode: string;
    engagementStatus: 'baru';
    donorStage: 'new_lead';
  }> = [];

  const seenPhonesInBatch = new Set<string>();

  dataRows.forEach((row) => {
    const rawName = (nameIdx !== -1 ? row[nameIdx] : '') || '';
    const rawPhone = (phoneIdx !== -1 ? row[phoneIdx] : '') || '';
    const rawGender = (genderIdx !== -1 ? row[genderIdx] : '') || '';
    const rawProv = (provIdx !== -1 ? row[provIdx] : '') || '';
    const rawCity = (cityIdx !== -1 ? row[cityIdx] : '') || '';
    const rawDist = (distIdx !== -1 ? row[distIdx] : '') || '';

    const fullName = rawName.trim();
    const phone = rawPhone.trim();
    if (!fullName || !phone) return;

    const phoneNorm = normalizeIndonesianPhone(phone);
    if (personPhoneMap.has(phoneNorm) || seenPhonesInBatch.has(phoneNorm)) return;

    seenPhonesInBatch.add(phoneNorm);
    const isAkhwat = rawGender.toLowerCase().includes('perempuan') || rawGender.toLowerCase().includes('akhwat');

    uniqueNewPersonsToInsert.push({
      fullName,
      phoneE164: phoneNorm,
      gender: isAkhwat ? 'akhwat' : 'ikhwan',
      province: rawProv.trim() || null,
      cityRegency: rawCity.trim() || null,
      district: rawDist.trim() || null,
      sourceCode: 'csv_import_khairunnisa',
      engagementStatus: 'baru',
      donorStage: 'new_lead',
    });
  });

  console.log(`Found ${uniqueNewPersonsToInsert.length} new persons to insert.`);

  // Insert persons in chunks of 25
  const CHUNK_SIZE = 25;
  for (let i = 0; i < uniqueNewPersonsToInsert.length; i += CHUNK_SIZE) {
    const chunk = uniqueNewPersonsToInsert.slice(i, i + CHUNK_SIZE);
    const inserted = await db.insert(persons).values(chunk).returning();
    inserted.forEach((p) => {
      if (p.phoneE164) personPhoneMap.set(p.phoneE164, p.id);
    });
    console.log(`Inserted persons chunk ${i + 1} - ${i + chunk.length} / ${uniqueNewPersonsToInsert.length}`);
  }

  // 7. Prepare event_attendance records
  const attendancesToInsert: Array<{
    eventId: string;
    personId: string;
    source: 'csv_import';
    status: 'registered' | 'attended';
    ticketCode: string;
    vehicleType: 'none';
    registrationData: any;
  }> = [];

  let skippedCount = 0;

  dataRows.forEach((row, i) => {
    const rawName = (nameIdx !== -1 ? row[nameIdx] : '') || '';
    const rawPhone = (phoneIdx !== -1 ? row[phoneIdx] : '') || '';
    const rawAge = (ageIdx !== -1 ? row[ageIdx] : '') || '';
    const rawAddr = (addrIdx !== -1 ? row[addrIdx] : '') || '';
    const rawCode = (codeIdx !== -1 ? row[codeIdx] : '') || '';
    const rawCheckIn = (checkInIdx !== -1 ? row[checkInIdx] : '') || '';
    const rawMahram = (mahramNameIdx !== -1 ? row[mahramNameIdx] : '') || '';
    const rawMahramWa = (mahramWaIdx !== -1 ? row[mahramWaIdx] : '') || '';

    const phoneNorm = normalizeIndonesianPhone(rawPhone);
    const personId = personPhoneMap.get(phoneNorm);

    if (!personId) return;

    if (attendedPersonIds.has(personId)) {
      skippedCount++;
      return;
    }

    attendedPersonIds.add(personId);

    const isAttended = rawCheckIn.toLowerCase().includes('sudah');
    const regData: Record<string, any> = {};
    if (rawAge) regData.age = parseInt(rawAge, 10) || rawAge;
    if (rawMahram) regData.mahramName = rawMahram;
    if (rawMahramWa) regData.mahramPhone = rawMahramWa;
    if (rawAddr) regData.address = rawAddr;

    attendancesToInsert.push({
      eventId: event.id,
      personId,
      source: 'csv_import',
      status: isAttended ? 'attended' : 'registered',
      ticketCode: rawCode || `TIKET-KHAIRUNNISA-${i + 1}`,
      vehicleType: 'none',
      registrationData: Object.keys(regData).length > 0 ? regData : null,
    });
  });

  console.log(`Ready to insert ${attendancesToInsert.length} attendance records (${skippedCount} skipped dups).`);

  // Insert attendances in chunks of 25
  for (let i = 0; i < attendancesToInsert.length; i += CHUNK_SIZE) {
    const chunk = attendancesToInsert.slice(i, i + CHUNK_SIZE);
    await db.insert(eventAttendance).values(chunk);
    console.log(`Inserted attendance chunk ${i + 1} - ${i + chunk.length} / ${attendancesToInsert.length}`);
  }

  console.log('\n=========================================');
  console.log('✅ SUKSES MENGIMPOR DATA KE BAIT-BAIT KHAIRUNNISA');
  console.log(`- Total Baris CSV        : ${dataRows.length}`);
  console.log(`- Jamaah Baru Terdaftar  : ${uniqueNewPersonsToInsert.length}`);
  console.log(`- Pendaftar Kajian Masuk : ${attendancesToInsert.length}`);
  console.log(`- Duplikat Dilewati      : ${skippedCount}`);
  console.log('=========================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during batch import:', err);
  process.exit(1);
});
