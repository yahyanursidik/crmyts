import React, { useState, useEffect, useMemo } from 'react';
import {
  IdCard,
  Shield,
  Building2,
  Tags,
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Landmark,
  Database,
  Cloud,
  Check,
  Palette,
  RotateCcw,
  Trash2,
  Edit3,
  X,
  Activity,
  Zap,
  Mail,
  Send,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  UserCheck,
  UserX,
  CreditCard,
} from 'lucide-react';
import { useTheme, THEME_PRESETS, ThemeId } from '@/lib/themeContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { apiClient } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';

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
  { value: 'all', label: 'Semua Kategori' },
  { value: 'minat_kajian', label: 'Minat Kajian (Akidah, Fikih, dll.)' },
  { value: 'profesi', label: 'Profesi / Pekerjaan (Dokter, Guru, dll.)' },
  { value: 'keahlian', label: 'Keahlian / Skill (Desain, IT, Medis, dll.)' },
  { value: 'segmentasi', label: 'Segmentasi (Donatur Rutin, Relawan, dll.)' },
  { value: 'wilayah', label: 'Domisili / Wilayah Komunitas' },
  { value: 'lainnya', label: 'Lain-lain / Kustom' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'foundation' | 'taxonomy' | 'email' | 'system' | 'theme'>('profile');
  const { themeId, setThemeId, resetToDefault } = useTheme();

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

  // Loading and refreshing states
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Profile State
  const [profile, setProfile] = useState<any>(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 8;

  // New User Modal
  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['cs_officer']);
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit Roles Modal State
  const [selectedUserForRoleEdit, setSelectedUserForRoleEdit] = useState<UserItem | null>(null);
  const [editRolesList, setEditRolesList] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Foundation State
  const [foundation, setFoundation] = useState<FoundationInfo | null>(null);
  const [savingFoundation, setSavingFoundation] = useState(false);

  // Bank Account Modal State
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBankIndex, setEditingBankIndex] = useState<number | null>(null);
  const [bankForm, setBankForm] = useState<BankAccount>({
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountHolder: 'Yayasan Tarbiyah Sunnah',
    branch: 'KCP Bandung Dago',
  });

  // Taxonomy State (Programs & Tags)
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [programSearch, setProgramSearch] = useState('');
  const [programPage, setProgramPage] = useState(1);
  const programPageSize = 8;
  const [newProgramModal, setNewProgramModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);

  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagCategoryFilter, setTagCategoryFilter] = useState('all');
  const [tagPage, setTagPage] = useState(1);
  const tagPageSize = 8;
  const [newTagModal, setNewTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('minat_kajian');
  const [creatingTag, setCreatingTag] = useState(false);

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
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Fetch functions with refresh bypass
  const fetchProfile = async () => {
    try {
      const res = await apiClient<any>('/settings/profile');
      setProfile(res.data);
      setFullNameInput(res.data?.fullName || '');
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  const fetchUsers = async (forceRefresh = false) => {
    try {
      const endpoint = forceRefresh ? '/settings/users?refresh=true' : '/settings/users';
      const res = await apiClient<UserItem[]>(endpoint);
      setUsers(res.data || []);
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  const fetchFoundation = async () => {
    try {
      const res = await apiClient<FoundationInfo>('/settings/foundation');
      setFoundation(res.data);
    } catch (e) {
      console.error('Error fetching foundation:', e);
    }
  };

  const fetchTaxonomy = async (forceRefresh = false) => {
    try {
      const pUrl = forceRefresh ? '/settings/programs?refresh=true' : '/settings/programs';
      const tUrl = forceRefresh ? '/settings/tags?refresh=true' : '/settings/tags';
      const [pRes, tRes] = await Promise.all([
        apiClient<ProgramItem[]>(pUrl),
        apiClient<TagItem[]>(tUrl),
      ]);
      setPrograms(pRes.data || []);
      setTagsList(tRes.data || []);
    } catch (e) {
      console.error('Error fetching taxonomy:', e);
    }
  };

  const fetchSystemHealth = async (forceRefresh = false) => {
    try {
      const endpoint = forceRefresh ? '/settings/system-health?refresh=true' : '/settings/system-health';
      const res = await apiClient<any>(endpoint);
      setSystemHealth(res.data);
    } catch (e) {
      console.error('Error fetching system health:', e);
    }
  };

  const fetchEmailHealth = async (showNotification = false) => {
    setEmailTesting(true);
    try {
      const res = await apiClient<any>('/settings/email-health');
      setEmailHealth(res.data);
      if (showNotification) {
        if (res.data?.status === 'connected') {
          showToast(`✓ Koneksi SMTP Kerjamail Terhubung! Latensi: ${res.data.latencyMs} ms`);
        } else {
          showToast(res.data?.errorMessage || 'Koneksi SMTP bermasalah', 'error');
        }
      }
    } catch (e: any) {
      if (showNotification) showToast(e?.message || 'Gagal menguji koneksi SMTP server', 'error');
    } finally {
      setEmailTesting(false);
    }
  };

  const loadAllInitialData = async (force = false) => {
    if (force) setRefreshingAll(true);
    else setInitialLoading(true);

    await Promise.allSettled([
      fetchProfile(),
      fetchUsers(force),
      fetchFoundation(),
      fetchTaxonomy(force),
      fetchSystemHealth(force),
    ]);

    setInitialLoading(false);
    setRefreshingAll(false);
  };

  useEffect(() => {
    loadAllInitialData();
  }, []);

  // Lazy load email health when entering email tab
  useEffect(() => {
    if (activeTab === 'email' && !emailHealth && !emailTesting) {
      fetchEmailHealth(false);
    }
  }, [activeTab]);

  // Profile actions
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullNameInput.trim()) {
      showToast('Nama lengkap tidak boleh kosong', 'error');
      return;
    }
    setUpdatingProfile(true);
    try {
      await apiClient('/settings/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: fullNameInput.trim() }),
      });
      showToast('Profil nama amil berhasil diperbarui!');
      fetchProfile();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui profil', 'error');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Masukkan kata sandi saat ini', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi kata sandi baru tidak cocok', 'error');
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiClient('/settings/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast('Kata sandi berhasil diperbarui dengan aman!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui kata sandi', 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // User management actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || newUserRoles.length === 0) {
      showToast('Nama, email, dan minimal 1 peran wajib dipilih', 'error');
      return;
    }

    setCreatingUser(true);
    try {
      await apiClient('/settings/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newUserName.trim(),
          email: newUserEmail.trim(),
          roleCodes: newUserRoles,
        }),
      });
      showToast(`Pengguna staf ${newUserName} berhasil didaftarkan.`);
      setNewUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRoles(['cs_officer']);
      fetchUsers(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat pengguna staf', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = (user: UserItem) => {
    const actionVerb = user.isActive ? 'menonaktifkan (suspend)' : 'mengaktifkan kembali';
    setConfirmDialog({
      isOpen: true,
      title: `Konfirmasi Status Pengguna`,
      message: `Apakah Anda yakin ingin ${actionVerb} akun staf "${user.fullName}" (${user.email})?`,
      confirmLabel: user.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun',
      variant: user.isActive ? 'warning' : 'success',
      onConfirm: async () => {
        try {
          await apiClient(`/settings/users/${user.id}/status`, { method: 'PATCH' });
          showToast(`Status akun ${user.fullName} berhasil diperbarui.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchUsers(true);
        } catch (err: any) {
          showToast(err.message || 'Gagal mengubah status staf', 'error');
        }
      },
    });
  };

  const handleDeleteUser = (user: UserItem) => {
    setConfirmDialog({
      isOpen: true,
      title: `Hapus Akun Pengguna Staf`,
      message: (
        <div>
          <p className="font-bold text-red-600 mb-1">Tindakan ini tidak dapat dibatalkan!</p>
          <p>
            Akun <strong>{user.fullName}</strong> ({user.email}) akan dihapus secara permanen dari sistem beserta seluruh hak akses perannya.
          </p>
        </div>
      ),
      confirmLabel: 'Hapus Pengguna',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiClient(`/settings/users/${user.id}`, { method: 'DELETE' });
          showToast(`Akun ${user.fullName} berhasil dihapus.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchUsers(true);
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus pengguna', 'error');
        }
      },
    });
  };

  const handleSaveRoles = async () => {
    if (!selectedUserForRoleEdit || editRolesList.length === 0) {
      showToast('Pilih minimal 1 peran akses', 'error');
      return;
    }
    setSavingRoles(true);
    try {
      await apiClient(`/settings/users/${selectedUserForRoleEdit.id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleCodes: editRolesList }),
      });
      showToast(`Peran untuk ${selectedUserForRoleEdit.fullName} berhasil diperbarui.`);
      setSelectedUserForRoleEdit(null);
      fetchUsers(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui peran staf', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  // Foundation & Bank actions
  const handleSaveFoundation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundation) return;
    setSavingFoundation(true);
    try {
      await apiClient('/settings/foundation', {
        method: 'PUT',
        body: JSON.stringify(foundation),
      });
      showToast('Profil identitas yayasan berhasil disimpan!');
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan data yayasan', 'error');
    } finally {
      setSavingFoundation(false);
    }
  };

  const handleSaveBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundation || !bankForm.bankName || !bankForm.accountNumber || !bankForm.accountHolder) {
      showToast('Semua field rekening bank wajib diisi', 'error');
      return;
    }

    const updatedAccounts = [...(foundation.bankAccounts || [])];
    if (editingBankIndex !== null) {
      updatedAccounts[editingBankIndex] = { ...bankForm };
    } else {
      updatedAccounts.push({ ...bankForm });
    }

    setFoundation({ ...foundation, bankAccounts: updatedAccounts });
    setBankModalOpen(false);
    setEditingBankIndex(null);
    setBankForm({
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '',
      accountHolder: 'Yayasan Tarbiyah Sunnah',
      branch: 'KCP Bandung Dago',
    });
    showToast('Daftar rekening diperbarui. Klik "Simpan Perubahan Identitas" untuk menerapkan ke server.');
  };

  const handleDeleteBankAccount = (index: number) => {
    if (!foundation) return;
    const updatedAccounts = foundation.bankAccounts.filter((_, i) => i !== index);
    setFoundation({ ...foundation, bankAccounts: updatedAccounts });
    showToast('Rekening dihapus. Klik "Simpan Perubahan Identitas" untuk menerapkan ke server.');
  };

  // Programs & Tags actions
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgramName.trim() || !newProgramCode.trim()) {
      showToast('Nama dan kode program wajib diisi', 'error');
      return;
    }
    setCreatingProgram(true);
    try {
      await apiClient('/settings/programs', {
        method: 'POST',
        body: JSON.stringify({
          name: newProgramName.trim(),
          code: newProgramCode.trim().toUpperCase(),
        }),
      });
      showToast(`Program infaq "${newProgramName}" berhasil ditambahkan.`);
      setNewProgramModal(false);
      setNewProgramName('');
      setNewProgramCode('');
      fetchTaxonomy(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan program', 'error');
    } finally {
      setCreatingProgram(false);
    }
  };

  const handleToggleProgram = async (prog: ProgramItem) => {
    try {
      await apiClient(`/settings/programs/${prog.id}/toggle`, { method: 'PATCH' });
      showToast(`Status program "${prog.name}" berhasil diubah.`);
      fetchTaxonomy(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status program', 'error');
    }
  };

  const handleDeleteProgram = (prog: ProgramItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Program Infaq',
      message: `Apakah Anda yakin ingin menghapus program "${prog.name}" (${prog.code})?`,
      confirmLabel: 'Hapus Program',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiClient(`/settings/programs/${prog.id}`, { method: 'DELETE' });
          showToast(`Program "${prog.name}" berhasil dihapus.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchTaxonomy(true);
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus program', 'error');
        }
      },
    });
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) {
      showToast('Nama label tag wajib diisi', 'error');
      return;
    }
    setCreatingTag(true);
    try {
      await apiClient('/settings/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: newTagName.trim(),
          category: newTagCategory,
        }),
      });
      showToast(`Tag "${newTagName}" berhasil ditambahkan.`);
      setNewTagModal(false);
      setNewTagName('');
      setNewTagCategory('minat_kajian');
      fetchTaxonomy(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan tag', 'error');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleToggleTag = async (tag: TagItem) => {
    try {
      await apiClient(`/settings/tags/${tag.id}/toggle`, { method: 'PATCH' });
      showToast(`Status tag "${tag.name}" berhasil diubah.`);
      fetchTaxonomy(true);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status tag', 'error');
    }
  };

  const handleDeleteTag = (tag: TagItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Master Tag',
      message: `Apakah Anda yakin ingin menghapus tag "${tag.name}"?`,
      confirmLabel: 'Hapus Tag',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await apiClient(`/settings/tags/${tag.id}`, { method: 'DELETE' });
          showToast(`Tag "${tag.name}" berhasil dihapus.`);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          fetchTaxonomy(true);
        } catch (err: any) {
          showToast(err.message || 'Gagal menghapus tag', 'error');
        }
      },
    });
  };

  // Live Ping database
  const handlePing = async () => {
    setPingTesting(true);
    try {
      const res = await apiClient<any>('/settings/ping');
      setPingResult(res.data);
      showToast(`✓ Database Serverless Responsif: ${res.data.databaseLatencyMs} ms`);
    } catch (err: any) {
      showToast(err.message || 'Koneksi ping gagal', 'error');
    } finally {
      setPingTesting(false);
    }
  };

  // Live Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) {
      showToast('Masukkan alamat email tujuan simulasi', 'error');
      return;
    }
    setSendingTestEmail(true);
    setTestEmailResultLog(null);
    try {
      const res = await apiClient<any>('/settings/send-test-email', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim(),
          templateType: testTemplateType,
        }),
      });
      showToast(res.data?.message || 'Email uji coba berhasil dikirim!');
      setTestEmailResultLog({
        success: true,
        messageId: res.data?.messageId,
        recipient: testEmailRecipient.trim(),
        template: testTemplateType,
        timestamp: new Date().toLocaleTimeString('id-ID'),
      });
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim email uji coba', 'error');
      setTestEmailResultLog({
        success: false,
        recipient: testEmailRecipient.trim(),
        template: testTemplateType,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        error: err.message || 'Koneksi ke server Kerjamail gagal',
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Filtered & Paginated Users
  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const matchSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roles.some((r) => r.name.toLowerCase().includes(q));

      const matchRole =
        userRoleFilter === 'all' || u.roles.some((r) => r.code === userRoleFilter);

      return matchSearch && matchRole;
    });
  }, [users, userSearchQuery, userRoleFilter]);

  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize);

  // Filtered & Paginated Programs
  const filteredPrograms = useMemo(() => {
    const q = programSearch.toLowerCase().trim();
    return programs.filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [programs, programSearch]);

  const programTotalPages = Math.max(1, Math.ceil(filteredPrograms.length / programPageSize));
  const paginatedPrograms = filteredPrograms.slice((programPage - 1) * programPageSize, programPage * programPageSize);

  // Filtered & Paginated Tags
  const filteredTags = useMemo(() => {
    const q = tagSearch.toLowerCase().trim();
    return tagsList.filter((t) => {
      const matchSearch = !q || t.name.toLowerCase().includes(q);
      const matchCat = tagCategoryFilter === 'all' || t.category === tagCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [tagsList, tagSearch, tagCategoryFilter]);

  const tagTotalPages = Math.max(1, Math.ceil(filteredTags.length / tagPageSize));
  const paginatedTags = filteredTags.slice((tagPage - 1) * tagPageSize, tagPage * tagPageSize);

  if (initialLoading && !profile) {
    return <LoadingState message="Memuat konfigurasi sistem dan parameter yayasan..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 ${
            toastMessage.type === 'success'
              ? 'bg-[#14352A] text-white border-[#1B4332]'
              : toastMessage.type === 'error'
              ? 'bg-red-900 text-white border-red-700'
              : 'bg-amber-900 text-white border-amber-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#E0B970]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-300" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Header Hero Banner */}
      <div className="p-6 bg-gradient-to-r from-[#14352A] via-[#1B4332] to-[#0F4C4A] text-white rounded-3xl border border-[#1B4332] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 p-2.5 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Shield className="w-full h-full text-[#E0B970]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-white/15 text-[#E0B970] border border-white/20">
                Core Governance &amp; Administration
              </span>
              <span className="text-xs text-white/70 font-mono">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight mt-1">
              Pengaturan &amp; Konfigurasi Sistem CRM Yayasan
            </h1>
            <p className="text-xs text-white/80 mt-0.5 max-w-2xl leading-relaxed">
              Pusat kendali profil amil, hak akses peran staf, identitas legal yayasan &amp; rekening bank, program infaq dakwah, integrasi SMTP Kerjamail, dan audit sistem.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-center">
          <button
            onClick={() => loadAllInitialData(true)}
            disabled={refreshingAll}
            className="px-3.5 py-2 rounded-xl bg-white text-[#14352A] hover:bg-[#F2EEE4] text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50"
            title="Segarkan seluruh konfigurasi dan data master secara real-time"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#14352A] ${refreshingAll ? 'animate-spin' : ''}`} />
            <span>{refreshingAll ? 'Menyegarkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* 2. Redesigned Tab Navigation Strip */}
      <div className="bg-white p-2 rounded-2xl border border-[#1B4332]/12 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <IdCard className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Profil &amp; Keamanan</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Shield className={`w-4 h-4 ${activeTab === 'users' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Pengguna &amp; Hak Akses Staf</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('foundation')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'foundation'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Building2 className={`w-4 h-4 ${activeTab === 'foundation' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Profil Yayasan &amp; Bank</span>
            {foundation?.bankAccounts && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {foundation.bankAccounts.length} Rek
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('taxonomy')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'taxonomy'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Tags className={`w-4 h-4 ${activeTab === 'taxonomy' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Program Infaq &amp; Tagging</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
              {programs.length + tagsList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'email'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Mail className={`w-4 h-4 ${activeTab === 'email' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Kerjamail SMTP Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'system'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Server className={`w-4 h-4 ${activeTab === 'system' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Status Sistem &amp; Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'theme'
                ? 'bg-[#14352A] text-white shadow-xs'
                : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-[#F2EEE4]'
            }`}
          >
            <Palette className={`w-4 h-4 ${activeTab === 'theme' ? 'text-[#E0B970]' : 'text-[#6B7A72]'}`} />
            <span>Personalisasi Tema</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: PROFIL & KEAMANAN */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Info Akun Saya */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#14352A] to-[#1B4332] text-[#E0B970] font-display font-bold text-xl flex items-center justify-center border border-[#1B4332]/30 shadow-inner">
                {profile?.fullName
                  ? profile.fullName
                      .split(' ')
                      .slice(0, 2)
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                  : 'AM'}
              </div>
              <div>
                <h3 className="text-base font-bold font-display text-[#1C2321]">
                  {profile?.fullName || 'Amil Pengurus'}
                </h3>
                <p className="text-xs text-[#6B7A72] font-mono">{profile?.email || 'admin@tarbiyahsunnah.id'}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    Akun Aktif
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F2EEE4] text-[#14352A] border border-[#1B4332]/10">
                    ID: {profile?.id?.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1B4332]/10 space-y-3">
              <h4 className="text-xs font-bold text-[#1C2321] uppercase tracking-wider">Peran Akses Terdaftar</h4>
              <div className="flex flex-wrap gap-1.5">
                {profile?.roles?.map((role: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#14352A] text-white border border-[#1B4332] shadow-2xs"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#1B4332]/10">
              <h4 className="text-xs font-bold text-[#1C2321] uppercase tracking-wider mb-2">
                Daftar Izin &amp; Kewenangan
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {profile?.permissions?.map((p: string, idx: number) => (
                  <div
                    key={idx}
                    className="p-1.5 px-2 bg-[#FBF9F4] rounded-lg border border-[#1B4332]/8 text-[11px] font-mono text-[#3D4A44] flex items-center gap-2"
                  >
                    <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="truncate">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Form Ganti Nama & Kata Sandi */}
          <div className="lg:col-span-2 space-y-6">
            {/* Form Ubah Nama */}
            <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
                <IdCard className="w-5 h-5 text-[#1B4332]" />
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Perbarui Nama Tampilan Amil</h3>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Nama Lengkap Resmi</label>
                  <input
                    type="text"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                    placeholder="Contoh: Ustadz Abu Fulan"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {updatingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Simpan Perubahan Nama</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Form Ganti Kata Sandi */}
            <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
                <KeyRound className="w-5 h-5 text-[#B58B3C]" />
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Penggantian Kata Sandi Akun</h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Kata Sandi Saat Ini</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A72] hover:text-[#1C2321]"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1.5">
                      Kata Sandi Baru <span className="text-red-700">* (Min 8 Karakter)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                        placeholder="Minimal 8 karakter..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A72] hover:text-[#1C2321]"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Konfirmasi Kata Sandi Baru</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                      placeholder="Ulangi kata sandi baru..."
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-4 py-2 bg-[#B58B3C] hover:bg-[#9E7830] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {updatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    <span>Perbarui Kata Sandi</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: PENGGUNA & HAK AKSES STAF */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Action Bar & Filters */}
          <div className="p-4 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Cari nama staf, email, atau peran..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#1B4332]/20 bg-[#FBF9F4] text-[#1C2321] focus:bg-white focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-[#1B4332]/20 bg-[#FBF9F4] text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none font-bold"
              >
                <option value="all">Semua Peran</option>
                {AVAILABLE_ROLES.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setNewUserModal(true)}
              className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-[#E0B970]" />
              <span>Tambah Pengguna Staf</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#1B4332]/12 shadow-sm overflow-hidden">
            {paginatedUsers.length === 0 ? (
              <div className="p-12 text-center text-[#6B7A72] text-xs space-y-2">
                <UserX className="w-8 h-8 mx-auto opacity-60 text-[#1B4332]" />
                <p className="font-bold text-sm text-[#1C2321]">Tidak Ditemukan Pengguna Staf</p>
                <p>Silakan periksa kata kunci pencarian atau filter peran yang dipilih.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Nama Staf &amp; Email</th>
                      <th className="py-3 px-4">Peran Kewenangan</th>
                      <th className="py-3 px-4">Status Akun</th>
                      <th className="py-3 px-4">Terdaftar</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                    {paginatedUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F2EEE4]/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#14352A] text-[#E0B970] font-bold text-xs flex items-center justify-center shrink-0">
                              {u.fullName
                                ? u.fullName
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                : 'ST'}
                            </div>
                            <div>
                              <strong className="font-display block text-sm">{u.fullName}</strong>
                              <span className="text-[11px] text-[#6B7A72] font-mono">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 flex-wrap">
                            {u.roles.map((r, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F2EEE4] text-[#14352A] border border-[#1B4332]/10"
                              >
                                {r.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {u.isActive ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-900 border border-red-200 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              <span>Ditangguhkan</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#6B7A72] text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedUserForRoleEdit(u);
                                setEditRolesList(u.roles.map((r) => r.code));
                              }}
                              className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] rounded-lg border border-[#1B4332]/12 transition-all"
                              title="Edit Peran Pengguna"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                u.isActive
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                              }`}
                              title={u.isActive ? 'Tangguhkan Akun (Suspend)' : 'Aktifkan Akun'}
                            >
                              {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-all"
                              title="Hapus Akun Pengguna"
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
            )}

            {/* Pagination */}
            {filteredUsers.length > userPageSize && (
              <div className="p-4 bg-[#FBF9F4] border-t border-[#1B4332]/10 flex items-center justify-between flex-wrap gap-3 text-xs">
                <span className="text-[#6B7A72]">
                  Menampilkan <strong>{(userPage - 1) * userPageSize + 1}</strong> -{' '}
                  <strong>{Math.min(userPage * userPageSize, filteredUsers.length)}</strong> dari{' '}
                  <strong>{filteredUsers.length}</strong> pengguna
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    disabled={userPage === 1}
                    className="p-1.5 rounded-lg border border-[#1B4332]/14 text-[#3D4A44] hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono font-bold text-[#14352A] bg-white rounded-lg border border-[#1B4332]/14">
                    Hal {userPage} dari {userTotalPages}
                  </span>

                  <button
                    onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                    disabled={userPage >= userTotalPages}
                    className="p-1.5 rounded-lg border border-[#1B4332]/14 text-[#3D4A44] hover:bg-[#F2EEE4] disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 3: PROFIL YAYASAN & REKENING BANK */}
      {activeTab === 'foundation' && foundation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identitas Legal Form */}
          <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Building2 className="w-5 h-5 text-[#1B4332]" />
              <div>
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Identitas Resmi Yayasan</h3>
                <p className="text-[11px] text-[#6B7A72]">Data yang tertera pada kuitansi infaq, tiket kajian, dan kop surat resmi.</p>
              </div>
            </div>

            <form onSubmit={handleSaveFoundation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Nama Resmi Yayasan</label>
                  <input
                    type="text"
                    value={foundation.foundationName}
                    onChange={(e) => setFoundation({ ...foundation, foundationName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-display"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Nomor SK Kemenkumham</label>
                  <input
                    type="text"
                    value={foundation.skKemenkumham}
                    onChange={(e) => setFoundation({ ...foundation, skKemenkumham: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Alamat Kantor Pusat</label>
                <textarea
                  rows={2}
                  value={foundation.headOfficeAddress}
                  onChange={(e) => setFoundation({ ...foundation, headOfficeAddress: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">No. Telepon / CS</label>
                  <input
                    type="text"
                    value={foundation.officialPhone}
                    onChange={(e) => setFoundation({ ...foundation, officialPhone: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Email Resmi</label>
                  <input
                    type="email"
                    value={foundation.officialEmail}
                    onChange={(e) => setFoundation({ ...foundation, officialEmail: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Website Resmi</label>
                  <input
                    type="url"
                    value={foundation.officialWebsite}
                    onChange={(e) => setFoundation({ ...foundation, officialWebsite: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingFoundation}
                  className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingFoundation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Simpan Perubahan Identitas</span>
                </button>
              </div>
            </form>
          </div>

          {/* Rekening Bank Section */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#B58B3C]" />
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Rekening Bank Resmi</h3>
              </div>
              <button
                onClick={() => {
                  setEditingBankIndex(null);
                  setBankForm({
                    bankName: 'Bank Syariah Indonesia (BSI)',
                    accountNumber: '',
                    accountHolder: 'Yayasan Tarbiyah Sunnah',
                    branch: 'KCP Bandung Dago',
                  });
                  setBankModalOpen(true);
                }}
                className="p-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-lg shadow-2xs transition-all"
                title="Tambah Rekening Bank"
              >
                <Plus className="w-3.5 h-3.5 text-[#E0B970]" />
              </button>
            </div>

            <div className="space-y-3">
              {foundation.bankAccounts?.map((bank, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/12 space-y-1.5 relative group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#14352A]">{bank.bankName}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingBankIndex(idx);
                          setBankForm({ ...bank });
                          setBankModalOpen(true);
                        }}
                        className="p-1 text-[#6B7A72] hover:text-[#14352A]"
                        title="Edit Rekening"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBankAccount(idx)}
                        className="p-1 text-[#6B7A72] hover:text-red-700"
                        title="Hapus Rekening"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="font-mono font-bold text-sm text-[#1C2321] tracking-wide">
                    {bank.accountNumber}
                  </div>
                  <p className="text-[11px] text-[#6B7A72] truncate">a.n. {bank.accountHolder}</p>
                  <span className="text-[10px] text-[#6B7A72] block">{bank.branch}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 4: PROGRAM INFAQ & MASTER TAGGING */}
      {activeTab === 'taxonomy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sub-Card 1: Program Infaq */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#1B4332]" />
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Program Penyaluran Infaq</h3>
                  <p className="text-[11px] text-[#6B7A72]">Kode alokasi dana donasi &amp; wakaf.</p>
                </div>
              </div>

              <button
                onClick={() => setNewProgramModal(true)}
                className="px-3 py-1.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-[#E0B970]" />
                <span>Tambah Program</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={programSearch}
                onChange={(e) => {
                  setProgramSearch(e.target.value);
                  setProgramPage(1);
                }}
                placeholder="Cari nama atau kode program..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#1B4332]/20 bg-[#FBF9F4] text-[#1C2321] focus:bg-white outline-none"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3">Nama Program</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                  {paginatedPrograms.map((p) => (
                    <tr key={p.id} className="hover:bg-[#F2EEE4]/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#14352A]">{p.code}</td>
                      <td className="py-2.5 px-3 font-semibold">{p.name}</td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleProgram(p)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.isActive
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                              : 'bg-red-100 text-red-900 border-red-200'
                          }`}
                        >
                          {p.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteProgram(p)}
                          className="p-1 text-red-700 hover:bg-red-50 rounded"
                          title="Hapus Program"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredPrograms.length > programPageSize && (
              <div className="flex items-center justify-between text-xs text-[#6B7A72] pt-2">
                <span>Total {filteredPrograms.length} program</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setProgramPage((p) => Math.max(1, p - 1))}
                    disabled={programPage === 1}
                    className="p-1 rounded border disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono">{programPage}/{programTotalPages}</span>
                  <button
                    onClick={() => setProgramPage((p) => Math.min(programTotalPages, p + 1))}
                    disabled={programPage >= programTotalPages}
                    className="p-1 rounded border disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Card 2: Master Tagging */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <div className="flex items-center gap-2">
                <Tags className="w-5 h-5 text-[#B58B3C]" />
                <div>
                  <h3 className="text-sm font-bold font-display text-[#1C2321]">Master Label Tagging Jamaah</h3>
                  <p className="text-[11px] text-[#6B7A72]">Segmentasi minat, profesi, dan keahlian.</p>
                </div>
              </div>

              <button
                onClick={() => setNewTagModal(true)}
                className="px-3 py-1.5 bg-[#B58B3C] hover:bg-[#9E7830] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Tambah Tag</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#6B7A72] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => {
                    setTagSearch(e.target.value);
                    setTagPage(1);
                  }}
                  placeholder="Cari label tag..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#1B4332]/20 bg-[#FBF9F4] text-[#1C2321] focus:bg-white outline-none"
                />
              </div>

              <select
                value={tagCategoryFilter}
                onChange={(e) => {
                  setTagCategoryFilter(e.target.value);
                  setTagPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-[#1B4332]/20 bg-[#FBF9F4] text-[#1C2321] font-bold"
              >
                {TAG_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#1B4332]/12">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FBF9F4] text-[#6B7A72] font-bold border-b border-[#1B4332]/10 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Label Tag</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B4332]/8 text-[#1C2321]">
                  {paginatedTags.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F2EEE4]/40">
                      <td className="py-2.5 px-3 font-semibold text-[#14352A]">{t.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/10">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleTag(t)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            t.isActive
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                              : 'bg-red-100 text-red-900 border-red-200'
                          }`}
                        >
                          {t.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDeleteTag(t)}
                          className="p-1 text-red-700 hover:bg-red-50 rounded"
                          title="Hapus Tag"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTags.length > tagPageSize && (
              <div className="flex items-center justify-between text-xs text-[#6B7A72] pt-2">
                <span>Total {filteredTags.length} tag</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTagPage((p) => Math.max(1, p - 1))}
                    disabled={tagPage === 1}
                    className="p-1 rounded border disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono">{tagPage}/{tagTotalPages}</span>
                  <button
                    onClick={() => setTagPage((p) => Math.min(tagTotalPages, p + 1))}
                    disabled={tagPage >= tagTotalPages}
                    className="p-1 rounded border disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. TAB 5: KERJAMAIL SMTP ENGINE */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SMTP Configuration Card */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Mail className="w-5 h-5 text-[#1B4332]" />
              <div>
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Kerjamail SMTP Engine</h3>
                <p className="text-[11px] text-[#6B7A72]">Server pengiriman email resmi Tarbiyah Sunnah.</p>
              </div>
            </div>

            <div className="p-4 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7A72]">Status Server:</span>
                {emailHealth?.status === 'connected' ? (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 inline-flex items-center gap-1 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    <span>Terhubung (Connected)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    <span>{emailHealth ? 'Error / Timeout' : 'Belum Diuji'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A72]">SMTP Host:</span>
                <span className="font-mono font-bold text-[#14352A]">mx.kerjamail.co</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A72]">Port &amp; Enkripsi:</span>
                <span className="font-mono text-[#14352A]">465 (SSL / TLS)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A72]">Email Pengirim:</span>
                <span className="font-mono text-[#14352A]">no-reply@yts.web.id</span>
              </div>

              {emailHealth?.latencyMs && (
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7A72]">Latensi Server:</span>
                  <span className="font-mono font-bold text-emerald-800">{emailHealth.latencyMs} ms</span>
                </div>
              )}
            </div>

            <button
              onClick={() => fetchEmailHealth(true)}
              disabled={emailTesting}
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {emailTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-[#E0B970]" />}
              <span>{emailTesting ? 'Menguji Koneksi SMTP...' : 'Uji Koneksi SMTP Sekarang'}</span>
            </button>
          </div>

          {/* Simulator Pengiriman Email Live */}
          <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Send className="w-5 h-5 text-[#B58B3C]" />
              <div>
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Simulator Uji Coba Pengiriman Email Live</h3>
                <p className="text-[11px] text-[#6B7A72]">Kirim contoh template email resmi ke alamat email penerima pilihan Anda.</p>
              </div>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Alamat Email Tujuan Uji Coba</label>
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    required
                    placeholder="nama@domain.com"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Pilihan Template Email</label>
                  <select
                    value={testTemplateType}
                    onChange={(e: any) => setTestTemplateType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-bold text-[#14352A]"
                  >
                    <option value="handshake">1. Handshake Ping Uji Koneksi</option>
                    <option value="event_ticket">2. Tiket Kajian &amp; QR Code Presensi</option>
                    <option value="donation_receipt">3. Kuitansi Donasi &amp; Infaq Terverifikasi</option>
                    <option value="waqf_inquiry">4. Konfirmasi Permohonan Konsultasi Wakaf</option>
                    <option value="staff_welcome">5. Sambutan &amp; Kredensial Staf Baru</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingTestEmail}
                  className="px-4 py-2.5 bg-[#B58B3C] hover:bg-[#9E7830] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {sendingTestEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{sendingTestEmail ? 'Mengirim Email...' : 'Kirim Email Simulasi'}</span>
                </button>
              </div>
            </form>

            {/* Test Email Result Log */}
            {testEmailResultLog && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${
                  testEmailResultLog.success
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                    : 'bg-red-50 text-red-950 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {testEmailResultLog.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-700" />
                  )}
                  <span>
                    {testEmailResultLog.success
                      ? `Berhasil Terkirim ke ${testEmailResultLog.recipient}`
                      : `Gagal Mengirim Email`}
                  </span>
                </div>
                {testEmailResultLog.messageId && (
                  <p className="font-mono text-[11px] text-emerald-800">
                    Message ID: {testEmailResultLog.messageId}
                  </p>
                )}
                {testEmailResultLog.error && (
                  <p className="text-[11px] text-red-800">{testEmailResultLog.error}</p>
                )}
                <span className="text-[10px] text-[#6B7A72] block">
                  Waktu pengiriman: {testEmailResultLog.timestamp}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. TAB 6: STATUS SISTEM & AUDIT */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Database Diagnostics */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Database className="w-5 h-5 text-[#1B4332]" />
              <h3 className="text-sm font-bold font-display text-[#1C2321]">Database Serverless Neon</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 space-y-1.5">
                <span className="text-[10px] font-bold text-[#6B7A72] uppercase">Engine Database</span>
                <strong className="block font-display text-[#1C2321]">
                  {systemHealth?.database?.engine || 'Neon Serverless PostgreSQL (Drizzle ORM)'}
                </strong>
                <p className="text-[11px] text-[#6B7A72]">
                  {systemHealth?.database?.connectionPooling || 'SSL Encrypted Transaction Scoped'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                  <span className="text-[10px] text-[#6B7A72] block">Jamaah</span>
                  <strong className="font-mono text-sm text-[#14352A]">
                    {systemHealth?.database?.recordsTotal?.persons || 0}
                  </strong>
                </div>
                <div className="p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                  <span className="text-[10px] text-[#6B7A72] block">Staf CRM</span>
                  <strong className="font-mono text-sm text-[#14352A]">
                    {systemHealth?.database?.recordsTotal?.users || 0}
                  </strong>
                </div>
                <div className="p-2.5 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10">
                  <span className="text-[10px] text-[#6B7A72] block">Audit Log</span>
                  <strong className="font-mono text-sm text-[#14352A]">
                    {systemHealth?.database?.recordsTotal?.auditLogs || 0}
                  </strong>
                </div>
              </div>
            </div>

            <button
              onClick={handlePing}
              disabled={pingTesting}
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#14352A] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {pingTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-[#E0B970]" />}
              <span>{pingTesting ? 'Mengukur Latensi...' : 'Uji Latensi Database (Live Ping)'}</span>
            </button>

            {pingResult && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 font-mono text-center">
                Latensi Respon DB: <strong>{pingResult.latencyMs} ms</strong> ({pingResult.status})
              </div>
            )}
          </div>

          {/* Cloud Storage Contabo */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Cloud className="w-5 h-5 text-[#B58B3C]" />
              <h3 className="text-sm font-bold font-display text-[#1C2321]">Storage Vault (Contabo S3)</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 space-y-1.5">
                <span className="text-[10px] font-bold text-[#6B7A72] uppercase">Provider Storage</span>
                <strong className="block font-display text-[#1C2321]">
                  {systemHealth?.storage?.provider || 'Contabo S3 Object Storage Vault'}
                </strong>
                <span className="font-mono text-[11px] text-[#6B7A72] block">
                  Bucket: {systemHealth?.storage?.bucket || 'crm-yts-vault'}
                </span>
              </div>

              <div className="p-3 bg-[#FBF9F4] rounded-xl border border-[#1B4332]/10 space-y-1.5">
                <span className="text-[10px] font-bold text-[#6B7A72] uppercase">Kebijakan Akses Berkas</span>
                <p className="text-[11px] text-[#3D4A44]">
                  {systemHealth?.storage?.accessControl || 'Private Bucket (15-Min Signed URLs Only)'}
                </p>
                <span className="text-[10px] text-[#6B7A72] block">
                  MIME Allowlist: PDF, JPG, PNG, WEBP (Max 10 MB)
                </span>
              </div>
            </div>
          </div>

          {/* Security & Audit Policies */}
          <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1B4332]/10">
              <Shield className="w-5 h-5 text-[#14352A]" />
              <h3 className="text-sm font-bold font-display text-[#1C2321]">Kebijakan Keamanan &amp; Audit</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1">
                <strong className="text-emerald-950 font-bold block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Append-Only Audit Trail</span>
                </strong>
                <p className="text-emerald-800 text-[11px]">
                  Seluruh mutasi data tercatat secara permanen tanpa opsi hapus/edit.
                </p>
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1">
                <strong className="text-blue-950 font-bold block flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-700" />
                  <span>Segregation of Duties</span>
                </strong>
                <p className="text-blue-800 text-[11px]">
                  Pemisahan ketat hak input fundraising vs verifikasi finance.
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1">
                <strong className="text-amber-950 font-bold block flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>HMAC-SHA256 Token TTL</span>
                </strong>
                <p className="text-amber-800 text-[11px]">
                  Sesi login aman dengan auto-refresh token 24 jam.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. TAB 7: PERSONALISASI TEMA */}
      {activeTab === 'theme' && (
        <div className="p-6 bg-white rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#1B4332]" />
              <div>
                <h3 className="text-sm font-bold font-display text-[#1C2321]">Palet &amp; Tema Tampilan Visual CRM</h3>
                <p className="text-[11px] text-[#6B7A72]">Sesuaikan nuansa warna sistem dengan preferensi visual Anda.</p>
              </div>
            </div>

            <button
              onClick={() => {
                resetToDefault();
                showToast('Tema visual dikembalikan ke default Yayasan Tarbiyah Sunnah (Warm Cream).');
              }}
              className="px-3 py-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#14352A] text-xs font-bold rounded-xl border border-[#1B4332]/14 inline-flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(THEME_PRESETS).map((t) => {
              const isSelected = themeId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setThemeId(t.id as ThemeId);
                    showToast(`Tema diubah ke: ${t.name}`);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                    isSelected
                      ? 'border-[#1B4332] bg-[#FBF9F4] ring-2 ring-[#1B4332]/30 shadow-md'
                      : 'border-[#1B4332]/14 bg-white hover:border-[#1B4332]/40 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold font-display text-[#1C2321]">{t.name}</strong>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#1B4332]" />}
                  </div>

                  {/* Color Chips */}
                  <div className="flex items-center gap-1.5">
                    {t.swatches?.map((color, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-lg border border-black/10 shadow-inner"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <p className="text-[10px] text-[#6B7A72] line-clamp-2">{t.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 10. MODALS */}

      {/* Modal 1: Tambah Pengguna Staf Baru */}
      {newUserModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#1B4332]/20 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#1B4332]" />
                <h3 className="text-base font-bold font-display text-[#1C2321]">Tambah Pengguna Staf Baru</h3>
              </div>
              <button
                onClick={() => setNewUserModal(false)}
                className="p-1.5 text-[#6B7A72] hover:text-[#1C2321] rounded-lg hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Nama Lengkap Staf</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                  placeholder="Contoh: Fulan bin Fulan"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Alamat Email Staf</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  placeholder="fulan@tarbiyahsunnah.id"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none shadow-2xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1.5">Pilih Peran Kewenangan (Bisa Lebih Dari 1)</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {AVAILABLE_ROLES.map((r) => {
                    const isChecked = newUserRoles.includes(r.code);
                    return (
                      <label
                        key={r.code}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs transition-all ${
                          isChecked
                            ? 'bg-[#FBF9F4] border-[#1B4332] ring-1 ring-[#1B4332]'
                            : 'bg-white border-[#1B4332]/14 hover:bg-[#FBF9F4]'
                        }`}
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
                          className="mt-0.5 rounded text-[#1B4332] focus:ring-[#1B4332]"
                        />
                        <div>
                          <strong className="font-bold text-[#1C2321] block font-display">{r.name}</strong>
                          <span className="text-[10px] text-[#6B7A72]">{r.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/10">
                <button
                  type="button"
                  onClick={() => setNewUserModal(false)}
                  className="px-4 py-2 bg-[#F2EEE4] text-[#14352A] font-bold text-xs rounded-xl hover:bg-[#EAE4D6]"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {creatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Daftarkan Staf</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Roles Pengguna */}
      {selectedUserForRoleEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#1B4332]/20 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <div>
                <h3 className="text-base font-bold font-display text-[#1C2321]">
                  Edit Peran Akses: {selectedUserForRoleEdit.fullName}
                </h3>
                <p className="text-xs text-[#6B7A72] font-mono">{selectedUserForRoleEdit.email}</p>
              </div>
              <button
                onClick={() => setSelectedUserForRoleEdit(null)}
                className="p-1.5 text-[#6B7A72] hover:text-[#1C2321] rounded-lg hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {AVAILABLE_ROLES.map((r) => {
                const isChecked = editRolesList.includes(r.code);
                return (
                  <label
                    key={r.code}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer text-xs transition-all ${
                      isChecked
                        ? 'bg-[#FBF9F4] border-[#1B4332] ring-1 ring-[#1B4332]'
                        : 'bg-white border-[#1B4332]/14 hover:bg-[#FBF9F4]'
                    }`}
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
                      className="mt-0.5 rounded text-[#1B4332] focus:ring-[#1B4332]"
                    />
                    <div>
                      <strong className="font-bold text-[#1C2321] block font-display">{r.name}</strong>
                      <span className="text-[10px] text-[#6B7A72]">{r.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/10">
              <button
                type="button"
                onClick={() => setSelectedUserForRoleEdit(null)}
                className="px-4 py-2 bg-[#F2EEE4] text-[#14352A] font-bold text-xs rounded-xl hover:bg-[#EAE4D6]"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={savingRoles}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingRoles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan Peran</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Tambah / Edit Rekening Bank */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#1B4332]/20 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <h3 className="text-base font-bold font-display text-[#1C2321]">
                {editingBankIndex !== null ? 'Edit Rekening Bank' : 'Tambah Rekening Bank Baru'}
              </h3>
              <button
                onClick={() => setBankModalOpen(false)}
                className="p-1.5 text-[#6B7A72] hover:text-[#1C2321] rounded-lg hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Nama Bank</label>
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  required
                  placeholder="Contoh: Bank Syariah Indonesia (BSI)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                  required
                  placeholder="Contoh: 7123456789"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Nama Pemilik Rekening (a.n.)</label>
                <input
                  type="text"
                  value={bankForm.accountHolder}
                  onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                  required
                  placeholder="Contoh: Yayasan Tarbiyah Sunnah (Operasional)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Kantor Cabang</label>
                <input
                  type="text"
                  value={bankForm.branch}
                  onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })}
                  required
                  placeholder="Contoh: KCP Bandung Dago"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/10">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="px-4 py-2 bg-[#F2EEE4] text-[#14352A] font-bold text-xs rounded-xl hover:bg-[#EAE4D6]"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Rekening</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Tambah Program Infaq Baru */}
      {newProgramModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#1B4332]/20 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <h3 className="text-base font-bold font-display text-[#1C2321]">Tambah Program Infaq Baru</h3>
              <button
                onClick={() => setNewProgramModal(false)}
                className="p-1.5 text-[#6B7A72] hover:text-[#1C2321] rounded-lg hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProgram} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Kode Program (Singkatan)</label>
                <input
                  type="text"
                  value={newProgramCode}
                  onChange={(e) => setNewProgramCode(e.target.value.toUpperCase())}
                  required
                  placeholder="Contoh: DAKWAH_MEDIA"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Nama Lengkap Program</label>
                <input
                  type="text"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  required
                  placeholder="Contoh: Operasional Dakwah &amp; Radio Streaming"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/10">
                <button
                  type="button"
                  onClick={() => setNewProgramModal(false)}
                  className="px-4 py-2 bg-[#F2EEE4] text-[#14352A] font-bold text-xs rounded-xl hover:bg-[#EAE4D6]"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={creatingProgram}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {creatingProgram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Tambah Program</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Tambah Master Tag Baru */}
      {newTagModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#1B4332]/20 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B4332]/10">
              <h3 className="text-base font-bold font-display text-[#1C2321]">Tambah Master Label Tag</h3>
              <button
                onClick={() => setNewTagModal(false)}
                className="p-1.5 text-[#6B7A72] hover:text-[#1C2321] rounded-lg hover:bg-[#F2EEE4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTag} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Nama Label Tag</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  required
                  placeholder="Contoh: Kajian Kitab Tauhid"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C2321] mb-1">Kategori Tag</label>
                <select
                  value={newTagCategory}
                  onChange={(e) => setNewTagCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#1B4332]/20 focus:ring-2 focus:ring-[#1B4332] outline-none font-bold"
                >
                  <option value="minat_kajian">Minat Kajian</option>
                  <option value="profesi">Profesi / Pekerjaan</option>
                  <option value="keahlian">Keahlian / Skill</option>
                  <option value="segmentasi">Segmentasi</option>
                  <option value="wilayah">Domisili / Wilayah</option>
                  <option value="lainnya">Lain-lain</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1B4332]/10">
                <button
                  type="button"
                  onClick={() => setNewTagModal(false)}
                  className="px-4 py-2 bg-[#F2EEE4] text-[#14352A] font-bold text-xs rounded-xl hover:bg-[#EAE4D6]"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={creatingTag}
                  className="px-4 py-2 bg-[#B58B3C] hover:bg-[#9E7830] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {creatingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Tambah Tag</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
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
