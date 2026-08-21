import React, { useState, useEffect } from 'react';
import {
  IdCard,
  Shield,
  Building2,
  Tags,
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Plus,
  Landmark,
  Database,
  Cloud,
  Check,
  Palette,
  RotateCcw,
  Download,
  Trash2,
  Edit3,
  X,
  Activity,
  Zap,
  Mail,
  Send,
  Inbox,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { useTheme, THEME_PRESETS, ThemeId } from '@/lib/themeContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ code: string; name: string }>;
}

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
}

interface FoundationInfo {
  foundationName: string;
  skKemenkumham: string;
  headOfficeAddress: string;
  officialPhone: string;
  officialEmail: string;
  officialWebsite: string;
  bankAccounts: BankAccount[];
}

interface ProgramItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface TagItem {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

const AVAILABLE_ROLES = [
  { code: 'cs_officer', name: 'CS Jamaah Care', desc: 'Sapaan jamaah, followup interaksi & tiket daurah' },
  { code: 'event_admin', name: 'Admin Kajian & Acara', desc: 'Kelola jadwal kajian, kuota, form builder & presensi' },
  { code: 'data_steward', name: 'Data Steward', desc: 'Master jamaah, deduplikasi kontak & pembersihan data' },
  { code: 'fundraising_officer', name: 'Fundraising Officer', desc: 'Pencatatan infaq, permohonan konsultasi & pipeline donatur' },
  { code: 'waqf_officer', name: 'Wakaf Officer', desc: 'Kelola sertifikat wakaf & konsultasi wakaf tanah/bangunan' },
  { code: 'finance_verifier', name: 'Finance Verifier', desc: 'Verifikasi mutasi rekening donasi & rekonsiliasi bank' },
  { code: 'crm_admin', name: 'CRM Super Admin', desc: 'Akses penuh manajemen pengguna, sistem & audit security' },
  { code: 'leadership_viewer', name: 'Pimpinan (Viewer)', desc: 'Hak pantau eksekutif, laporan analitik & dashboard yayasan' },
];

const TAG_CATEGORIES = [
  { value: 'minat_kajian', label: 'Minat Kajian (Akidah, Fikih, dll.)' },
  { value: 'profesi', label: 'Profesi / Pekerjaan (Dokter, Guru, dll.)' },
  { value: 'keahlian', label: 'Keahlian / Skill (Desain, IT, Medis, dll.)' },
  { value: 'segmentasi', label: 'Segmentasi (Donatur Rutin, Relawan, dll.)' },
  { value: 'wilayah', label: 'Domisili / Wilayah Komunitas' },
  { value: 'lainnya', label: 'Lain-lain / Kustom' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'foundation' | 'taxonomy' | 'email' | 'system' | 'theme'>('profile');
  const { themeId, setThemeId, resetToDefault, currentTheme } = useTheme();

  // Toast & Confirm Dialog State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    singleButton?: boolean;
    loading?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Profile State
  const [profile, setProfile] = useState<any>(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['cs_officer']);
  
  // Edit Roles Modal State
  const [selectedUserForRoleEdit, setSelectedUserForRoleEdit] = useState<UserItem | null>(null);
  const [editRolesList, setEditRolesList] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Foundation State
  const [foundation, setFoundation] = useState<FoundationInfo | null>(null);
  const [savingFoundation, setSavingFoundation] = useState(false);
  const [foundationSuccess, setFoundationSuccess] = useState(false);
  
  // Bank Account Modal State
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBankIndex, setEditingBankIndex] = useState<number | null>(null);
  const [bankForm, setBankForm] = useState<BankAccount>({
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountHolder: 'Yayasan Tarbiyah Sunnah',
    branch: 'KCP Bandung',
  });

  // Taxonomy State
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [newProgramModal, setNewProgramModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');
  
  const [newTagModal, setNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('minat_kajian');

  // System Diagnostics State
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState<{ latencyMs: number; status: string; timestamp: string } | null>(null);

  // SMTP Email Health & Testing State
  const [emailHealth, setEmailHealth] = useState<any>(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testTemplateType, setTestTemplateType] = useState<
    'handshake' | 'event_ticket' | 'donation_receipt' | 'waqf_inquiry' | 'staff_welcome'
  >('handshake');
  const [testEmailResultLog, setTestEmailResultLog] = useState<{
    success: boolean;
    messageId?: string;
    recipient?: string;
    template?: string;
    timestamp: string;
    error?: string;
  } | null>(null);
  const [showPasswordMask, setShowPasswordMask] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const fetchEmailHealth = async (showNotification = false) => {
    setEmailTesting(true);
    try {
      const res = await fetch('/api/settings/email-health');
      if (res.ok) {
        const json = await res.json();
        setEmailHealth(json.data);
        if (showNotification) {
          if (json.data.status === 'connected') {
            showToast(`✓ Koneksi SMTP Kerjamail Terhubung! Latensi: ${json.data.latencyMs} ms`);
          } else {
            showToast(json.data.errorMessage || 'Koneksi SMTP bermasalah', 'error');
          }
        }
      }
    } catch (e) {
      if (showNotification) showToast('Gagal menguji koneksi SMTP server', 'error');
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) {
      showToast('Masukkan alamat email tujuan uji coba', 'error');
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResultLog(null);
    try {
      const res = await fetch('/api/settings/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim(),
          templateType: testTemplateType,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.data.message || 'Email uji coba berhasil dikirim!');
        setTestEmailResultLog({
          success: true,
          messageId: json.data.messageId,
          recipient: testEmailRecipient.trim(),
          template: testTemplateType,
          timestamp: new Date().toLocaleTimeString('id-ID'),
        });
      } else {
        showToast(json.error?.message || 'Gagal mengirim email uji coba', 'error');
        setTestEmailResultLog({
          success: false,
          recipient: testEmailRecipient.trim(),
          template: testTemplateType,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          error: json.error?.message || 'Koneksi ke server Kerjamail gagal',
        });
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat mengirim email', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/settings/profile');
      if (res.ok) {
        const json = await res.json();
        setProfile(json.data);
        setFullNameInput(json.data.fullName || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/settings/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFoundation = async () => {
    try {
      const res = await fetch('/api/settings/foundation');
      if (res.ok) {
        const json = await res.json();
        setFoundation(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTaxonomy = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch('/api/settings/programs'),
        fetch('/api/settings/tags'),
      ]);
      if (pRes.ok) {
        const pJson = await pRes.json();
        setPrograms(pJson.data);
      }
      if (tRes.ok) {
        const tJson = await tRes.json();
        setTagsList(tJson.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const res = await fetch('/api/settings/system-health');
      if (res.ok) {
        const json = await res.json();
        setSystemHealth(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUsers();
    fetchFoundation();
    fetchTaxonomy();
    fetchSystemHealth();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullNameInput }),
      });
      if (res.ok) {
        showToast('Profil pengguna berhasil diperbarui!');
        fetchProfile();
      } else {
        const err = await res.json();
        showToast(err.error?.message || 'Gagal memperbarui profil', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordMsg({ text: 'Kata sandi berhasil diubah dengan aman!', type: 'success' });
        showToast('Kata sandi berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const err = await res.json();
        setPasswordMsg({ text: err.error?.message || 'Gagal mengubah kata sandi', type: 'error' });
      }
    } catch (err) {
      setPasswordMsg({ text: 'Terjadi gangguan jaringan', type: 'error' });
    }
  };

  // User Management Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserRoles.length === 0) {
      showToast('Pilih minimal 1 peran akses', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newUserName,
          email: newUserEmail,
          roleCodes: newUserRoles,
        }),
      });
      if (res.ok) {
        showToast(`Staf "${newUserName}" berhasil didaftarkan!`);
        setNewUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserRoles(['cs_officer']);
        fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.error?.message || 'Gagal mendaftarkan staf', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleOpenEditRoles = (user: UserItem) => {
    setSelectedUserForRoleEdit(user);
    setEditRolesList(user.roles.map((r) => r.code));
  };

  const handleSaveUserRoles = async () => {
    if (!selectedUserForRoleEdit) return;
    if (editRolesList.length === 0) {
      showToast('Pilih minimal 1 peran akses', 'warning');
      return;
    }
    try {
      setSavingRoles(true);
      const res = await fetch(`/api/settings/users/${selectedUserForRoleEdit.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCodes: editRolesList }),
      });
      if (res.ok) {
        showToast(`Peran akses untuk ${selectedUserForRoleEdit.fullName} berhasil diperbarui!`);
        setSelectedUserForRoleEdit(null);
        fetchUsers();
      } else {
        const err = await res.json();
        showToast(err.error?.message || 'Gagal memperbarui peran pengguna', 'error');
      }
    } catch (err) {
      showToast('Terjadi gangguan jaringan', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      const res = await fetch(`/api/settings/users/${userId}/status`, {
        method: 'PATCH',
      });
      if (res.ok) {
        showToast('Status keaktifan staf berhasil diubah');
        fetchUsers();
      }
    } catch (err) {
      showToast('Gagal mengubah status staf', 'error');
    }
  };

  const handleDeleteUser = (user: UserItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Akun Staf Internal?',
      message: (
        <div className="space-y-2">
          <p>
            Apakah Anda yakin ingin menghapus akun staf{' '}
            <strong className="text-surface-900 font-bold">{user.fullName}</strong> ({user.email})?
          </p>
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
            ⚠️ Tindakan ini permanen. Akses masuk ke sistem CRM untuk akun ini akan segera dicabut.
          </div>
        </div>
      ),
      confirmLabel: 'Ya, Hapus Staf',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/settings/users/${user.id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast(`Akun staf ${user.fullName} telah dihapus`);
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            fetchUsers();
          } else {
            const err = await res.json();
            showToast(err.error?.message || 'Gagal menghapus akun staf', 'error');
          }
        } catch (err) {
          showToast('Gagal menghapus akun staf', 'error');
        }
      },
    });
  };

  const handleExportUsersCsv = () => {
    if (users.length === 0) {
      showToast('Tidak ada data staf untuk diekspor', 'warning');
      return;
    }
    const headers = ['ID Staf', 'Nama Lengkap', 'Email', 'Peran Akses', 'Status Akun', 'Login Terakhir', 'Tanggal Dibuat'];
    const rows = users.map((u) => [
      `"${u.id}"`,
      `"${u.fullName}"`,
      `"${u.email}"`,
      `"${u.roles.map((r) => r.name).join(', ')}"`,
      `"${u.isActive ? 'Aktif' : 'Non-aktif'}"`,
      `"${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : '-'}"`,
      `"${new Date(u.createdAt).toLocaleString('id-ID')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daftar-staf-internal-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data staf berhasil diekspor ke CSV!');
  };

  // Foundation & Bank Accounts Handlers
  const handleSaveFoundation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundation) return;
    setSavingFoundation(true);
    try {
      const res = await fetch('/api/settings/foundation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(foundation),
      });
      if (res.ok) {
        setFoundationSuccess(true);
        showToast('Profil resmi yayasan & rekening berhasil disimpan!');
        setTimeout(() => setFoundationSuccess(false), 3000);
      } else {
        showToast('Gagal menyimpan profil yayasan', 'error');
      }
    } catch (err) {
      showToast('Terjadi gangguan koneksi', 'error');
    } finally {
      setSavingFoundation(false);
    }
  };

  const handleOpenAddBank = () => {
    setEditingBankIndex(null);
    setBankForm({
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '',
      accountHolder: foundation?.foundationName || 'Yayasan Tarbiyah Sunnah',
      branch: 'KCP Bandung',
    });
    setBankModalOpen(true);
  };

  const handleOpenEditBank = (idx: number) => {
    if (!foundation || !foundation.bankAccounts[idx]) return;
    setEditingBankIndex(idx);
    setBankForm({ ...foundation.bankAccounts[idx] });
    setBankModalOpen(true);
  };

  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundation) return;
    if (!bankForm.accountNumber.trim()) {
      showToast('Nomor rekening wajib diisi', 'warning');
      return;
    }

    const currentAccounts = [...(foundation.bankAccounts || [])];
    if (editingBankIndex !== null) {
      currentAccounts[editingBankIndex] = bankForm;
    } else {
      currentAccounts.push(bankForm);
    }

    setFoundation({
      ...foundation,
      bankAccounts: currentAccounts,
    });
    setBankModalOpen(false);
    showToast(editingBankIndex !== null ? 'Rekening bank berhasil diperbarui' : 'Rekening bank baru berhasil ditambahkan');
  };

  const handleDeleteBankAccount = (idx: number) => {
    if (!foundation || !foundation.bankAccounts) return;
    const target = foundation.bankAccounts[idx];
    if (!target) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Rekening Bank?',
      message: (
        <p>
          Apakah Anda yakin ingin menghapus rekening <strong className="text-brand-950 font-bold">{target.bankName} - {target.accountNumber}</strong> ({target.accountHolder})?
        </p>
      ),
      confirmLabel: 'Ya, Hapus Rekening',
      variant: 'danger',
      onConfirm: () => {
        const next = foundation.bankAccounts.filter((_, i) => i !== idx);
        setFoundation({ ...foundation, bankAccounts: next });
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        showToast('Rekening bank berhasil dihapus');
      },
    });
  };

  // Taxonomy Handlers (Programs & Tags)
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProgramName,
          code: newProgramCode,
        }),
      });
      if (res.ok) {
        showToast(`Program "${newProgramName}" berhasil ditambahkan!`);
        setNewProgramModal(false);
        setNewProgramName('');
        setNewProgramCode('');
        fetchTaxonomy();
      } else {
        const err = await res.json();
        showToast(err.error?.message || 'Gagal menambahkan program', 'error');
      }
    } catch (err) {
      showToast('Gagal menambahkan program', 'error');
    }
  };

  const handleToggleProgram = async (programId: string) => {
    try {
      const res = await fetch(`/api/settings/programs/${programId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        showToast('Status program infaq berhasil diubah');
        fetchTaxonomy();
      }
    } catch (err) {
      showToast('Gagal mengubah status program', 'error');
    }
  };

  const handleDeleteProgram = (p: ProgramItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Program Infaq?',
      message: (
        <p>
          Apakah Anda yakin ingin menghapus program infaq <strong className="text-brand-950 font-bold">"{p.name}"</strong> ({p.code})?
        </p>
      ),
      confirmLabel: 'Ya, Hapus Program',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/settings/programs/${p.id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast(`Program "${p.name}" berhasil dihapus`);
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            fetchTaxonomy();
          }
        } catch (err) {
          showToast('Gagal menghapus program', 'error');
        }
      },
    });
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      const res = await fetch('/api/settings/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          category: newTagCategory,
        }),
      });
      if (res.ok) {
        showToast(`Tag "${newTagName}" berhasil ditambahkan!`);
        setNewTagModal(false);
        setNewTagName('');
        fetchTaxonomy();
      } else {
        const err = await res.json();
        showToast(err.error?.message || 'Gagal menambahkan tag', 'error');
      }
    } catch (err) {
      showToast('Gagal menambahkan tag', 'error');
    }
  };

  const handleToggleTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/settings/tags/${tagId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        showToast('Status tag label berhasil diubah');
        fetchTaxonomy();
      }
    } catch (err) {
      showToast('Gagal mengubah status tag', 'error');
    }
  };

  const handleDeleteTag = (t: TagItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Label Tag?',
      message: (
        <p>
          Apakah Anda yakin ingin menghapus label tag <strong className="text-brand-950 font-bold">"{t.name}"</strong>?
        </p>
      ),
      confirmLabel: 'Ya, Hapus Tag',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/settings/tags/${t.id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast(`Tag "${t.name}" berhasil dihapus`);
            setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
            fetchTaxonomy();
          }
        } catch (err) {
          showToast('Gagal menghapus tag', 'error');
        }
      },
    });
  };

  // Diagnostics Ping Test Handler
  const handleTestPing = async () => {
    try {
      setPingTesting(true);
      const res = await fetch('/api/settings/ping');
      if (res.ok) {
        const json = await res.json();
        setPingResult({
          latencyMs: json.data.databaseLatencyMs,
          status: json.data.status,
          timestamp: json.data.timestamp,
        });
        showToast(`✓ Database & Vault Sehat! Latensi respon: ${json.data.databaseLatencyMs}ms`);
      }
    } catch (err) {
      showToast('Uji koneksi gagal', 'error');
    } finally {
      setPingTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-50 text-teal-800 rounded-xl border border-teal-200/80 shadow-2xs">
              <Server className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 font-display tracking-tight">Pengaturan Sistem & Tata Kelola</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Konfigurasi profil pengguna, hak akses tim amil, master data dakwah, profil yayasan, dan kesehatan infrastruktur server.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchProfile();
              fetchUsers();
              fetchFoundation();
              fetchTaxonomy();
              fetchSystemHealth();
              showToast('Data pengaturan berhasil disegarkan');
            }}
            className="px-3.5 py-2 text-xs font-bold border border-slate-300 rounded-xl text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-all shadow-2xs active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Segarkan Data
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <IdCard className="w-4 h-4" />
          Profil & Keamanan Akun
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Manajemen Pengguna & Peran ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('foundation')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'foundation'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Profil Yayasan & Rekening
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'taxonomy'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tags className="w-4 h-4" />
          Master Data & Taksonomi
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'email'
              ? 'border-emerald-700 text-emerald-950 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="w-4 h-4 text-emerald-600" />
          <span>Email & SMTP (Kerjamail)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
            no-reply@yts.web.id
          </span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'system'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Server className="w-4 h-4" />
          Status Diagnostik & Storage
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'theme'
              ? 'border-teal-700 text-teal-900 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Palette className="w-4 h-4 text-gold-500" />
          Tema & Warna Tampilan
        </button>
      </div>

      {/* 1. TAB: PROFILE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center text-xl font-bold font-display shadow-sm shrink-0">
                {profile?.fullName ? profile.fullName.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 font-display">{profile?.fullName || 'Pengguna'}</h2>
                <p className="text-xs text-slate-500">{profile?.email || '-'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile?.roles?.map((r: string) => (
                    <span key={r} className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-900 border border-teal-200 uppercase">
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Ubah Data Pribadi</h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullNameInput(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <button
                type="submit"
                className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
              >
                Simpan Perubahan
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <KeyRound className="w-5 h-5 text-teal-700" />
              Keamanan & Ganti Kata Sandi
            </div>
            <p className="text-xs text-slate-500">
              Pastikan kata sandi Anda mengandung minimal 8 karakter dengan kombinasi huruf dan angka.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {passwordMsg.text}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <button
                type="submit"
                className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
              >
                Perbarui Kata Sandi
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. TAB: USERS & RBAC */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-slate-900 font-display">Daftar Pengguna Internal Yayasan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengelolaan akun staf, hak akses per peran (*Role-Based Access Control*), dan status keaktifan.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportUsersCsv}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
                title="Ekspor daftar staf ke CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Ekspor CSV</span>
              </button>
              <button
                onClick={() => setNewUserModal(true)}
                className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all flex items-center gap-2 active:scale-95`}
              >
                <Plus className="w-4 h-4" />
                Tambah Staf Baru
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/75">
                  <th className="py-3 px-4">Nama Lengkap & Email</th>
                  <th className="py-3 px-4">Peran / Otoritas</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Login Terakhir</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{u.fullName}</div>
                      <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r.code} className="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-50 text-teal-900 border border-teal-200">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.isActive ? 'Aktif' : 'Nonaktif (Suspended)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditRoles(u)}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition-all"
                          title="Ubah peran staf ini"
                        >
                          <Edit3 className="w-3 h-3" /> Peran
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u.id)}
                          className={`text-[11px] px-2 py-1 rounded-lg font-bold border transition-colors ${
                            u.isActive
                              ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive ? 'Suspend' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                          title="Hapus akun staf ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB: FOUNDATION */}
      {activeTab === 'foundation' && foundation && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 font-display">Identitas Resmi Yayasan & Rekening Bank</h2>
              <p className="text-xs text-slate-500">Data legalitas, alamat kantor, kontak, dan nomor rekening peruntukan dakwah.</p>
            </div>
            {foundationSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-200">
                <Check className="w-4 h-4" /> Berhasil Disimpan
              </span>
            )}
          </div>

          <form onSubmit={handleSaveFoundation} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Yayasan</label>
                <input
                  type="text"
                  value={foundation.foundationName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, foundationName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">SK Kemenkumham / Legalitas</label>
                <input
                  type="text"
                  value={foundation.skKemenkumham}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, skKemenkumham: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Telepon / WhatsApp Resmi</label>
                <input
                  type="text"
                  value={foundation.officialPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialPhone: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Resmi</label>
                <input
                  type="email"
                  value={foundation.officialEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialEmail: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Alamat Kantor Pusat</label>
                <input
                  type="text"
                  value={foundation.headOfficeAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, headOfficeAddress: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Website Resmi</label>
                <input
                  type="url"
                  value={foundation.officialWebsite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialWebsite: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            {/* Bank Accounts Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-teal-700" />
                  Daftar Rekening Bank Penampung Donasi & Wakaf
                </h3>
                <button
                  type="button"
                  onClick={handleOpenAddBank}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Rekening
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {foundation.bankAccounts?.map((b, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs relative group">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-teal-900 block text-sm">{b.bankName}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBank(idx)}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-white rounded-lg transition-colors"
                          title="Edit rekening"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBankAccount(idx)}
                          className="p-1 text-slate-500 hover:text-rose-700 hover:bg-white rounded-lg transition-colors"
                          title="Hapus rekening"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="font-mono text-base font-black text-slate-900 tracking-wide">{b.accountNumber}</p>
                    <p className="text-slate-700">a.n. <span className="font-bold">{b.accountHolder}</span></p>
                    <p className="text-slate-500 text-[11px]">Cabang: {b.branch}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingFoundation}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95 disabled:opacity-50`}
              >
                {savingFoundation ? 'Menyimpan...' : 'Simpan Profil Yayasan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. TAB: TAXONOMY */}
      {activeTab === 'taxonomy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Programs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">Program Penyaluran Infaq Dakwah</h3>
                <p className="text-xs text-slate-500">Kategori program donasi untuk pelaporan keuangan.</p>
              </div>
              <button
                onClick={() => setNewProgramModal(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} flex items-center gap-1 shadow-2xs active:scale-95`}
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>

            <div className="space-y-2">
              {programs.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
                    <span className="font-mono text-slate-500 text-[11px]">Kode: {p.code}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleProgram(p.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border ${
                        p.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {p.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(p)}
                      className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus program"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">Label Tag & Segmentasi Jamaah</h3>
                <p className="text-xs text-slate-500">Penandaan minat kajian, profesi, dan keahlian.</p>
              </div>
              <button
                onClick={() => setNewTagModal(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} flex items-center gap-1 shadow-2xs active:scale-95`}
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tag
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {tagsList.map((t) => (
                <div
                  key={t.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    t.isActive ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-teal-500' : 'bg-slate-300'}`} />
                  <span>{t.name}</span>
                  <span className="text-[10px] text-slate-500 font-normal">({t.category})</span>
                  <button
                    onClick={() => handleToggleTag(t.id)}
                    className="text-[10px] hover:text-teal-700 ml-0.5"
                    title={t.isActive ? 'Nonaktifkan tag' : 'Aktifkan tag'}
                  >
                    •
                  </button>
                  <button
                    onClick={() => handleDeleteTag(t)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                    title="Hapus tag ini"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB: EMAIL & SMTP (KERJAMAIL) */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-gold-500 to-emerald-700" />
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 shadow-2xs">
                <Mail className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 font-display">Layanan Email SMTP Resmi (Kerjamail)</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                    {emailHealth?.status === 'connected' ? '✓ SMTP Aktif & Terhubung' : 'Siap Digunakan'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Konfigurasi server email yayasan untuk pengiriman otomatis E-Tiket Kajian, Kuitansi Infaq, Konfirmasi Wakaf, dan Undangan Akun Staf.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {emailHealth && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Latensi: {emailHealth.latencyMs} ms</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fetchEmailHealth(true)}
                disabled={emailTesting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-gold-300 ${emailTesting ? 'animate-spin' : ''}`} />
                <span>{emailTesting ? 'Menguji Handshake...' : 'Uji Koneksi SMTP'}</span>
              </button>
            </div>
          </div>

          {/* Grid: Parameters + Live Tester */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Active Server Parameters (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Server className="w-4 h-4 text-emerald-700" />
                  <span>Parameter Server Kerjamail</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono">SSL Encrypted</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Host Mail Server:</span>
                  <span className="font-mono font-bold text-slate-900">mx.kerjamail.co</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Port Utama (SSL):</span>
                  <span className="font-mono font-bold text-emerald-800">465 (SMTPS SSL/TLS)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Port Alternatif:</span>
                  <span className="font-mono font-bold text-slate-700">587 (STARTTLS)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Alamat Email Pengirim:</span>
                  <span className="font-mono font-bold text-emerald-900">no-reply@yts.web.id</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Kata Sandi SMTP:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      {showPasswordMask ? 'ahlan1447H!' : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPasswordMask(!showPasswordMask)}
                      className="text-slate-400 hover:text-slate-700 p-0.5"
                    >
                      {showPasswordMask ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 font-medium">Nama Tampilan Email:</span>
                  <span className="font-bold text-slate-900">Yayasan Tarbiyah Sunnah</span>
                </div>
              </div>

              {/* IMAP/POP3 Info Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block">Protokol Masuk (Incoming Mail):</span>
                <p className="leading-relaxed">
                  IMAPS Port 993 (SSL) / POP3S Port 995 (SSL) terkonfigurasi pada domain <code>yts.web.id</code>.
                </p>
              </div>
            </div>

            {/* Right: Live Interactive Simulation Tester (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Send className="w-4 h-4 text-emerald-700" />
                  <span>Panel Uji Kirim & Simulasi Email Interaktif</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-100 text-gold-900 border border-gold-300">
                  Live Dispatch
                </span>
              </div>

              <form onSubmit={handleSendTestEmail} className="space-y-4">
                {/* Recipient Target */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">Email Penerima Uji Coba</label>
                    {profile?.email && (
                      <button
                        type="button"
                        onClick={() => setTestEmailRecipient(profile.email)}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                      >
                        Gunakan Email Saya ({profile.email})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Inbox className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="nama@gmail.com atau nama@tarbiyahsunnah.id"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-slate-50/50 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Pilih Jenis Template Email yang Ingin Diuji
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'handshake', label: '1. Uji Handshake SMTP', desc: 'Email konfirmasi koneksi dasar' },
                      { id: 'event_ticket', label: '2. E-Tiket Majelis Kajian', desc: 'Simulasi tiket barcode & aturan kajian' },
                      { id: 'donation_receipt', label: '3. Kuitansi Sah Infaq', desc: 'Simulasi tanda terima donasi verified' },
                      { id: 'waqf_inquiry', label: '4. Konfirmasi Wakaf', desc: 'Simulasi permohonan konsultasi' },
                      { id: 'staff_welcome', label: '5. Undangan Akun Staf', desc: 'Simulasi aktivasi akun pengurus' },
                    ].map((tpl) => (
                      <label
                        key={tpl.id}
                        className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                          testTemplateType === tpl.id
                            ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{tpl.label}</span>
                          <input
                            type="radio"
                            name="templateType"
                            value={tpl.id}
                            checked={testTemplateType === tpl.id}
                            onChange={() => setTestTemplateType(tpl.id as any)}
                            className="sr-only"
                          />
                          {testTemplateType === tpl.id && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal mt-0.5">{tpl.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={sendingTestEmail}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send className={`w-4 h-4 text-gold-300 ${sendingTestEmail ? 'animate-spin' : ''}`} />
                  <span>{sendingTestEmail ? 'Mengirimkan Email Melalui Kerjamail...' : 'Kirim Email Uji Coba Sekarang'}</span>
                </button>
              </form>

              {/* Live Output Console Log */}
              {testEmailResultLog && (
                <div className={`p-4 rounded-2xl border text-xs space-y-1.5 animate-in fade-in ${
                  testEmailResultLog.success ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {testEmailResultLog.success ? '✓ Pengiriman Berhasil' : '✗ Pengiriman Gagal'}
                    </span>
                    <span className="text-[10px] text-slate-500">{testEmailResultLog.timestamp}</span>
                  </div>
                  <div className="font-mono text-[11px] space-y-0.5">
                    <div>Penerima: <strong>{testEmailResultLog.recipient}</strong></div>
                    <div>Template: <strong>{testEmailResultLog.template}</strong></div>
                    {testEmailResultLog.messageId && (
                      <div className="truncate">Message-ID: <code>{testEmailResultLog.messageId}</code></div>
                    )}
                    {testEmailResultLog.error && (
                      <div className="text-rose-700">Error: {testEmailResultLog.error}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5 Active Use Cases in CRM Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>5 Alur Pengiriman Email Otomatis yang Terpasang di Sistem CRM</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">1. E-Tiket Kajian</span>
                <span className="text-[11px] text-slate-600 block">Terkirim otomatis saat jamaah mendaftar di <code>/kajian/:id</code>.</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">2. Instruksi Infaq</span>
                <span className="text-[11px] text-slate-600 block">Terkirim otomatis saat donatur submit formulir di <code>/donasi</code>.</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">3. Kuitansi Sah</span>
                <span className="text-[11px] text-slate-600 block">Terkirim otomatis saat diverifikasi Finance di <code>/donations</code>.</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">4. Konsultasi Wakaf</span>
                <span className="text-[11px] text-slate-600 block">Terkirim otomatis saat wakif submit permohonan di <code>/waqf</code>.</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">5. Undangan Staf</span>
                <span className="text-[11px] text-slate-600 block">Terkirim otomatis saat akun staf dibuat di <code>/settings</code>.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB: SYSTEM DIAGNOSTICS */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Real-time Diagnostics Live Ping Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-teal-50 text-teal-800 rounded-2xl border border-teal-200">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">Uji Koneksi Server & Latensi Database Real-Time</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifikasi integritas sambungan PostgreSQL Serverless & Storage S3 Vault.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {pingResult && (
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Latensi: {pingResult.latencyMs} ms (Stabil)</span>
                </div>
              )}
              <button
                onClick={handleTestPing}
                disabled={pingTesting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 text-gold-400 ${pingTesting ? 'animate-spin' : ''}`} />
                {pingTesting ? 'Menguji...' : 'Uji Ping Koneksi'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Database className="w-4 h-4 text-teal-700" />
                Database Serverless & RLS Context
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Database Engine:</span>
                  <span className="font-bold text-slate-900">{systemHealth?.database?.engine || 'Neon Serverless PostgreSQL'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Connection Pooling:</span>
                  <span className="font-bold text-teal-800">{systemHealth?.database?.connectionPooling || 'SSL Encrypted'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">PITR Backup Recovery:</span>
                  <span className="font-bold text-teal-800">{systemHealth?.database?.pitrRecovery || 'Continuous Point-in-Time Active'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Total Jamaah Terdaftar:</span>
                  <span className="font-mono font-black text-slate-900">{systemHealth?.database?.recordsTotal?.persons?.toLocaleString('id-ID') || '3.053'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Cloud className="w-4 h-4 text-teal-700" />
                Storage Vault (Contabo S3 Abstraction)
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Storage Provider:</span>
                  <span className="font-bold text-slate-900">{systemHealth?.storage?.provider || 'Contabo S3 Storage Vault'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Target S3 Bucket:</span>
                  <span className="font-mono font-bold text-slate-800">{systemHealth?.storage?.bucket || 'crm-yts-vault'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">MIME Allowlist:</span>
                  <span className="font-bold text-slate-800">{systemHealth?.storage?.mimeAllowlist?.join(', ') || 'PDF, JPEG, PNG, WEBP'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Akses Berkas Privat:</span>
                  <span className="font-bold text-teal-800">{systemHealth?.storage?.accessControl || 'Private Bucket (15-Min Signed URLs Only)'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB: THEME & COLOR APPEARANCE */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          {/* Theme Banner & Reset */}
          <div className="bg-white border border-cream-300 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-brand-50 text-brand-800 rounded-2xl border border-brand-200">
                <Palette className="w-6 h-6 text-brand-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-brand-950 font-display">Tema & Warna Tampilan Antarmuka</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-400 text-gold-950 shadow-2xs">
                    Live Preview
                  </span>
                </div>
                <p className="text-xs text-surface-500 mt-0.5">
                  Pilih nuansa warna sidebar, aksen tombol, dan latar belakang yang paling nyaman untuk Anda dan tim amil yayasan.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                resetToDefault();
                showToast('Tema dikembalikan ke Standar Resmi');
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-cream-300 text-brand-950 bg-cream-100 hover:bg-cream-200 flex items-center gap-2 transition-all shadow-2xs active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset ke Standar Resmi
            </button>
          </div>

          {/* Theme Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(Object.keys(THEME_PRESETS) as ThemeId[]).map((id) => {
              const preset = THEME_PRESETS[id];
              const isSelected = themeId === id;

              return (
                <div
                  key={id}
                  onClick={() => {
                    setThemeId(id);
                    showToast(`Tema "${preset.name}" diterapkan!`);
                  }}
                  className={`cursor-pointer rounded-3xl border-2 p-6 transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? 'border-brand-700 bg-white shadow-md ring-4 ring-brand-100'
                      : 'border-cream-300 bg-white hover:border-brand-400 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-brand-700 text-white rounded-full text-xs font-extrabold shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                      <span>Sedang Aktif</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header */}
                    <div>
                      <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider block">
                        {preset.subtitle}
                      </span>
                      <h3 className="text-lg font-black text-brand-950 font-display mt-0.5">
                        {preset.name}
                      </h3>
                      <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {/* Color Swatch Bars */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">
                        Palet Warna Utama
                      </span>
                      <div className="flex items-center gap-2">
                        {preset.swatches.map((colorHex, idx) => (
                          <div
                            key={idx}
                            title={colorHex}
                            className="w-8 h-8 rounded-xl border border-black/10 shadow-2xs flex items-center justify-center transition-transform hover:scale-110"
                            style={{ backgroundColor: colorHex }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mini Sidebar Preview Simulator */}
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block mb-1.5">
                        Simulasi Sidebar
                      </span>
                      <div className={`p-3.5 rounded-2xl border ${preset.colors.sidebarBorder} ${preset.colors.sidebarBg} space-y-2 text-xs`}>
                        <div className={`p-2 rounded-xl flex items-center justify-between font-bold ${preset.colors.sidebarActiveBg} ${preset.colors.sidebarActiveText} shadow-xs ring-1 ${preset.colors.sidebarActiveRing}`}>
                          <span>📖 Jadwal Kajian</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold-400 text-gold-950 font-black">FORM</span>
                        </div>
                        <div className={`p-2 rounded-xl flex items-center justify-between font-semibold ${preset.colors.sidebarText}`}>
                          <span>💰 Infaq & Donasi</span>
                        </div>
                        <div className={`p-2 rounded-xl text-center font-bold text-[11px] ${preset.colors.sidebarCtaBg} ${preset.colors.sidebarCtaText}`}>
                          + Catat Sapaan Jamaah
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="pt-5 mt-4 border-t border-cream-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-surface-500">
                      Gaya: <strong className="text-brand-950 capitalize">{preset.sidebarStyle === 'dark' ? 'Sidebar Gelap' : 'Sidebar Terang'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setThemeId(id);
                        showToast(`Tema "${preset.name}" diterapkan!`);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand-800 text-white cursor-default'
                          : 'bg-cream-100 hover:bg-cream-200 text-brand-950 border border-cream-300'
                      }`}
                    >
                      {isSelected ? '✓ Terpilih' : 'Terapkan Tema Ini'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Tambah Staf Baru */}
      {newUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 font-display">Tambah Staf Internal Baru</h3>
              <button onClick={() => setNewUserModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserName(e.target.value)}
                  placeholder="Nama Staf"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserEmail(e.target.value)}
                  placeholder="staf@tarbiyahsunnah.id"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Peran & Otoritas Akses (Multi-pilihan)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {AVAILABLE_ROLES.map((r) => {
                    const isChecked = newUserRoles.includes(r.code);
                    return (
                      <label
                        key={r.code}
                        className="flex items-start gap-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserRoles([...newUserRoles, r.code]);
                            } else {
                              setNewUserRoles(newUserRoles.filter((code) => code !== r.code));
                            }
                          }}
                          className="mt-0.5 rounded text-teal-700 focus:ring-teal-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{r.name}</span>
                          <span className="text-[11px] text-slate-500 leading-tight block">{r.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewUserModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
                >
                  Daftarkan Staf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Roles Staf */}
      {selectedUserForRoleEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 font-display">Ubah Peran & Hak Akses</h3>
                <p className="text-xs text-slate-500">{selectedUserForRoleEdit.fullName} ({selectedUserForRoleEdit.email})</p>
              </div>
              <button onClick={() => setSelectedUserForRoleEdit(null)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl">
              {AVAILABLE_ROLES.map((r) => {
                const isChecked = editRolesList.includes(r.code);
                return (
                  <label
                    key={r.code}
                    className="flex items-start gap-2.5 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditRolesList([...editRolesList, r.code]);
                        } else {
                          setEditRolesList(editRolesList.filter((code) => code !== r.code));
                        }
                      }}
                      className="mt-0.5 rounded text-teal-700 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{r.name}</span>
                      <span className="text-[11px] text-slate-500 leading-tight block">{r.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForRoleEdit(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveUserRoles}
                disabled={savingRoles}
                className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95 disabled:opacity-50`}
              >
                {savingRoles ? 'Menyimpan...' : 'Simpan Peran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Rekening Bank */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 font-display">
                {editingBankIndex !== null ? 'Edit Rekening Bank' : 'Tambah Rekening Bank Baru'}
              </h3>
              <button onClick={() => setBankModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Bank</label>
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  placeholder="Bank Syariah Indonesia (BSI)"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  placeholder="7123456789"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Pemilik Rekening (a.n.)</label>
                <input
                  type="text"
                  value={bankForm.accountHolder}
                  onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                  placeholder="Yayasan Tarbiyah Sunnah"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Cabang Bank</label>
                <input
                  type="text"
                  value={bankForm.branch}
                  onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })}
                  placeholder="KCP Bandung Dago"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
                >
                  Simpan Rekening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Program Donasi */}
      {newProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 font-display">Tambah Program Penyaluran Infaq</h3>
              <button onClick={() => setNewProgramModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Program</label>
                <input
                  type="text"
                  value={newProgramName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgramName(e.target.value)}
                  placeholder="Contoh: Operasional Dakwah Sunnah"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Kode Unik Program</label>
                <input
                  type="text"
                  value={newProgramCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgramCode(e.target.value)}
                  placeholder="Contoh: DAKWAH_RUTIN"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewProgramModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
                >
                  Simpan Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Label Tag */}
      {newTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 font-display">Tambah Label Tag & Segmentasi</h3>
              <button onClick={() => setNewTagModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTag} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nama Tag Label</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Contoh: Kajian Tafsir, Dokter Spesialis, Relawan Medis"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Kategori Tag</label>
                <select
                  value={newTagCategory}
                  onChange={(e) => setNewTagCategory(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {TAG_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTagModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText} shadow-xs transition-all active:scale-95`}
                >
                  Simpan Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-teal-900 text-white border-teal-700 shadow-teal-950/20'
                : toastMessage.type === 'warning'
                ? 'bg-amber-900 text-white border-amber-700 shadow-amber-950/20'
                : 'bg-rose-900 text-white border-rose-700 shadow-rose-950/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/20 rounded-lg ml-2 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Global Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        singleButton={confirmDialog.singleButton}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
