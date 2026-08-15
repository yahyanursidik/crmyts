import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, RoleCode } from '../../permissions/constants';
import * as schema from '../schema';
import { eq } from 'drizzle-orm';

export interface SeedData {
  roles: Array<{ code: string; name: string; description: string; isSystem: boolean }>;
  permissions: Array<{ code: string; resource: string; action: string; description: string }>;
  rolePermissions: Array<{ roleCode: string; permissionCode: string }>;
  donationPrograms: Array<{ code: string; name: string; isActive: boolean }>;
  tags: Array<{ name: string; category: string; isActive: boolean }>;
  users: Array<{ email: string; fullName: string; authSubject: string; role: RoleCode }>;
}

export function generateSeedData(): SeedData {
  const rolesList = [
    { code: ROLES.LEADERSHIP_VIEWER, name: 'Pimpinan / Leadership Viewer', description: 'Akses ringkasan eksekutif dan laporan', isSystem: true },
    { code: ROLES.CRM_ADMIN, name: 'CRM Administrator', description: 'Akses penuh administrasi CRM dan tata kelola user', isSystem: true },
    { code: ROLES.DATA_STEWARD, name: 'Data Steward', description: 'Tata kelola kualitas data dan pencegahan duplikasi', isSystem: true },
    { code: ROLES.CS_OFFICER, name: 'Customer Service / Follow-up', description: 'Pencatatan interaksi dan eksekusi task tindak lanjut', isSystem: true },
    { code: ROLES.EVENT_ADMIN, name: 'Admin Kajian', description: 'Pengelolaan jadwal kajian dan presensi kehadiran jamaah', isSystem: true },
    { code: ROLES.FUNDRAISING_OFFICER, name: 'Fundraising Officer', description: 'Pengelolaan relasi donatur dan pencatatan donasi masuk', isSystem: true },
    { code: ROLES.WAQF_OFFICER, name: 'Wakaf Officer', description: 'Pengelolaan kasus wakaf dan pipeline tahapan', isSystem: true },
    { code: ROLES.FINANCE_VERIFIER, name: 'Finance / Verifikator', description: 'Verifikasi mutasi finansial dan rekonsiliasi', isSystem: true },
    { code: ROLES.BROADCAST_OFFICER, name: 'Broadcast Officer', description: 'Penyusunan segmentasi dan draf broadcast pesan', isSystem: true },
    { code: ROLES.AUDITOR, name: 'Auditor Lembaga', description: 'Pemeriksaan kepatuhan log dan histori mutasi', isSystem: true },
  ];

  const permissionsList = Object.entries(PERMISSIONS).map(([_, code]) => {
    const [resource, action] = code.split('.');
    return {
      code,
      resource: resource || 'general',
      action: action || 'view',
      description: `Izin untuk tindakan ${action} pada modul ${resource}`,
    };
  });

  const rolePermissionsList: Array<{ roleCode: string; permissionCode: string }> = [];
  Object.entries(ROLE_PERMISSIONS).forEach(([roleCode, perms]) => {
    perms.forEach((permCode) => {
      rolePermissionsList.push({
        roleCode,
        permissionCode: permCode,
      });
    });
  });

  const donationProgramsList = [
    { code: 'DAKWAH_KAJIAN', name: 'Operasional Dakwah & Kajian Rutin', isActive: true },
    { code: 'WAKAF_MASJID', name: 'Wakaf Pembangunan Masjid & Sarana Dakwah', isActive: true },
    { code: 'SANTUNAN_SOSIAL', name: 'Santunan Yatim & Dhuafa YTS', isActive: true },
    { code: 'OPERASIONAL_YAYASAN', name: 'Infaq Operasional Yayasan Tarbiyah Sunnah', isActive: true },
  ];

  const tagsList = [
    { name: 'Jamaah Rutin', category: 'Engagement', isActive: true },
    { name: 'Jamaah Baru', category: 'Engagement', isActive: true },
    { name: 'Donatur Tetap', category: 'Donatur', isActive: true },
    { name: 'Calon Waqif', category: 'Wakaf', isActive: true },
    { name: 'Prioritas Sapaan', category: 'Follow-Up', isActive: true },
  ];

  const usersList: SeedData['users'] = [
    { email: 'admin@tarbiyahsunnah.id', fullName: 'Ustadz Admin YTS', authSubject: 'usr_admin_yts', role: ROLES.CRM_ADMIN },
    { email: 'finance@tarbiyahsunnah.id', fullName: 'Ustadz Ahmad (Finance)', authSubject: 'usr_finance_yts', role: ROLES.FINANCE_VERIFIER },
    { email: 'cs@tarbiyahsunnah.id', fullName: 'Fulan (CS Officer)', authSubject: 'usr_cs_yts', role: ROLES.CS_OFFICER },
    { email: 'kajian@tarbiyahsunnah.id', fullName: 'Abu Fulan (Admin Kajian)', authSubject: 'usr_kajian_yts', role: ROLES.EVENT_ADMIN },
    { email: 'fundraising@tarbiyahsunnah.id', fullName: 'Muhammad (Fundraising)', authSubject: 'usr_fundraising_yts', role: ROLES.FUNDRAISING_OFFICER },
    { email: 'waqf@tarbiyahsunnah.id', fullName: 'Abdullah (Wakaf Officer)', authSubject: 'usr_waqf_yts', role: ROLES.WAQF_OFFICER },
    { email: 'pimpinan@tarbiyahsunnah.id', fullName: 'Dewan Pembina YTS', authSubject: 'usr_pimpinan_yts', role: ROLES.LEADERSHIP_VIEWER },
  ];

  return {
    roles: rolesList,
    permissions: permissionsList,
    rolePermissions: rolePermissionsList,
    donationPrograms: donationProgramsList,
    tags: tagsList,
    users: usersList,
  };
}

export async function runInitialSeed(db: any) {
  const seed = generateSeedData();

  console.log('🌱 1. Seeding roles...');
  for (const role of seed.roles) {
    await db.insert(schema.roles).values(role).onConflictDoNothing();
  }

  console.log('🌱 2. Seeding permissions...');
  for (const perm of seed.permissions) {
    await db.insert(schema.permissions).values(perm).onConflictDoNothing();
  }

  console.log('🌱 3. Linking role permissions...');
  for (const rp of seed.rolePermissions) {
    const roleRecord = await db.query.roles.findFirst({ where: eq(schema.roles.code, rp.roleCode) });
    const permRecord = await db.query.permissions.findFirst({ where: eq(schema.permissions.code, rp.permissionCode) });
    if (roleRecord && permRecord) {
      await db.insert(schema.rolePermissions).values({
        roleId: roleRecord.id,
        permissionId: permRecord.id,
      }).onConflictDoNothing();
    }
  }

  console.log('🌱 4. Seeding donation programs...');
  for (const prog of seed.donationPrograms) {
    await db.insert(schema.donationPrograms).values(prog).onConflictDoNothing();
  }

  console.log('🌱 5. Seeding tags...');
  for (const tag of seed.tags) {
    await db.insert(schema.tags).values(tag).onConflictDoNothing();
  }

  console.log('🌱 6. Seeding internal users & assigning roles...');
  for (const u of seed.users) {
    let userRecord = await db.query.appUsers.findFirst({ where: eq(schema.appUsers.email, u.email) });
    if (!userRecord) {
      const [inserted] = await db.insert(schema.appUsers).values({
        email: u.email,
        fullName: u.fullName,
        authSubject: u.authSubject,
        isActive: true,
      }).returning();
      userRecord = inserted;
    }

    if (userRecord) {
      const roleRecord = await db.query.roles.findFirst({ where: eq(schema.roles.code, u.role) });
      if (roleRecord) {
        await db.insert(schema.userRoles).values({
          userId: userRecord.id,
          roleId: roleRecord.id,
        }).onConflictDoNothing();
      }
    }
  }

  // Seeding Sample Operational Data
  const adminUser = await db.query.appUsers.findFirst({ where: eq(schema.appUsers.email, 'admin@tarbiyahsunnah.id') });
  const csUser = await db.query.appUsers.findFirst({ where: eq(schema.appUsers.email, 'cs@tarbiyahsunnah.id') });
  const dakwahProgram = await db.query.donationPrograms.findFirst({ where: eq(schema.donationPrograms.code, 'DAKWAH_KAJIAN') });
  const wakafProgram = await db.query.donationPrograms.findFirst({ where: eq(schema.donationPrograms.code, 'WAKAF_MASJID') });

  if (adminUser && csUser && dakwahProgram && wakafProgram) {
    console.log('🌱 7. Seeding sample jamaah & donatur...');
    const samplePersons = [
      {
        fullName: 'H. Bambang Sulistyo',
        phoneE164: '+6281234567890',
        email: 'bambang.s@gmail.com',
        gender: 'ikhwan' as const,
        cityRegency: 'Bandung',
        province: 'Jawa Barat',
        engagementStatus: 'rutin' as const,
        preferredChannel: 'whatsapp' as const,
        ownerUserId: csUser.id,
      },
      {
        fullName: 'dr. Hendra Kurniawan, Sp.A',
        phoneE164: '+6281298765432',
        email: 'hendra.k@yahoo.com',
        gender: 'ikhwan' as const,
        cityRegency: 'Bandung',
        province: 'Jawa Barat',
        engagementStatus: 'aktif' as const,
        preferredChannel: 'whatsapp' as const,
        ownerUserId: csUser.id,
      },
      {
        fullName: 'Ibu Ratna Dewi',
        phoneE164: '+6281311223344',
        email: 'ratna.dewi@gmail.com',
        gender: 'akhwat' as const,
        cityRegency: 'Cimahi',
        province: 'Jawa Barat',
        engagementStatus: 'baru' as const,
        preferredChannel: 'whatsapp' as const,
        ownerUserId: csUser.id,
      },
      {
        fullName: 'Ir. Agus Pratama',
        phoneE164: '+6281809988776',
        email: 'agus.pratama@outlook.com',
        gender: 'ikhwan' as const,
        cityRegency: 'Bandung Barat',
        province: 'Jawa Barat',
        engagementStatus: 'dorman' as const,
        preferredChannel: 'whatsapp' as const,
        ownerUserId: csUser.id,
      },
    ];

    const createdPersons = [];
    for (const p of samplePersons) {
      let existing = await db.query.persons.findFirst({ where: eq(schema.persons.phoneE164, p.phoneE164) });
      if (!existing) {
        const [inserted] = await db.insert(schema.persons).values(p).returning();
        existing = inserted;
      }
      if (existing) createdPersons.push(existing);
    }

    console.log('🌱 8. Seeding sample kajian/events...');
    const sampleEvents = [
      {
        title: 'Kajian Akbar Kitab Tauhid Bab 1-3',
        category: 'Aqidah',
        speaker: 'Ustadz Abu Yahya Badrusalam, Lc.',
        startAt: new Date(Date.now() - 86400000 * 3),
        endAt: new Date(Date.now() - 86400000 * 3 + 7200000),
        deliveryMode: 'hybrid' as const,
        locationName: 'Masjid Tarbiyah Sunnah Bandung',
        status: 'completed' as const,
        createdBy: adminUser.id,
      },
      {
        title: 'Tafsir Surat Al-Kahfi & Adab Penuntut Ilmu',
        category: 'Tafsir',
        speaker: 'Ustadz Maududi Abdullah, Lc.',
        startAt: new Date(Date.now() + 86400000 * 2),
        endAt: new Date(Date.now() + 86400000 * 2 + 7200000),
        deliveryMode: 'offline' as const,
        locationName: 'Masjid Tarbiyah Sunnah Bandung',
        status: 'scheduled' as const,
        createdBy: adminUser.id,
      },
      {
        title: 'Fiqih Wakaf & Harta Waris dalam Islam',
        category: 'Fiqih Muamalah',
        speaker: 'Ustadz Dr. Erwandi Tarmizi, M.A.',
        startAt: new Date(Date.now() + 86400000 * 7),
        deliveryMode: 'offline' as const,
        locationName: 'Auditorium Markaz YTS',
        status: 'scheduled' as const,
        createdBy: adminUser.id,
      },
    ];

    for (const ev of sampleEvents) {
      const existing = await db.query.events.findFirst({ where: eq(schema.events.title, ev.title) });
      if (!existing) {
        await db.insert(schema.events).values(ev);
      }
    }

    console.log('🌱 9. Seeding sample follow-up tasks & interactions...');
    if (createdPersons[0]) {
      await db.insert(schema.tasks).values([
        {
          personId: createdPersons[0].id,
          title: 'Sapaan & konfirmasi kehadiran Kajian Akbar Tafsir',
          description: 'Follow-up via WhatsApp untuk jamaah rutin',
          status: 'pending',
          priority: 'high',
          dueAt: new Date(Date.now() + 86400000),
          ownerUserId: csUser.id,
          assignedBy: adminUser.id,
        },
        {
          personId: createdPersons[3]?.id || createdPersons[0].id,
          title: 'Sapaan Jamaah Dorman (Tidak hadir >30 hari)',
          description: 'Kirimkan rekaman kajian terbaru dan tanyakan kabar',
          status: 'pending',
          priority: 'urgent',
          dueAt: new Date(Date.now() - 86400000), // Overdue task alert demonstration
          ownerUserId: csUser.id,
          assignedBy: adminUser.id,
        },
      ]);

      await db.insert(schema.interactions).values([
        {
          personId: createdPersons[0].id,
          channel: 'whatsapp',
          summary: 'Jamaah menanyakan jadwal kajian fiqih muamalah ustadz Erwandi Tarmizi',
          outcome: 'Sudah diinfokan jadwal Sabtu pekan depan dan link pendaftaran',
          sensitivityLevel: 'standard',
          ownerUserId: csUser.id,
          createdBy: csUser.id,
        },
      ]);
    }

    console.log('🌱 10. Seeding sample donations & waqf pipeline...');
    if (createdPersons[0] && createdPersons[1]) {
      await db.insert(schema.donations).values([
        {
          personId: createdPersons[0].id,
          programId: dakwahProgram.id,
          donationDate: new Date(Date.now() - 86400000),
          amountRupiah: BigInt(5000000), // Rp 5.000.000
          paymentMethod: 'bank_transfer',
          externalReference: 'BSI-TRX-98213812',
          verificationStatus: 'verified',
          verifiedBy: adminUser.id,
          verifiedAt: new Date(),
          createdBy: csUser.id,
        },
        {
          personId: createdPersons[1].id,
          programId: wakafProgram.id,
          donationDate: new Date(),
          amountRupiah: BigInt(25000000), // Rp 25.000.000
          paymentMethod: 'bank_transfer',
          externalReference: 'BCA-TRX-10293847',
          verificationStatus: 'unverified', // Unverified queue for Finance review
          createdBy: csUser.id,
        },
      ]);

      await db.insert(schema.waqfCases).values([
        {
          personId: createdPersons[0].id,
          waqfType: 'tanah',
          estimatedValueRupiah: BigInt(500000000), // Rp 500.000.000
          currentStage: 'document_preparation',
          ownerUserId: csUser.id,
          notesSummary: 'Wakaf sebidang tanah seluas 250m2 di Lembang untuk asrama santri tahfizh YTS',
          createdBy: adminUser.id,
        },
        {
          personId: createdPersons[1].id,
          waqfType: 'bangunan',
          estimatedValueRupiah: BigInt(350000000),
          currentStage: 'pledged',
          ownerUserId: csUser.id,
          notesSummary: 'Ikrar wakaf ruko 2 lantai untuk unit usaha dakwah yayasan',
          createdBy: adminUser.id,
        },
      ]);
    }
  }

  console.log('✅ Initial seed completed with rich operational demo data!');
}
