import 'dotenv/config';
import { getDb } from '../server/db/client';
import { persons, eventAttendance, events, donations, waqfCases } from '../server/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('--- Querying Multi-Kajian Attendees ---');

  // Query persons having 2 or more attendances
  const multiAttendees = await db
    .select({
      personId: persons.id,
      fullName: persons.fullName,
      phoneE164: persons.phoneE164,
      cityRegency: persons.cityRegency,
      engagementStatus: persons.engagementStatus,
      totalKajian: sql<number>`count(${eventAttendance.id})::int`,
    })
    .from(eventAttendance)
    .innerJoin(persons, eq(eventAttendance.personId, persons.id))
    .groupBy(persons.id, persons.fullName, persons.phoneE164, persons.cityRegency, persons.engagementStatus)
    .having(sql`count(${eventAttendance.id}) >= 2`)
    .orderBy(desc(sql`count(${eventAttendance.id})`));

  console.log(`Found ${multiAttendees.length} persons with >= 2 kajian attendances.\n`);

  for (const p of multiAttendees) {
    // Get detail attendances for this person
    const atts = await db
      .select({
        eventTitle: events.title,
        startAt: events.startAt,
        status: eventAttendance.status,
        ticketCode: eventAttendance.ticketCode,
      })
      .from(eventAttendance)
      .innerJoin(events, eq(eventAttendance.eventId, events.id))
      .where(eq(eventAttendance.personId, p.personId))
      .orderBy(desc(events.startAt));

    // Get donations
    const userDonations = await db.query.donations.findMany({
      where: eq(donations.personId, p.personId),
    });

    // Get waqf
    const userWaqf = await db.query.waqfCases.findMany({
      where: eq(waqfCases.personId, p.personId),
    });

    console.log(`👤 Nama: ${p.fullName}`);
    console.log(`   ID: ${p.personId}`);
    console.log(`   No. WhatsApp: ${p.phoneE164 || '-'}`);
    console.log(`   Kota/Domisili: ${p.cityRegency || '-'}`);
    console.log(`   Status Engagement: ${p.engagementStatus}`);
    console.log(`   Total Kajian Diikuti: ${p.totalKajian}x`);
    console.log('   Daftar Kajian:');
    atts.forEach((a, i) => {
      console.log(`     ${i + 1}. [${a.status.toUpperCase()}] ${a.eventTitle} (Tiket: ${a.ticketCode || '-'}) - ${a.startAt ? new Date(a.startAt).toLocaleDateString('id-ID') : '-'}`);
    });
    if (userDonations.length > 0) {
      console.log(`   💰 Riwayat Donasi: ${userDonations.length} transaksi`);
    }
    if (userWaqf.length > 0) {
      console.log(`   🏛️ Riwayat Wakaf: ${userWaqf.length} kasus`);
    }
    console.log('--------------------------------------------------');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
