import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Building2,
  Tags,
  Server,
  KeyRound,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Landmark,
  Database,
  Cloud,
  Check,
} from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ code: string; name: string }>;
}

interface FoundationInfo {
  foundationName: string;
  skKemenkumham: string;
  headOfficeAddress: string;
  officialPhone: string;
  officialEmail: string;
  officialWebsite: string;
  bankAccounts: Array<{
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    branch: string;
  }>;
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

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'foundation' | 'taxonomy' | 'system'>('profile');
  
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

  // Foundation State
  const [foundation, setFoundation] = useState<FoundationInfo | null>(null);
  const [savingFoundation, setSavingFoundation] = useState(false);
  const [foundationSuccess, setFoundationSuccess] = useState(false);

  // Taxonomy State
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [newProgramModal, setNewProgramModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramCode, setNewProgramCode] = useState('');

  // System Diagnostics State
  const [systemHealth, setSystemHealth] = useState<any>(null);

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
        alert('Profil berhasil diperbarui!');
        fetchProfile();
      }
    } catch (err) {
      console.error(err);
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
        setPasswordMsg({ text: 'Kata sandi berhasil diubah!', type: 'success' });
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
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
        alert('Staf baru berhasil didaftarkan!');
        setNewUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error?.message || 'Gagal mendaftarkan staf');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      const res = await fetch(`/api/settings/users/${userId}/status`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

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
        setTimeout(() => setFoundationSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFoundation(false);
    }
  };

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
        setNewProgramModal(false);
        setNewProgramName('');
        setNewProgramCode('');
        fetchTaxonomy();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleProgram = async (programId: string) => {
    try {
      const res = await fetch(`/api/settings/programs/${programId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        fetchTaxonomy();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Server className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem & Tata Kelola</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Konfigurasi profil pengguna, hak akses tim amil, master data dakwah, profil yayasan, dan kesehatan infrastruktur server.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchProfile(); fetchUsers(); fetchFoundation(); fetchTaxonomy(); fetchSystemHealth(); }}
            className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'profile'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4" />
          Profil & Keamanan Akun
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'users'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Manajemen Pengguna & Peran ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('foundation')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'foundation'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Profil Yayasan & Rekening
        </button>
        <button
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'taxonomy'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tags className="w-4 h-4" />
          Master Data & Taksonomi
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'system'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Server className="w-4 h-4" />
          Status Diagnostik & Storage
        </button>
      </div>

      {/* 1. TAB: PROFILE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold border-2 border-emerald-300">
                {profile?.fullName ? profile.fullName.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{profile?.fullName || 'Pengguna'}</h2>
                <p className="text-sm text-slate-500">{profile?.email || '-'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile?.roles?.map((r: string) => (
                    <span key={r} className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Ubah Data Pribadi</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullNameInput(e.target.value)}
                  placeholder="Nama Lengkap Anda"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
              <KeyRound className="w-5 h-5 text-emerald-600" />
              Keamanan & Ganti Kata Sandi
            </div>
            <p className="text-xs text-slate-500">
              Pastikan kata sandi Anda mengandung minimal 8 karakter dengan kombinasi huruf dan angka.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMsg && (
                <div
                  className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                    passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {passwordMsg.text}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Perbarui Kata Sandi
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. TAB: USERS & RBAC */}
      {activeTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daftar Pengguna Internal Yayasan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengelolaan akun staf, hak akses per peran (*Role-Based Access Control*), dan status keaktifan.
              </p>
            </div>

            <button
              onClick={() => setNewUserModal(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Staf Baru
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Nama Lengkap & Email</th>
                  <th className="py-3 px-4">Peran / Otoritas</th>
                  <th className="py-3 px-4">Status Akun</th>
                  <th className="py-3 px-4">Login Terakhir</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r.code} className="px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-800 font-medium">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.isActive ? 'Aktif' : 'Nonaktif (Suspended)'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleUserStatus(u.id)}
                        className={`text-xs px-2.5 py-1 rounded font-medium border transition-colors ${
                          u.isActive
                            ? 'border-rose-300 text-rose-700 hover:bg-rose-50'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Identitas Resmi Yayasan & Rekening Bank</h2>
              <p className="text-xs text-slate-500">Data legalitas, alamat kantor, kontak, dan nomor rekening peruntukan dakwah.</p>
            </div>
            {foundationSuccess && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                <Check className="w-4 h-4" /> Berhasil Disimpan
              </span>
            )}
          </div>

          <form onSubmit={handleSaveFoundation} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Yayasan</label>
                <input
                  type="text"
                  value={foundation.foundationName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, foundationName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">SK Kemenkumham / Legalitas</label>
                <input
                  type="text"
                  value={foundation.skKemenkumham}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, skKemenkumham: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Telepon / WhatsApp Resmi</label>
                <input
                  type="text"
                  value={foundation.officialPhone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialPhone: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Resmi</label>
                <input
                  type="email"
                  value={foundation.officialEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialEmail: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Alamat Kantor Pusat</label>
                <input
                  type="text"
                  value={foundation.headOfficeAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, headOfficeAddress: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Website Resmi</label>
                <input
                  type="url"
                  value={foundation.officialWebsite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoundation({ ...foundation, officialWebsite: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" />
                Daftar Rekening Bank Penampung Donasi & Wakaf
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {foundation.bankAccounts?.map((b, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <span className="font-bold text-emerald-800 block text-sm">{b.bankName}</span>
                    <p className="font-mono text-base font-bold text-slate-900">{b.accountNumber}</p>
                    <p className="text-slate-700">a.n. <span className="font-semibold">{b.accountHolder}</span></p>
                    <p className="text-slate-500">Cabang: {b.branch}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingFoundation}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Program Penyaluran Infaq Dakwah</h3>
                <p className="text-xs text-slate-500">Kategori program donasi untuk pelaporan keuangan.</p>
              </div>
              <button
                onClick={() => setNewProgramModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>

            <div className="space-y-2">
              {programs.map((p) => (
                <div
                  key={p.id}
                  className="p-3 border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{p.name}</span>
                    <span className="font-mono text-slate-500">Kode: {p.code}</span>
                  </div>

                  <button
                    onClick={() => handleToggleProgram(p.id)}
                    className={`px-2.5 py-1 rounded font-semibold text-xs border ${
                      p.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {p.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Label Tag & Segmentasi Jamaah</h3>
                <p className="text-xs text-slate-500">Penandaan minat kajian, profesi, dan keahlian.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {tagsList.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t.name}
                  <span className="text-[10px] text-slate-500 font-normal">({t.category})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB: SYSTEM DIAGNOSTICS */}
      {activeTab === 'system' && systemHealth && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Database className="w-5 h-5 text-emerald-600" />
              Database Serverless & RLS Context
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Database Engine:</span>
                <span className="font-semibold text-slate-900">{systemHealth.database?.engine}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Connection Pooling:</span>
                <span className="font-semibold text-emerald-700">{systemHealth.database?.connectionPooling}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">PITR Backup Recovery:</span>
                <span className="font-semibold text-emerald-700">{systemHealth.database?.pitrRecovery}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Total Jamaah Terdaftar:</span>
                <span className="font-bold text-slate-900">{systemHealth.database?.recordsTotal?.persons}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Cloud className="w-5 h-5 text-emerald-600" />
              Storage Vault (Contabo S3 Abstraction)
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Storage Provider:</span>
                <span className="font-semibold text-slate-900">{systemHealth.storage?.provider}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Target S3 Bucket:</span>
                <span className="font-mono font-semibold text-slate-800">{systemHealth.storage?.bucket}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">MIME Allowlist:</span>
                <span className="font-semibold text-slate-800">{systemHealth.storage?.mimeAllowlist?.join(', ')}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Akses Berkas Privat:</span>
                <span className="font-semibold text-emerald-700">{systemHealth.storage?.accessControl}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Staf Baru */}
      {newUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Tambah Staf Internal Baru</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserName(e.target.value)}
                  placeholder="Nama Staf"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUserEmail(e.target.value)}
                  placeholder="staf@tarbiyahsunnah.id"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Peran Akses Utama</label>
                <select
                  value={newUserRoles[0]}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUserRoles([e.target.value])}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="cs_officer">CS Jamaah Care</option>
                  <option value="data_steward">Data Steward</option>
                  <option value="event_admin">Admin Kajian & Acara</option>
                  <option value="fundraising_officer">Fundraising Officer</option>
                  <option value="waqf_officer">Wakaf Officer</option>
                  <option value="finance_verifier">Finance Verifier</option>
                  <option value="crm_admin">CRM Super Admin</option>
                  <option value="leadership_viewer">Pimpinan (Viewer)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewUserModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Daftarkan Staf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Program Donasi */}
      {newProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Tambah Program Penyaluran Infaq</h3>
            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Program</label>
                <input
                  type="text"
                  value={newProgramName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgramName(e.target.value)}
                  placeholder="Contoh: Operasional Dakwah Sunnah"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kode Unik Program</label>
                <input
                  type="text"
                  value={newProgramCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgramCode(e.target.value)}
                  placeholder="Contoh: DAKWAH_RUTIN"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewProgramModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Simpan Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
