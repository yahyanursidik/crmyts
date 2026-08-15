import { z } from 'zod';
import { Router } from '../../http/router';
import { requireAuth, validateBody } from '../../http/middleware';
import { successResponse, errorResponse } from '../../http/response';
import { getDb } from '../../db/client';
import {
  persons,
  events,
  eventAttendance,
  donations,
  donationPrograms,
  waqfCases,
  interactions,
  tasks,
} from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logAuditEvent } from '../../audit/service';

const triggerBatchReminderSchema = z.object({
  eventId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerAttendanceThanksSchema = z.object({
  eventId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerDonationThanksSchema = z.object({
  donationId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

const triggerWaqfFollowupSchema = z.object({
  waqfCaseId: z.string().uuid(),
  nextStepNotes: z.string().optional().nullable(),
});

const triggerProgramReportSchema = z.object({
  programId: z.string().uuid(),
  reportTitle: z.string().min(3),
  reportSummary: z.string().min(10),
  documentationUrl: z.string().url().optional().nullable(),
});

const sendInactiveGreetingSchema = z.object({
  personId: z.string().uuid(),
  templateType: z.enum(['kabar_doa', 'undangan_kajian', 'tabayyun_taawun', 'custom']).default('kabar_doa'),
  message: z.string().min(5),
  createFollowupTask: z.boolean().default(false),
  taskTitle: z.string().optional().nullable(),
  taskDueDate: z.string().optional().nullable(),
});

export function registerAutomationRoutes(router: Router) {
  // 1. GET /api/automation/templates
  router.get(
    '/api/automation/templates',
    requireAuth(async (ctx) => {
      const templates = [
        {
          id: 'event_reminder',
          name: 'Pengingat Kajian & Tabligh Akbar (H-1 / H-Day)',
          category: 'Kajian & Dakwah',
          description: 'Mengirimkan pesan pengingat jadwal, tema kajian, pemateri, dan tautan live streaming kepada jamaah.',
          variables: ['{{namaJamaah}}', '{{judulKajian}}', '{{pemateri}}', '{{waktuKajian}}', '{{tempatMode}}', '{{linkStreaming}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaJamaah}},\n\nMengingatkan kembali agenda kajian berkah Yayasan Tarbiyah Sunnah:\n\n📖 *{{judulKajian}}*\n🎙️ Pemateri: *{{pemateri}}*\n📅 Waktu: *{{waktuKajian}}*\n📍 Tempat/Mode: *{{tempatMode}}*\n🔗 Link Streaming: {{linkStreaming}}\n\nSemoga Allah meringankan langkah kita menuntut ilmu syar'i. Ditunggu kehadirannya, barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'attendance_thanks',
          name: 'Ucapan Pasca-Kehadiran & Doa Istiqomah Mengamalkan Ilmu',
          category: 'Kajian & Dakwah',
          description: 'Dikirimkan kepada jamaah yang telah hadir di kajian sore/hari ini untuk mendoakan keistiqomahan dalam mengamalkan ilmu yang didapat.',
          variables: ['{{namaJamaah}}', '{{judulKajian}}', '{{pemateri}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaJamaah}},\n\nAlhamdulillah, terima kasih banyak atas kehadiran Bapak/Ibu pada kajian:\n📖 *{{judulKajian}}*\n🎙️ Pemateri: *{{pemateri}}*\n\nMari kita berdoa semoga Allah Ta'ala meneguhkan hati kita di atas istiqomah menuntut ilmu syar'i dan memudahkan kita dalam mengamalkan ilmu-ilmu yang telah didapat.\n\nSampai bertemu di majelis ilmu berikutnya. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'donation_thanks',
          name: 'Ucapan Terima Kasih & Bukti Sah Donasi (E-Receipt)',
          category: 'Keuangan & Infaq',
          description: 'Otomatis dibuat saat donasi terverifikasi oleh Finance sebagai tanda bukti sah dan doa keberkahan.',
          variables: ['{{namaDonatur}}', '{{nominalRupiah}}', '{{namaProgram}}', '{{tanggalDonasi}}', '{{kodeTransaksi}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAlhamdulillah, donasi/infaq Bapak/Ibu {{namaDonatur}} telah kami terima dan diverifikasi secara sah:\n\n💰 *Nominal*: Rp {{nominalRupiah}}\n📌 *Program*: {{namaProgram}}\n📅 *Tanggal*: {{tanggalDonasi}}\n🧾 *No. Ref*: #{{kodeTransaksi}}\n\n_Jazakumullahu khairan katsiran_ atas kepercayaannya menyalurkan infaq melalui Yayasan Tarbiyah Sunnah. Semoga Allah menjadikannya amal jariyah pemberat timbangan kebaikan di yaumil akhir, melapangkan rezeki, dan memberkahi keluarga. Aamiin ya Rabbal 'Alamin.\n\n— Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'waqf_followup',
          name: 'Follow-Up Progres Tahapan Wakaf Aset',
          category: 'Wakaf & Aset Umat',
          description: 'Mengabarkan perkembangan proses legalitas, ikrar wakaf (AIW), sertifikasi BPN, atau pengelolaan aset kepada Waqif.',
          variables: ['{{namaWaqif}}', '{{jenisWakaf}}', '{{tahapanSaatIni}}', '{{catatanProgres}}', '{{namaAmil}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu {{namaWaqif}},\n\nSemoga Bapak/Ibu senantiasa dalam lindungan dan rahmat Allah Ta'ala. Kami dari Divisi Wakaf Yayasan Tarbiyah Sunnah mengabarkan progres pengelolaan aset wakaf *{{jenisWakaf}}*:\n\n📍 *Status Tahapan*: {{tahapanSaatIni}}\n📝 *Catatan Perkembangan*: {{catatanProgres}}\n\nInsya Allah amil kami ({{namaAmil}}) akan terus mengawal proses ini hingga tuntas dan bermanfaat bagi kaum muslimin. Terima kasih atas amanah mulia ini, barakallahu fiikum.\n\n— Tim Wakaf Yayasan Tarbiyah Sunnah`,
        },
        {
          id: 'program_report',
          name: 'Laporan Penyaluran & Dampak Program Donasi',
          category: 'Akuntabilitas & Stewardship',
          description: 'Laporan berkala realisasi penyaluran dana infaq beserta dokumentasi foto/kegiatan kepada para donatur program.',
          variables: ['{{namaDonatur}}', '{{namaProgram}}', '{{judulLaporan}}', '{{ringkasanPenyaluran}}', '{{linkDokumentasi}}'],
          defaultTemplate: `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Sahabat Kebaikan {{namaDonatur}},\n\nAlhamdulillah, berikut kami sampaikan laporan berkala penyaluran program *{{namaProgram}}*:\n\n📊 *{{judulLaporan}}*\n{{ringkasanPenyaluran}}\n\n📸 Dokumentasi & Laporan Lengkap: {{linkDokumentasi}}\n\nSemoga setiap rupiah yang diinfaqkan terus mengalirkan pahala kebaikan yang tiada putus. _Jazakumullahu khairan katsiran_.\n\n— Yayasan Tarbiyah Sunnah`,
        },
      ];

      return successResponse(templates, { requestId: ctx.requestId });
    })
  );

  // 2. POST /api/automation/trigger-event-reminder (Batch Reminders Before Event)
  router.post(
    '/api/automation/trigger-event-reminder',
    requireAuth(
      validateBody(triggerBatchReminderSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const event = await db.query.events.findFirst({
          where: eq(events.id, body.eventId),
        });

        if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);

        // Fetch recent active jamaah
        const activePersons = await db.query.persons.findMany({
          limit: 20,
          orderBy: [desc(persons.createdAt)],
        });

        const formattedDate = new Date(event.startAt).toLocaleString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const locationStr = event.deliveryMode === 'online'
          ? 'Online (Zoom / YouTube Live)'
          : event.locationName || 'Masjid Tarbiyah Sunnah, Bandung';

        const streamingUrl = event.meetingUrl || 'https://youtube.com/@tarbiyahsunnah';

        const generatedItems = activePersons
          .filter((p) => p.phoneE164)
          .map((p) => {
            const rawPhone = p.phoneE164 ? p.phoneE164.replace(/[^0-9]/g, '') : '';
            const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${p.fullName},\n\nMengingatkan kembali agenda kajian berkah Yayasan Tarbiyah Sunnah:\n\n📖 *${event.title}*\n🎙️ Pemateri: *${event.speaker}*\n📅 Waktu: *${formattedDate} WIB*\n📍 Tempat/Mode: *${locationStr}*\n🔗 Link Streaming: ${streamingUrl}\n\nSemoga Allah meringankan langkah kita menuntut ilmu syar'i. Ditunggu kehadirannya, barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

            return {
              personId: p.id,
              fullName: p.fullName,
              phoneE164: p.phoneE164,
              email: p.email,
              message,
              waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
            };
          });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_event_reminder_batch',
          entityType: 'event',
          entityId: event.id,
          afterJson: { count: generatedItems.length, eventTitle: event.title },
          reason: body.notes || `Pengingat otomatis kajian ${event.title}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            eventId: event.id,
            eventTitle: event.title,
            speaker: event.speaker,
            eventDate: formattedDate,
            totalGenerated: generatedItems.length,
            items: generatedItems,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 3. POST /api/automation/trigger-attendance-thanks (Post-Event Gratitude & Doa Istiqomah)
  router.post(
    '/api/automation/trigger-attendance-thanks',
    requireAuth(
      validateBody(triggerAttendanceThanksSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const event = await db.query.events.findFirst({
          where: eq(events.id, body.eventId),
        });

        if (!event) return errorResponse('NOT_FOUND', 'Kajian tidak ditemukan', 404, ctx.requestId);

        // Fetch attendees checked in
        const attendances = await db.query.eventAttendance.findMany({
          where: eq(eventAttendance.eventId, event.id),
          with: { person: true },
        });

        // If no attendees checked in yet, fallback to recent attendees list for demo
        let targetPersons: any[] = attendances.map((a) => a.person).filter(Boolean);
        if (targetPersons.length === 0) {
          targetPersons = await db.query.persons.findMany({ limit: 10 });
        }

        const generatedItems = targetPersons
          .filter((p) => p.phoneE164)
          .map((p) => {
            const rawPhone = p.phoneE164.replace(/[^0-9]/g, '');
            const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${p.fullName},\n\nAlhamdulillah, terima kasih banyak atas kehadiran Bapak/Ibu pada kajian:\n📖 *${event.title}*\n🎙️ Pemateri: *${event.speaker}*\n\nMari kita berdoa semoga Allah Ta'ala meneguhkan hati kita di atas istiqomah menuntut ilmu syar'i dan memudahkan kita dalam mengamalkan ilmu-ilmu yang telah didapat.\n\nSampai bertemu di majelis ilmu berikutnya. Barakallahu fiikum.\n\n— Yayasan Tarbiyah Sunnah`;

            return {
              personId: p.id,
              fullName: p.fullName,
              phoneE164: p.phoneE164,
              email: p.email,
              message,
              waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
            };
          });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_attendance_thanks_batch',
          entityType: 'event',
          entityId: event.id,
          afterJson: { count: generatedItems.length, eventTitle: event.title },
          reason: body.notes || `Ucapan alhamdulillah dan doa istiqomah pasca-kajian ${event.title}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            eventId: event.id,
            eventTitle: event.title,
            speaker: event.speaker,
            totalAttendees: generatedItems.length,
            items: generatedItems,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 4. POST /api/automation/trigger-donation-thanks (Donation E-Receipt)
  router.post(
    '/api/automation/trigger-donation-thanks',
    requireAuth(
      validateBody(triggerDonationThanksSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const donation = await db.query.donations.findFirst({
          where: eq(donations.id, body.donationId),
          with: {
            person: true,
            program: true,
          },
        });

        if (!donation) return errorResponse('NOT_FOUND', 'Data donasi tidak ditemukan', 404, ctx.requestId);

        const donorName = donation.person?.fullName || 'Hamba Allah';
        const programName = donation.program?.name || 'Infaq Dakwah & Operasional';
        const formattedAmount = Number(donation.amountRupiah).toLocaleString('id-ID');
        const formattedDate = new Date(donation.donationDate).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const refCode = donation.id.substring(0, 8).toUpperCase();

        const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAlhamdulillah, donasi/infaq Bapak/Ibu ${donorName} telah kami terima dan diverifikasi secara sah:\n\n💰 *Nominal*: Rp ${formattedAmount}\n📌 *Program*: ${programName}\n📅 *Tanggal*: ${formattedDate}\n🧾 *No. Ref*: #${refCode}\n\n_Jazakumullahu khairan katsiran_ atas kepercayaannya menyalurkan infaq melalui Yayasan Tarbiyah Sunnah. Semoga Allah menjadikannya amal jariyah pemberat timbangan kebaikan di yaumil akhir, melapangkan rezeki, dan memberkahi keluarga. Aamiin ya Rabbal 'Alamin.\n\n— Yayasan Tarbiyah Sunnah`;

        const phoneClean = donation.person?.phoneE164 ? donation.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` : null;

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_donation_receipt',
          entityType: 'donation',
          entityId: donation.id,
          afterJson: { donorName, amountRupiah: donation.amountRupiah, refCode },
          reason: body.notes || 'Pengiriman bukti sah tanda terima donasi via WhatsApp/Email',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            donationId: donation.id,
            donorName,
            donorPhone: donation.person?.phoneE164 || null,
            donorEmail: donation.person?.email || null,
            amountRupiah: Number(donation.amountRupiah),
            programName,
            message,
            waDirectUrl,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 5. POST /api/automation/trigger-waqf-followup
  router.post(
    '/api/automation/trigger-waqf-followup',
    requireAuth(
      validateBody(triggerWaqfFollowupSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const waqf = await db.query.waqfCases.findFirst({
          where: eq(waqfCases.id, body.waqfCaseId),
          with: {
            person: true,
            owner: true,
          },
        });

        if (!waqf) return errorResponse('NOT_FOUND', 'Kasus wakaf tidak ditemukan', 404, ctx.requestId);

        const waqifName = waqf.person?.fullName || 'Bapak/Ibu Waqif';
        const amilName = waqf.owner?.fullName || user.fullName;
        const stageDescriptions: Record<string, string> = {
          interested: 'Penyampaian Minat Awal Wakaf',
          consulted: 'Konsultasi Syar\'i & Rencana Peruntukan Aset',
          pledged: 'Penandatanganan Ikrar Wakaf',
          document_preparation: 'Pemberkasan Sertifikasi KUA & BPN',
          in_progress: 'Proses Legalitas & Pembangunan Fisik',
          completed: 'Sertifikat Terbit & Aset Siap Difungsikan',
          stewardship: 'Pengelolaan Berkelanjutan & Manfaat Dakwah',
        };

        const stageTitle = stageDescriptions[waqf.currentStage] || waqf.currentStage;
        const notesStr = body.nextStepNotes || waqf.notesSummary || 'Berkas sedang dalam verifikasi kelayakan legalitas.';

        const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Bapak/Ibu ${waqifName},\n\nSemoga Bapak/Ibu senantiasa dalam lindungan dan rahmat Allah Ta'ala. Kami dari Divisi Wakaf Yayasan Tarbiyah Sunnah mengabarkan progres pengelolaan aset wakaf *${waqf.waqfType.toUpperCase()}*:\n\n📍 *Status Tahapan*: ${stageTitle}\n📝 *Catatan Perkembangan*: ${notesStr}\n\nInsya Allah amil kami (${amilName}) akan terus mengawal proses ini hingga tuntas dan bermanfaat bagi kaum muslimin. Terima kasih atas amanah mulia ini, barakallahu fiikum.\n\n— Tim Wakaf Yayasan Tarbiyah Sunnah`;

        const phoneClean = waqf.person?.phoneE164 ? waqf.person.phoneE164.replace(/[^0-9]/g, '') : null;
        const waDirectUrl = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` : null;

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_waqf_followup',
          entityType: 'waqf_case',
          entityId: waqf.id,
          afterJson: { waqifName, currentStage: waqf.currentStage },
          reason: body.nextStepNotes || 'Update berkala perkembangan wakaf aset',
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            waqfCaseId: waqf.id,
            waqifName,
            waqifPhone: waqf.person?.phoneE164 || null,
            waqifEmail: waqf.person?.email || null,
            currentStage: waqf.currentStage,
            stageTitle,
            message,
            waDirectUrl,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 6. POST /api/automation/trigger-program-report (Program Impact Report Broadcast)
  router.post(
    '/api/automation/trigger-program-report',
    requireAuth(
      validateBody(triggerProgramReportSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const program = await db.query.donationPrograms.findFirst({
          where: eq(donationPrograms.id, body.programId),
        });

        if (!program) return errorResponse('NOT_FOUND', 'Program donasi tidak ditemukan', 404, ctx.requestId);

        // Fetch donors who contributed to this program
        const programDonations = await db.query.donations.findMany({
          where: and(eq(donations.programId, program.id), eq(donations.verificationStatus, 'verified')),
          with: { person: true },
          limit: 50,
        });

        const uniqueDonorsMap = new Map();
        for (const d of programDonations) {
          if (d.person && d.person.phoneE164) {
            uniqueDonorsMap.set(d.person.id, d.person);
          }
        }

        const donors = Array.from(uniqueDonorsMap.values());
        const docUrl = body.documentationUrl || 'https://tarbiyahsunnah.id/laporan-penyaluran';

        const items = donors.map((d: any) => {
          const rawPhone = d.phoneE164.replace(/[^0-9]/g, '');
          const message = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. Sahabat Kebaikan ${d.fullName},\n\nAlhamdulillah, berikut kami sampaikan laporan berkala penyaluran program *${program.name}*:\n\n📊 *${body.reportTitle}*\n${body.reportSummary}\n\n📸 Dokumentasi & Laporan Lengkap: ${docUrl}\n\nSemoga setiap rupiah yang diinfaqkan terus mengalirkan pahala kebaikan yang tiada putus. _Jazakumullahu khairan katsiran_.\n\n— Yayasan Tarbiyah Sunnah`;

          return {
            personId: d.id,
            fullName: d.fullName,
            phoneE164: d.phoneE164,
            email: d.email,
            message,
            waDirectUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
          };
        });

        await logAuditEvent({
          actorUserId: user.id,
          action: 'trigger_program_impact_report',
          entityType: 'donation_program',
          entityId: program.id,
          afterJson: { programName: program.name, totalDonors: items.length, reportTitle: body.reportTitle },
          reason: `Laporan dampak penyaluran program ${program.name}`,
          requestId: ctx.requestId,
        });

        return successResponse(
          {
            programId: program.id,
            programName: program.name,
            totalDonorsReached: items.length,
            items,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );

  // 6. GET /api/automation/inactive-attendees (Jamaah Rindu Majelis Detection)
  router.get(
    '/api/automation/inactive-attendees',
    requireAuth(async (ctx) => {
      const db = getDb();
      const minDays = ctx.query.minDays ? parseInt(ctx.query.minDays as string, 10) : 30;
      const gender = ctx.query.gender as string | undefined;
      const search = (ctx.query.search as string | undefined)?.toLowerCase() || '';

      // 1. Fetch all attendance records with person & event
      const allAttendances = await db.query.eventAttendance.findMany({
        with: {
          event: true,
          person: true,
        },
        orderBy: [desc(eventAttendance.checkInAt)],
      });

      // 2. Fetch all greetings/interactions
      const allInteractions = await db.query.interactions.findMany({
        orderBy: [desc(interactions.occurredAt)],
      });

      // 3. Fetch upcoming open event for invitation
      const now = new Date();
      const upcomingEvents = await db.query.events.findMany({
        where: eq(events.isRegistrationOpen, true),
        orderBy: [desc(events.startAt)],
        limit: 1,
      });
      const nextEvent = upcomingEvents[0] || null;

      const formattedNextEvent = nextEvent
        ? {
            id: nextEvent.id,
            title: nextEvent.title,
            speaker: nextEvent.speaker,
            locationName: nextEvent.locationName || 'Masjid Tarbiyah Sunnah',
            startAt: nextEvent.startAt,
            startAtFormatted: new Intl.DateTimeFormat('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(nextEvent.startAt)) + ' WIB',
          }
        : null;

      // Group attendances by personId
      const personAttendanceMap = new Map<string, { person: any; attendances: any[] }>();
      for (const att of allAttendances) {
        if (!att.person || !att.person.phoneE164) continue;
        if (!personAttendanceMap.has(att.personId)) {
          personAttendanceMap.set(att.personId, { person: att.person, attendances: [] });
        }
        personAttendanceMap.get(att.personId)!.attendances.push(att);
      }

      // Group greetings by personId
      const personGreetingsMap = new Map<string, any[]>();
      for (const inter of allInteractions) {
        if (!personGreetingsMap.has(inter.personId)) {
          personGreetingsMap.set(inter.personId, []);
        }
        if (
          (inter.summary || '').toLowerCase().includes('sapaan') ||
          (inter.summary || '').toLowerCase().includes('rindu majelis')
        ) {
          personGreetingsMap.get(inter.personId)!.push(inter);
        }
      }

      const inactiveList: any[] = [];
      let totalGreetedRecently = 0;

      for (const [, { person: p, attendances }] of personAttendanceMap) {
        if (gender && gender !== 'all' && p.gender !== gender) continue;
        if (
          search &&
          !p.fullName.toLowerCase().includes(search) &&
          !p.phoneE164.includes(search) &&
          !(p.cityRegency || '').toLowerCase().includes(search)
        ) {
          continue;
        }

        const validAttendances = attendances.filter(
          (a) => a.status === 'attended' || a.status === 'registered'
        );

        if (validAttendances.length === 0) continue;

        const latestAttendance = validAttendances[0];
        const lastAttendedDate = latestAttendance.checkInAt;
        const diffMs = now.getTime() - new Date(lastAttendedDate).getTime();
        const daysSinceLastAttendance = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (daysSinceLastAttendance < minDays) continue;

        // Find recent greetings
        const recentGreetings = personGreetingsMap.get(p.id) || [];
        const lastGreeting = recentGreetings[0] || null;
        const lastGreetedDate = lastGreeting ? lastGreeting.occurredAt : null;
        const daysSinceLastGreeting = lastGreetedDate
          ? Math.floor((now.getTime() - new Date(lastGreetedDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const isGreetedRecently = daysSinceLastGreeting !== null && daysSinceLastGreeting <= 30;
        if (isGreetedRecently) {
          totalGreetedRecently++;
        }

        const sapaanPanggilan = p.gender === 'akhwat' ? 'Ukhti' : p.gender === 'ikhwan' ? 'Akhi' : 'Bapak/Ibu';
        const lastEventTitle = latestAttendance.event?.title || 'Kajian Rutin Yayasan';

        // Pre-build templates
        const tplKabarDoa = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nSemoga ${sapaanPanggilan} ${p.fullName} dan keluarga senantiasa berada dalam lindungan, taufik, dan rahmat Allah Ta'ala.\n\nSudah cukup lama kami tidak bersua dengan antum di majelis ilmu Yayasan Tarbiyah Sunnah (terakhir di kajian *${lastEventTitle}*). Asatidzah dan ikhwah di majelis senantiasa merindukan kehadiran dan kebersamaan antum menuntut ilmu syar'i.\n\nSemoga antum sekeluarga selalu diberikan kesehatan, kelapangan rezeki, dan kemudahan dalam segala urusan. Sampai jumpa di majelis ilmu berikutnya, barakallahu fiikum.\n\n— Tim Layanan Jamaah Yayasan Tarbiyah Sunnah`;

        const tplUndanganKajian = formattedNextEvent
          ? `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nYth. ${sapaanPanggilan} ${p.fullName},\n\nSemoga senantiasa dalam keadaan sehat wal 'afiat. Mengingat antum sudah beberapa waktu belum sempat hadir di majelis ilmu, dengan senang hati kami mengundang antum untuk kembali hadir pada kajian terdekat kami:\n\n📖 *${formattedNextEvent.title}*\n🎙️ Pemateri: *${formattedNextEvent.speaker}*\n📅 Waktu: *${formattedNextEvent.startAtFormatted}*\n📍 Tempat: *${formattedNextEvent.locationName}*\n\nInsya Allah tempat dan fasilitas majelis telah disiapkan dengan nyaman. Kami sangat menantikan kehadiran antum kembali. _Jazakumullahu khairan_.\n\n— Yayasan Tarbiyah Sunnah`
          : tplKabarDoa;

        const tplTabayyunTaawun = `Bismillah, Assalamu'alaikum Warahmatullahi Wabarakatuh.\n\nAfwan mengganggu waktunya ${sapaanPanggilan} ${p.fullName}. Semoga antum senantiasa sehat dan berkah.\n\nKami dari Divisi Layanan Jamaah YTS memperhatikan bahwa antum sudah beberapa waktu tidak hadir di kajian. Sekadar bertabayyun dan menanyakan kabar, apakah antum atau keluarga sedang berhalangan sakit, ada kesibukan, atau ada kendala transportasi yang sekiranya bisa dibantu oleh tim ta'awun yayasan?\n\nJika ada hal yang bisa kami bantu, jangan sungkan untuk mengabari kami ya. Semoga Allah memudahkan setiap urusan antum. Barakallahu fiik.\n\n— Divisi Layanan Jamaah Tarbiyah Sunnah`;

        const rawPhone = p.phoneE164.replace(/[^0-9]/g, '');

        inactiveList.push({
          personId: p.id,
          fullName: p.fullName,
          gender: p.gender,
          phoneE164: p.phoneE164,
          cityRegency: p.cityRegency || 'Kota Bandung',
          totalAttendances: validAttendances.length,
          lastAttendedAt: lastAttendedDate,
          lastEventTitle,
          lastEventSpeaker: latestAttendance.event?.speaker || 'Asatidzah YTS',
          daysSinceLastAttendance,
          urgencyLevel: daysSinceLastAttendance >= 90 ? 'critical' : daysSinceLastAttendance >= 60 ? 'warning' : 'need_greeting',
          lastGreetedAt: lastGreetedDate,
          daysSinceLastGreeting,
          isGreetedRecently,
          templates: {
            kabar_doa: {
              id: 'kabar_doa',
              title: '🌸 Sapaan Ukhuwah & Doa Kesehatan',
              message: tplKabarDoa,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplKabarDoa)}`,
            },
            undangan_kajian: {
              id: 'undangan_kajian',
              title: '📖 Undangan Kajian & Majelis Terdekat',
              message: tplUndanganKajian,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplUndanganKajian)}`,
            },
            tabayyun_taawun: {
              id: 'tabayyun_taawun',
              title: '🤝 Tabayyun Kendala & Bantuan Ta\'awun',
              message: tplTabayyunTaawun,
              waUrl: `https://wa.me/${rawPhone}?text=${encodeURIComponent(tplTabayyunTaawun)}`,
            },
          },
        });
      }

      // Sort by daysSinceLastAttendance descending
      inactiveList.sort((a, b) => b.daysSinceLastAttendance - a.daysSinceLastAttendance);

      return successResponse(
        {
          totalInactive: inactiveList.length,
          needGreetingCount: inactiveList.filter((i) => !i.isGreetedRecently).length,
          greetedRecentlyCount: totalGreetedRecently,
          criticalCount: inactiveList.filter((i) => i.urgencyLevel === 'critical').length,
          nextUpcomingEvent: formattedNextEvent,
          items: inactiveList,
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 7. POST /api/automation/send-inactive-greeting (Log WhatsApp outreach & optional follow-up task)
  router.post(
    '/api/automation/send-inactive-greeting',
    requireAuth(
      validateBody(sendInactiveGreetingSchema, async (ctx, body) => {
        const db = getDb();
        const user = ctx.user;
        if (!user) return errorResponse('UNAUTHENTICATED', 'Login diperlukan', 401, ctx.requestId);

        const person = await db.query.persons.findFirst({
          where: eq(persons.id, body.personId),
        });

        if (!person) return errorResponse('NOT_FOUND', 'Data jamaah tidak ditemukan', 404, ctx.requestId);

        // 1. Log interaction
        const templateLabelMap: Record<string, string> = {
          kabar_doa: 'Sapaan Ukhuwah & Doa Kesehatan',
          undangan_kajian: 'Undangan Majelis Ilmu Terdekat',
          tabayyun_taawun: 'Tabayyun Kendala & Bantuan Ta\'awun',
          custom: 'Sapaan Kustom Jamaah',
        };

        const templateLabel = (body.templateType && templateLabelMap[body.templateType]) || 'Sapaan Jamaah Rindu Majelis';
        const summary = `Outbound WA: ${templateLabel}`;

        const [newInteraction] = await db
          .insert(interactions)
          .values({
            personId: person.id,
            channel: 'whatsapp',
            summary,
            outcome: 'Pesan sapaan ukhuwah terkirim via WhatsApp Web / App',
            sensitivityLevel: 'standard',
            ownerUserId: user.id,
            createdBy: user.id,
          })
          .returning();

        // 2. Optionally create follow-up task
        let createdTask = null;
        if (body.createFollowupTask) {
          const dueAt = body.taskDueDate
            ? new Date(body.taskDueDate)
            : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          const [task] = await db
            .insert(tasks)
            .values({
              personId: person.id,
              relatedType: 'interaction',
              relatedId: newInteraction ? newInteraction.id : null,
              title: body.taskTitle || `Follow-Up Respon Sapaan ${person.fullName}`,
              description: `Pengecekan respon WhatsApp sapaan rindu majelis dan koordinasi kehadiran / ta'awun.`,
              status: 'pending',
              priority: 'medium',
              dueAt,
              ownerUserId: user.id,
              assignedBy: user.id,
            })
            .returning();

          createdTask = task;
        }

        // 3. Log Audit
        await logAuditEvent({
          actorUserId: user.id,
          action: 'send_inactive_greeting',
          entityType: 'person',
          entityId: person.id,
          afterJson: {
            personName: person.fullName,
            templateType: body.templateType,
            interactionId: newInteraction?.id,
            hasTask: Boolean(createdTask),
          },
          reason: `Pengiriman sapaan ukhuwah jamaah rindu majelis (${person.fullName})`,
          requestId: ctx.requestId,
        });

        const rawPhone = (person.phoneE164 || '').replace(/[^0-9]/g, '');
        const waDirectUrl = rawPhone ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(body.message)}` : null;

        return successResponse(
          {
            personId: person.id,
            personName: person.fullName,
            phoneE164: person.phoneE164,
            interactionId: newInteraction?.id,
            taskId: createdTask?.id,
            waDirectUrl,
            message: body.message,
          },
          { requestId: ctx.requestId }
        );
      })
    )
  );
}
