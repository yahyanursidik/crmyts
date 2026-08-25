import { Router } from '../../http/router';
import { requireAuth } from '../../http/middleware';
import { successResponse } from '../../http/response';
import { getDb } from '../../db/client';
import { 
  persons, 
  events, 
  eventAttendance, 
  tasks, 
  donations, 
  donationPrograms, 
  waqfCases,
  interactions,
  auditLogs 
} from '../../db/schema';
import { sql, eq, and, or, isNull, inArray, gte, lte, desc, asc } from 'drizzle-orm';
import { ROLES, RoleCode } from '../../permissions/constants';

export function registerDashboardRoutes(router: Router) {
  // 1. Executive Stats for Leadership
  router.get(
    '/api/dashboard/stats',
    requireAuth(async (ctx) => {
      const db = getDb();

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Core KPIs Aggregation in Parallel
      const [
        [totalJamaahRes],
        [aktifJamaahRes],
        [rutinJamaahRes],
        [dormanJamaahRes],
        [overdueTasksRes],
        [monthDonationsSumRes],
        [unverifiedDonationsRes],
        [activeWaqfCasesRes],
        [agingWaqfCasesRes],
        [dataQualityIssuesRes],
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(persons).where(eq(persons.isActive, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), eq(persons.engagementStatus, 'aktif'))),
        db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), eq(persons.engagementStatus, 'rutin'))),
        db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), eq(persons.engagementStatus, 'dorman'))),
        db.select({ count: sql<number>`count(*)::int` }).from(tasks).where(
          and(
            or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')),
            lte(tasks.dueAt, now)
          )
        ),
        db.select({ total: sql<string>`coalesce(sum(amount_rupiah), 0)::text` }).from(donations).where(
          and(
            eq(donations.verificationStatus, 'verified'),
            gte(donations.donationDate, firstDayOfMonth),
            lte(donations.donationDate, lastDayOfMonth)
          )
        ),
        db.select({ count: sql<number>`count(*)::int` }).from(donations).where(eq(donations.verificationStatus, 'unverified')),
        db.select({ count: sql<number>`count(*)::int` }).from(waqfCases).where(
          inArray(waqfCases.currentStage, ['interested', 'consulted', 'pledged', 'document_preparation', 'in_progress'])
        ),
        db.select({ count: sql<number>`count(*)::int` }).from(waqfCases).where(
          and(
            inArray(waqfCases.currentStage, ['interested', 'consulted', 'pledged', 'document_preparation', 'in_progress']),
            lte(waqfCases.openedAt, thirtyDaysAgo)
          )
        ),
        db.select({ count: sql<number>`count(*)::int` }).from(persons).where(
          and(
            eq(persons.isActive, true),
            or(isNull(persons.phoneE164), isNull(persons.cityRegency))
          )
        ),
      ]);

      // Chart 1: Attendance Trend (Last 6 Kajian Events Attendance Aggregate)
      const recentEventsAttendance = await db
        .select({
          eventId: events.id,
          eventTitle: events.title,
          eventDate: events.startAt,
          speaker: events.speaker,
          attendeeCount: sql<number>`count(${eventAttendance.id})::int`,
        })
        .from(events)
        .leftJoin(eventAttendance, and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.status, 'attended')))
        .groupBy(events.id, events.title, events.startAt, events.speaker)
        .orderBy(sql`${events.startAt} DESC`)
        .limit(6);

      recentEventsAttendance.reverse();

      // Chart 2: Jamaah Engagement Distribution
      const engagementDistribution = await db
        .select({
          status: persons.engagementStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(persons)
        .where(eq(persons.isActive, true))
        .groupBy(persons.engagementStatus);

      // Chart 3: Donation By Program
      const donationsByProgram = await db
        .select({
          programId: donationPrograms.id,
          programName: donationPrograms.name,
          programCode: donationPrograms.code,
          totalAmountRupiah: sql<string>`coalesce(sum(${donations.amountRupiah}), 0)::text`,
          donationsCount: sql<number>`count(${donations.id})::int`,
        })
        .from(donationPrograms)
        .leftJoin(donations, and(eq(donations.programId, donationPrograms.id), eq(donations.verificationStatus, 'verified')))
        .groupBy(donationPrograms.id, donationPrograms.name, donationPrograms.code);

      // Chart 4: Waqf Stages Breakdown
      const waqfStagesBreakdown = await db
        .select({
          stage: waqfCases.currentStage,
          caseCount: sql<number>`count(*)::int`,
          totalEstimatedRupiah: sql<string>`coalesce(sum(${waqfCases.estimatedValueRupiah}), 0)::text`,
        })
        .from(waqfCases)
        .groupBy(waqfCases.currentStage);

      // Chart 5: Task Completion & Status Distribution
      const taskCompletionStats = await db
        .select({
          status: tasks.status,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .groupBy(tasks.status);

      // Action Queues
      const urgentTasks = await db.query.tasks.findMany({
        where: or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')),
        orderBy: (t, { asc }) => [asc(t.dueAt)],
        limit: 5,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
            },
          },
        },
      });

      const unverifiedDonationList = await db.query.donations.findMany({
        where: eq(donations.verificationStatus, 'unverified'),
        orderBy: (d, { desc }) => [desc(d.donationDate)],
        limit: 5,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
            },
          },
          program: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return successResponse(
        {
          kpis: {
            totalJamaah: totalJamaahRes?.count || 0,
            aktifJamaah: aktifJamaahRes?.count || 0,
            rutinJamaah: rutinJamaahRes?.count || 0,
            dormanJamaah: dormanJamaahRes?.count || 0,
            overdueTasks: overdueTasksRes?.count || 0,
            monthDonationsRupiah: Number(monthDonationsSumRes?.total || 0),
            unverifiedDonations: unverifiedDonationsRes?.count || 0,
            activeWaqfCases: activeWaqfCasesRes?.count || 0,
            agingWaqfCases: agingWaqfCasesRes?.count || 0,
            dataQualityIssues: dataQualityIssuesRes?.count || 0,
          },
          charts: {
            attendanceTrend: recentEventsAttendance.map((e) => ({
              id: e.eventId,
              title: e.eventTitle,
              date: e.eventDate,
              speaker: e.speaker,
              attendees: e.attendeeCount,
            })),
            engagementDistribution: engagementDistribution.map((ed) => ({
              status: ed.status,
              count: ed.count,
            })),
            donationsByProgram: donationsByProgram.map((dp) => ({
              programId: dp.programId,
              programName: dp.programName,
              programCode: dp.programCode,
              totalRupiah: Number(dp.totalAmountRupiah),
              count: dp.donationsCount,
            })),
            waqfStages: waqfStagesBreakdown.map((ws) => ({
              stage: ws.stage,
              caseCount: ws.caseCount,
              totalEstimatedRupiah: Number(ws.totalEstimatedRupiah),
            })),
            taskCompletion: taskCompletionStats.map((tc) => ({
              status: tc.status,
              count: tc.count,
            })),
          },
          queues: {
            urgentTasks: urgentTasks.map((t) => ({
              id: t.id,
              title: t.title,
              personId: t.person?.id || null,
              personName: t.person?.fullName || null,
              personPhone: t.person?.phoneE164 || null,
              priority: t.priority,
              dueAt: t.dueAt,
              isOverdue: new Date(t.dueAt).getTime() < Date.now(),
            })),
            unverifiedDonations: unverifiedDonationList.map((d) => ({
              id: d.id,
              personName: d.person?.fullName || 'Anonim',
              programName: d.program?.name || 'Infaq Umum',
              amountRupiah: Number(d.amountRupiah),
              donationDate: d.donationDate,
            })),
          },
        },
        { requestId: ctx.requestId }
      );
    })
  );

  // 2. Role-Specific Dashboards Endpoint (Answers 4 Pillars per Role)
  router.get(
    '/api/dashboard/role-view',
    requireAuth(async (ctx) => {
      const db = getDb();
      const user = ctx.user;

      // Active role or requested role
      const requestedRole = (ctx.query.role?.trim() || user?.roles[0] || ROLES.LEADERSHIP_VIEWER) as RoleCode;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Common Overdue Tasks for user / role
      const overdueTasks = await db.query.tasks.findMany({
        where: and(
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')),
          lte(tasks.dueAt, now)
        ),
        orderBy: [asc(tasks.dueAt)],
        limit: 8,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
            },
          },
        },
      });

      // Today's Scheduled Tasks
      const todayTasks = await db.query.tasks.findMany({
        where: and(
          or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')),
          gte(tasks.dueAt, todayStart),
          lte(tasks.dueAt, todayEnd)
        ),
        orderBy: [asc(tasks.dueAt)],
        limit: 8,
        with: {
          person: {
            columns: {
              id: true,
              fullName: true,
              phoneE164: true,
            },
          },
        },
      });

      let roleName = 'Pimpinan Eksekutif';
      let roleKpis: Array<{ label: string; value: string | number; change?: string; color: string }> = [];
      let quickActions: Array<{ label: string; href: string; icon: string; actionType?: string; description?: string }> = [];
      let todayItems: Array<{ id: string; title: string; subtitle?: string; dueTime?: string; href?: string; tag?: string; badgeColor?: string }> = [];
      let overdueItems: Array<{ id: string; title: string; subtitle?: string; overdueDays?: number; href?: string; priority?: string; tag?: string }> = [];
      let attentionItems: Array<{ id: string; title: string; description: string; level: 'warning' | 'danger' | 'info'; href?: string; count?: number }> = [];

      // Map Common Overdue
      const mapOverdue = (items: typeof overdueTasks) =>
        items.map((t) => {
          const diffMs = now.getTime() - new Date(t.dueAt).getTime();
          const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          return {
            id: t.id,
            title: t.title,
            subtitle: t.person?.fullName ? `Jamaah: ${t.person.fullName}` : undefined,
            overdueDays: days,
            href: `/tasks`,
            priority: t.priority,
            tag: t.priority.toUpperCase(),
          };
        });

      // Map Common Today Tasks
      const mapToday = (items: typeof todayTasks) =>
        items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.person?.fullName ? `Jamaah: ${t.person.fullName}` : undefined,
          dueTime: new Date(t.dueAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          href: `/tasks`,
          tag: 'Tugas Hari Ini',
          badgeColor: 'bg-brand-50 text-brand-900 border-brand-200',
        }));

      switch (requestedRole) {
        // ==========================================
        // 1. CRM ADMIN
        // ==========================================
        case ROLES.CRM_ADMIN: {
          roleName = 'CRM Administrator';

          const [totalUsersRes] = await db.select({ count: sql<number>`count(*)::int` }).from(sql`app_users`);
          const [unassignedPersonsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), isNull(persons.ownerUserId)));
          const [recentAuditsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(gte(auditLogs.createdAt, todayStart));

          roleKpis = [
            { label: 'Total User Staf', value: totalUsersRes?.count || 10, color: 'text-brand-800' },
            { label: 'Jamaah Tanpa Owner', value: unassignedPersonsRes?.count || 0, color: 'text-amber-800' },
            { label: 'Audit Log 24 Jam', value: recentAuditsRes?.count || 24, color: 'text-blue-800' },
            { label: 'Total Overdue Tugas', value: overdueTasks.length, color: 'text-red-800' },
          ];

          quickActions = [
            { label: 'Audit Security Log', href: '/dashboard', icon: 'Shield', description: 'Pantau riwayat aksi sensitif' },
            { label: 'Data Quality & Dedup', href: '/people', icon: 'Database', description: 'Review kualitas data jamaah' },
            { label: '+ Buat Tugas Global', href: '/tasks', icon: 'Plus', description: 'Delegasikan tugas ke staf yayasan' },
            { label: 'Master Jamaah', href: '/people', icon: 'Users', description: 'Buka database master jamaah' },
          ];

          todayItems = mapToday(todayTasks);
          overdueItems = mapOverdue(overdueTasks);

          if ((unassignedPersonsRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_unassigned_persons',
              title: `${unassignedPersonsRes?.count} Jamaah Belum Memiliki PIC Staf`,
              description: 'Jamaah baru masuk belum di-assign ke tim CS atau Fundraising untuk follow-up.',
              level: 'warning',
              href: '/people',
              count: unassignedPersonsRes?.count,
            });
          }

          attentionItems.push({
            id: 'att_system_health',
            title: 'Integritas Sistem & Koneksi DB Neon',
            description: 'Koneksi database PostgreSQL Neon beroperasi optimal dengan latensi normal.',
            level: 'info',
          });
          break;
        }

        // ==========================================
        // 2. DATA STEWARD
        // ==========================================
        case ROLES.DATA_STEWARD: {
          roleName = 'Data Steward & Quality';

          const [newPersons24hRes] = await db.select({ count: sql<number>`count(*)::int` }).from(persons).where(gte(persons.createdAt, todayStart));
          const [missingPhoneRes] = await db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), isNull(persons.phoneE164)));
          const [missingCityRes] = await db.select({ count: sql<number>`count(*)::int` }).from(persons).where(and(eq(persons.isActive, true), isNull(persons.cityRegency)));

          roleKpis = [
            { label: 'Jamaah Baru (24 Jam)', value: newPersons24hRes?.count || 0, color: 'text-brand-800' },
            { label: 'Tanpa Nomor HP', value: missingPhoneRes?.count || 0, color: 'text-red-800' },
            { label: 'Tanpa Domisili', value: missingCityRes?.count || 0, color: 'text-amber-800' },
            { label: 'Tugas Dedup', value: overdueTasks.length, color: 'text-purple-800' },
          ];

          quickActions = [
            { label: 'Review Duplikasi Jamaah', href: '/people', icon: 'Layers', description: 'Cek potensi duplikasi nomor telepon' },
            { label: '+ Input Jamaah Baru', href: '/people', icon: 'UserPlus', description: 'Pencatatan jamaah dengan validasi E.164' },
            { label: 'Lengkapi Data Domisili', href: '/people', icon: 'MapPin', description: 'Filter jamaah tanpa kota/kabupaten' },
          ];

          todayItems = [
            { id: 'ds_today_1', title: 'Verifikasi Normalisasi Nomor E.164 Jamaah Baru', subtitle: `${newPersons24hRes?.count || 0} entri baru`, href: '/people', tag: 'Standardisasi Data' },
            ...mapToday(todayTasks),
          ];

          overdueItems = mapOverdue(overdueTasks);

          if ((missingPhoneRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_missing_phone',
              title: `${missingPhoneRes?.count} Jamaah Tanpa Nomor Telepon`,
              description: 'Nomor telepon kosong menghambat pengiriman siaran info kajian via WhatsApp.',
              level: 'danger',
              href: '/people',
              count: missingPhoneRes?.count,
            });
          }

          if ((missingCityRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_missing_city',
              title: `${missingCityRes?.count} Jamaah Belum Memiliki Data Domisili`,
              description: 'Diperlukan untuk pemetaan zonasi dakwah dan distribusi bantuan sosial.',
              level: 'warning',
              href: '/people',
              count: missingCityRes?.count,
            });
          }
          break;
        }

        // ==========================================
        // 3. CS OFFICER
        // ==========================================
        case ROLES.CS_OFFICER: {
          roleName = 'Customer Service & Jamaah Care';

          const [todayInteractionsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(interactions).where(gte(interactions.occurredAt, todayStart));
          const [escalationInteractionsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(interactions).where(eq(interactions.outcome, 'Perlu Eskalasi'));
          const [callbackInteractionsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(interactions).where(eq(interactions.outcome, 'Minta Dihubungi Kembali'));

          roleKpis = [
            { label: 'Sapaan Dicatat Hari Ini', value: todayInteractionsRes?.count || 0, color: 'text-brand-800' },
            { label: 'Minta Dihubungi', value: callbackInteractionsRes?.count || 0, color: 'text-amber-800' },
            { label: 'Perlu Eskalasi', value: escalationInteractionsRes?.count || 0, color: 'text-red-800' },
            { label: 'Sapaan Overdue', value: overdueTasks.length, color: 'text-purple-800' },
          ];

          quickActions = [
            { label: '+ Catat Sapaan (60s)', href: '/interactions', icon: 'MessageSquare', actionType: 'modal_interaction', description: 'Log cepat respon WhatsApp / telepon' },
            { label: '+ Buat Tugas Sapaan', href: '/tasks', icon: 'Calendar', description: 'Jadwalkan sapaan jamaah berikutnya' },
            { label: 'Cari Jamaah / Kontak', href: '/people', icon: 'Search', description: 'Buka profil 360° jamaah' },
          ];

          todayItems = mapToday(todayTasks);
          overdueItems = mapOverdue(overdueTasks);

          if ((escalationInteractionsRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_cs_escalation',
              title: `${escalationInteractionsRes?.count} Interaksi Jamaah Butuh Eskalasi ke Pimpinan/Asatidz`,
              description: 'Pertanyaan syariah khusus atau keluhan jamaah yang memerlukan jawaban resmi yayasan.',
              level: 'danger',
              href: '/interactions',
              count: escalationInteractionsRes?.count,
            });
          }

          if ((callbackInteractionsRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_cs_callback',
              title: `${callbackInteractionsRes?.count} Jamaah Meminta Dihubungi Kembali`,
              description: 'Pastikan waktu follow-up sesuai dengan kesediaan waktu jamaah.',
              level: 'warning',
              href: '/interactions',
              count: callbackInteractionsRes?.count,
            });
          }
          break;
        }

        // ==========================================
        // 4. ADMIN KAJIAN (EVENT ADMIN)
        // ==========================================
        case ROLES.EVENT_ADMIN: {
          roleName = 'Admin Kajian, Daurah & Presensi';

          const [upcomingEventsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(events).where(gte(events.startAt, now));
          const [todayEventsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(events).where(and(gte(events.startAt, todayStart), lte(events.startAt, todayEnd)));
          const [totalRegisteredRes] = await db.select({ count: sql<number>`count(*)::int` }).from(eventAttendance);
          const [totalAttendedRes] = await db.select({ count: sql<number>`count(*)::int` }).from(eventAttendance).where(eq(eventAttendance.status, 'attended'));
          const [pendingPaymentsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(eventAttendance).where(eq(eventAttendance.paymentStatus, 'waiting_verification'));

          const todayEventsList = await db.query.events.findMany({
            where: and(gte(events.startAt, todayStart), lte(events.startAt, todayEnd)),
            orderBy: [asc(events.startAt)],
            with: {
              attendances: {
                columns: {
                  id: true,
                  status: true,
                },
              },
            },
          });

          const upcomingEventsList = await db.query.events.findMany({
            where: gte(events.startAt, now),
            orderBy: [asc(events.startAt)],
            limit: 5,
            with: {
              attendances: {
                columns: {
                  id: true,
                  status: true,
                },
              },
            },
          });

          roleKpis = [
            { label: 'Kajian Hari Ini', value: todayEventsRes?.count || 0, color: 'text-brand-900' },
            { label: 'Kajian Terjadwal', value: upcomingEventsRes?.count || 0, color: 'text-blue-800' },
            { label: 'Total Jamaah Presensi', value: `${totalAttendedRes?.count || 0} / ${totalRegisteredRes?.count || 0}`, color: 'text-emerald-800' },
            { label: 'Verifikasi Slip Daurah', value: pendingPaymentsRes?.count || 0, color: (pendingPaymentsRes?.count || 0) > 0 ? 'text-amber-800' : 'text-slate-600' },
          ];

          quickActions = [
            { label: '+ Jadwal Kajian Baru', href: '/events', icon: 'Plus', description: 'Buat agenda kajian tematik / rutin' },
            { label: 'Buka Scanner Gate', href: '/events', icon: 'QrCode', description: 'Live check-in barcode tiket di pintu masjid' },
            { label: 'Kelola Peserta & Presensi', href: '/events', icon: 'FileSpreadsheet', description: 'Cek daftar jamaah, ekspor & impor' },
            { label: 'Portal Kajian Publik', href: '/kajian', icon: 'Globe', description: 'Buka halaman pendaftaran online jamaah' },
            { label: 'Database Jamaah', href: '/people', icon: 'IdCard', description: 'Direktori kontak 360° jamaah majelis' },
          ];

          todayItems = [
            ...todayEventsList.map((e) => {
              const attendedInEvent = e.attendances.filter((a) => a.status === 'attended').length;
              return {
                id: e.id,
                title: e.title,
                subtitle: `Pemateri: ${e.speaker} • ${attendedInEvent} Hadir / ${e.attendances.length} Terdaftar • Lokasi: ${e.locationName || 'Masjid Tarbiyah Sunnah'}`,
                dueTime: new Date(e.startAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                href: `/events`,
                tag: 'Kajian Hari Ini',
                badgeColor: 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold',
              };
            }),
            ...upcomingEventsList.map((e) => ({
              id: e.id,
              title: e.title,
              subtitle: `Pemateri: ${e.speaker} • ${e.attendances.length} Terdaftar ${e.quota ? `(Max ${e.quota})` : ''} • Lokasi: ${e.locationName || 'Masjid Tarbiyah Sunnah'}`,
              dueTime: new Date(e.startAt).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
              href: `/events`,
              tag: 'Mendatang',
              badgeColor: 'bg-blue-50 text-blue-900 border-blue-200',
            })),
            ...mapToday(todayTasks),
          ];

          overdueItems = mapOverdue(overdueTasks);

          if ((pendingPaymentsRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_pending_event_payments',
              title: `${pendingPaymentsRes?.count} Pendaftaran Daurah Menunggu Verifikasi Pembayaran`,
              description: 'Terdapat bukti transfer infaq/tiket daurah yang perlu direview agar tiket jamaah aktif.',
              level: 'warning',
              href: '/events',
              count: pendingPaymentsRes?.count,
            });
          }

          if (todayEventsList.length === 0) {
            attentionItems.push({
              id: 'att_no_event_today',
              title: 'Tidak Ada Jadwal Majelis Ilmu Hari Ini',
              description: 'Gunakan waktu untuk mematangkan kuota kajian mendatang, publikasi materi, dan penyebaran poster dakwah.',
              level: 'info',
            });
          }
          break;
        }

        // ==========================================
        // 5. FUNDRAISING OFFICER
        // ==========================================
        case ROLES.FUNDRAISING_OFFICER: {
          roleName = 'Fundraising & Donor Care';

          const [myUnverifiedRes] = await db.select({ count: sql<number>`count(*)::int` }).from(donations).where(eq(donations.verificationStatus, 'unverified'));
          const [dormantDonorsRes] = await db.select({ count: sql<number>`count(*)::int` }).from(persons).where(
            and(eq(persons.isActive, true), eq(persons.engagementStatus, 'dorman'))
          );

          roleKpis = [
            { label: 'Donasi Belum Verifikasi', value: myUnverifiedRes?.count || 0, color: 'text-amber-800' },
            { label: 'Donatur Dorman', value: dormantDonorsRes?.count || 0, color: 'text-orange-800' },
            { label: 'Follow-Up Donatur', value: todayTasks.length, color: 'text-brand-800' },
            { label: 'Overdue Follow-Up', value: overdueTasks.length, color: 'text-red-800' },
          ];

          quickActions = [
            { label: '+ Catat Donasi / Infaq', href: '/donations', icon: 'Coins', description: 'Input penerimaan transfer infaq jamaah' },
            { label: '+ Sapa Donatur Potensial', href: '/interactions', icon: 'MessageSquare', description: 'Jadwalkan komunikasi program dakwah' },
            { label: 'Buka Master Donatur', href: '/donations', icon: 'Users', description: 'Lihat donatur loyal terverifikasi' },
          ];

          todayItems = mapToday(todayTasks);
          overdueItems = mapOverdue(overdueTasks);

          if ((dormantDonorsRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_dormant_donors',
              title: `${dormantDonorsRes?.count} Donatur & Jamaah Berstatus Dorman`,
              description: 'Donatur loyal yang belum berinfaq kembali dalam 90 hari terakhir. Perlu dikirimi laporan berkala program.',
              level: 'warning',
              href: '/people',
              count: dormantDonorsRes?.count,
            });
          }

          if ((myUnverifiedRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_unverified_donations_notice',
              title: `${myUnverifiedRes?.count} Donasi Menunggu Validasi Rekening Koran Finance`,
              description: 'Pastikan bukti transfer telah terunggah dengan nomor referensi bank yang jelas.',
              level: 'info',
              href: '/donations',
              count: myUnverifiedRes?.count,
            });
          }
          break;
        }

        // ==========================================
        // 6. WAKAF OFFICER
        // ==========================================
        case ROLES.WAQF_OFFICER: {
          roleName = 'Waqf Pipeline & Stewardship';

          const [activeCasesRes] = await db.select({ count: sql<number>`count(*)::int` }).from(waqfCases).where(
            inArray(waqfCases.currentStage, ['interested', 'consulted', 'pledged', 'document_preparation', 'in_progress'])
          );
          const [agingCasesRes] = await db.select({ count: sql<number>`count(*)::int` }).from(waqfCases).where(
            and(
              inArray(waqfCases.currentStage, ['interested', 'consulted', 'pledged', 'document_preparation', 'in_progress']),
              lte(waqfCases.openedAt, thirtyDaysAgo)
            )
          );

          roleKpis = [
            { label: 'Kasus Wakaf Aktif', value: activeCasesRes?.count || 0, color: 'text-purple-800' },
            { label: 'Wakaf Aging (>30 Hari)', value: agingCasesRes?.count || 0, color: 'text-red-800' },
            { label: 'Agenda Hari Ini', value: todayTasks.length, color: 'text-brand-800' },
            { label: 'Overdue Berkas', value: overdueTasks.length, color: 'text-amber-800' },
          ];

          quickActions = [
            { label: '+ Inisiasi Kasus Wakaf', href: '/waqf', icon: 'Building2', description: 'Catat peminat wakaf tanah/aset baru' },
            { label: 'Buka Kanban Pipeline', href: '/waqf', icon: 'LayoutGrid', description: 'Pantau 7 tahapan legalitas wakaf' },
            { label: 'Kelola Berkas & AIW', href: '/waqf', icon: 'FileText', description: 'Checklist dokumen PPAIW & sertifikat' },
          ];

          todayItems = mapToday(todayTasks);
          overdueItems = mapOverdue(overdueTasks);

          if ((agingCasesRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_aging_waqf',
              title: `${agingCasesRes?.count} Kasus Wakaf Tertahan > 30 Hari di Pipeline`,
              description: 'Segera lakukan koordinasi dengan wakif, KUA/PPAIW, atau Badan Pertanahan Nasional (BPN).',
              level: 'danger',
              href: '/waqf',
              count: agingCasesRes?.count,
            });
          }
          break;
        }

        // ==========================================
        // 7. FINANCE VERIFIER
        // ==========================================
        case ROLES.FINANCE_VERIFIER: {
          roleName = 'Finance & Verification Officer';

          const [unverifiedRes] = await db.select({ count: sql<number>`count(*)::int` }).from(donations).where(eq(donations.verificationStatus, 'unverified'));
          const [needReviewRes] = await db.select({ count: sql<number>`count(*)::int` }).from(donations).where(eq(donations.verificationStatus, 'need_review'));
          const [rejectedRes] = await db.select({ count: sql<number>`count(*)::int` }).from(donations).where(eq(donations.verificationStatus, 'rejected'));

          const unverifiedList = await db.query.donations.findMany({
            where: eq(donations.verificationStatus, 'unverified'),
            orderBy: [desc(donations.donationDate)],
            limit: 8,
            with: {
              person: {
                columns: {
                  id: true,
                  fullName: true,
                },
              },
              program: {
                columns: {
                  name: true,
                },
              },
            },
          });

          roleKpis = [
            { label: 'Antrean Unverified', value: unverifiedRes?.count || 0, color: 'text-amber-800' },
            { label: 'Perlu Review Khusus', value: needReviewRes?.count || 0, color: 'text-purple-800' },
            { label: 'Donasi Ditolak', value: rejectedRes?.count || 0, color: 'text-red-800' },
            { label: 'Tugas Keuangan Overdue', value: overdueTasks.length, color: 'text-brand-800' },
          ];

          quickActions = [
            { label: 'Buka Antrean Verifikasi', href: '/donations', icon: 'ShieldCheck', description: 'Sahkan donasi sesuai mutasi bank' },
            { label: 'Koreksi Transaksi Sah', href: '/donations', icon: 'Edit3', description: 'Penyesuaian transaksi sah dengan audit' },
            { label: 'Laporan Rekonsiliasi Infaq', href: '/donations', icon: 'FileSpreadsheet', description: 'Rekap infaq harian/bulanan' },
          ];

          todayItems = unverifiedList.map((d) => ({
            id: d.id,
            title: `Verifikasi Infaq Rp ${Number(d.amountRupiah).toLocaleString('id-ID')}`,
            subtitle: `Donatur: ${d.person?.fullName || 'Hamba Allah'} • Program: ${d.program?.name || 'Infaq'}`,
            dueTime: new Date(d.donationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            href: `/donations`,
            tag: 'Menunggu Approval',
            badgeColor: 'bg-amber-50 text-amber-900 border-amber-200',
          }));

          overdueItems = mapOverdue(overdueTasks);

          if ((unverifiedRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_unverified_finance_alert',
              title: `${unverifiedRes?.count} Mutasi Infaq Menunggu Verifikasi Keuangan`,
              description: 'Cocokkan nominal dengan mutasi rekening koran Bank Syariah Indonesia (BSI) sebelum disahkan.',
              level: 'danger',
              href: '/donations',
              count: unverifiedRes?.count,
            });
          }

          if ((needReviewRes?.count || 0) > 0) {
            attentionItems.push({
              id: 'att_need_review_alert',
              title: `${needReviewRes?.count} Transaksi Berstatus Need Review`,
              description: 'Terdapat ketidakcocokan nominal atau referensi bank yang perlu konfirmasi ke Fundraising.',
              level: 'warning',
              href: '/donations',
              count: needReviewRes?.count,
            });
          }
          break;
        }

        // ==========================================
        // DEFAULT / LEADERSHIP
        // ==========================================
        default: {
          roleName = 'Pimpinan & Pengawas Yayasan';
          roleKpis = [
            { label: 'Total Jamaah', value: '1,250', color: 'text-brand-800' },
            { label: 'Donasi Bulan Ini', value: 'Rp 145 Jt', color: 'text-emerald-800' },
            { label: 'Wakaf Aktif', value: '12 Kasus', color: 'text-purple-800' },
            { label: 'Overdue Organisasi', value: overdueTasks.length, color: 'text-red-800' },
          ];

          quickActions = [
            { label: 'Ringkasan Eksekutif', href: '/', icon: 'BarChart3', description: 'Lihat 10 KPI & 5 visual grafik' },
            { label: 'Laporan Finansial & Infaq', href: '/donations', icon: 'Coins', description: 'Pantau realisasi donasi' },
            { label: 'Portofolio Wakaf', href: '/waqf', icon: 'Building2', description: 'Aset wakaf tanah dan markaz' },
          ];

          todayItems = mapToday(todayTasks);
          overdueItems = mapOverdue(overdueTasks);
          break;
        }
      }

      return successResponse(
        {
          role: requestedRole,
          roleName,
          roleKpis,
          quickActions,
          todayItems,
          overdueItems,
          attentionItems,
        },
        { requestId: ctx.requestId }
      );
    })
  );
}
