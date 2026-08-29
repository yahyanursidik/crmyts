import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiClient } from '@/lib/apiClient';
import {
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  MapPin,
  Mail,
  ArrowRightLeft,
  Send,
  Calendar,
  PhoneCall,
  Briefcase,
  Copy,
  Check,
  Search,
  Download,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatPhoneDisplay } from '@/lib/phone';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  rawDescription?: string;
  taskType: 'kunjungan' | 'telepon' | 'whatsapp' | 'administrasi';
  visitLocation?: string | null;
  status: 'pending' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  priority: string;
  dueAt: string;
  isOverdue: boolean;
  waVisitationMessage?: string;
  waDirectUrl?: string | null;
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string;
    email?: string;
    cityRegency?: string;
  } | null;
  owner?: {
    id: string;
    fullName: string;
    email?: string;
  } | null;
}

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
}

interface PersonOption {
  id: string;
  fullName: string;
  phoneE164?: string;
  cityRegency?: string;
  engagementStatus?: string;
}

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'JM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return (parts[0] || 'JM').substring(0, 2).toUpperCase();
  const first = parts[0] || 'J';
  const last = parts[parts.length - 1] || 'M';
  return ((first[0] || 'J') + (last[0] || 'M')).toUpperCase();
}

export const TasksListPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 1,
  });

  // KPI Stats
  const [stats, setStats] = useState({
    totalAll: 0,
    pendingCount: 0,
    overdueCount: 0,
    completedCount: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'kunjungan' | 'whatsapp' | 'telepon' | 'administrasi'>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'waiting' | 'completed'>('all');
  const [activePriorityFilter, setActivePriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');
  const [activeStaffFilter, setActiveStaffFilter] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Staff and Person Selection
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [personCandidates, setPersonCandidates] = useState<PersonOption[]>([]);
  const [searchingPersons, setSearchingPersons] = useState(false);

  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    taskType: 'kunjungan' as 'kunjungan' | 'telepon' | 'whatsapp' | 'administrasi',
    personId: '',
    ownerUserId: '',
    priority: 'high' as 'urgent' | 'high' | 'medium' | 'low',
    dueAt: new Date(Date.now() + 86400000).toISOString().substring(0, 16),
    visitLocation: '',
  });

  // Reassign Modal
  const [reassignModal, setReassignModal] = useState<TaskItem | null>(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Email Dispatch Modal
  const [emailModal, setEmailModal] = useState<TaskItem | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [dispatchingEmail, setDispatchingEmail] = useState(false);

  // Delete Dialog
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy notification
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load Tasks
  const loadTasks = async (pageToFetch = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', pageToFetch.toString());
      params.append('pageSize', pagination.pageSize.toString());
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (activeTypeFilter !== 'all') params.append('taskType', activeTypeFilter);
      if (activeStatusFilter !== 'all') params.append('status', activeStatusFilter);
      if (activePriorityFilter !== 'all') params.append('priority', activePriorityFilter);
      if (activeStaffFilter !== 'all') params.append('ownerUserId', activeStaffFilter);
      if (onlyOverdue) params.append('isOverdue', 'true');

      const res = await apiClient<TaskItem[]>(`/tasks?${params.toString()}`);
      setTasks(res.data || []);

      if (res.meta?.pagination) {
        setPagination(res.meta.pagination as any);
      }
      if ((res.meta as any)?.stats) {
        setStats((res.meta as any).stats);
      }
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      setError(err.message || 'Gagal memuat daftar tugas');
    } finally {
      setLoading(false);
    }
  };

  // Load Metadata
  const loadStaffAndMetadata = async () => {
    try {
      const staffRes = await apiClient<StaffUser[]>('/tasks/staff-list');
      if (staffRes.data) setStaffList(staffRes.data);
    } catch (err) {
      console.warn('Failed to load staff list:', err);
    }
  };

  useEffect(() => {
    loadStaffAndMetadata();
  }, []);

  useEffect(() => {
    loadTasks(1);
  }, [
    debouncedSearch,
    activeTypeFilter,
    activeStatusFilter,
    activePriorityFilter,
    activeStaffFilter,
    onlyOverdue,
    pagination.pageSize,
  ]);

  // Live Autocomplete for Person in Create Modal
  useEffect(() => {
    if (!personSearch.trim() || selectedPerson) {
      setPersonCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingPersons(true);
        const res = await apiClient<PersonOption[]>(`/persons?search=${encodeURIComponent(personSearch.trim())}&pageSize=5`);
        setPersonCandidates(res.data || []);
      } catch (err) {
        console.warn('Person search error:', err);
      } finally {
        setSearchingPersons(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [personSearch, selectedPerson]);

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      await apiClient(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadTasks(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status tugas');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateSubmitting(true);
      const payload: any = {
        title: newTask.title.trim(),
        description: newTask.description?.trim() || null,
        taskType: newTask.taskType,
        priority: newTask.priority,
        dueAt: new Date(newTask.dueAt).toISOString(),
      };

      if (selectedPerson) payload.personId = selectedPerson.id;
      if (newTask.ownerUserId) payload.ownerUserId = newTask.ownerUserId;
      if (newTask.visitLocation) payload.visitLocation = newTask.visitLocation.trim();

      await apiClient('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowModal(false);
      setSelectedPerson(null);
      setPersonSearch('');
      setNewTask({
        title: '',
        description: '',
        taskType: 'kunjungan',
        personId: '',
        ownerUserId: '',
        priority: 'high',
        dueAt: new Date(Date.now() + 86400000).toISOString().substring(0, 16),
        visitLocation: '',
      });
      loadTasks(1);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan tugas');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal || !newOwnerId) return;

    try {
      setReassignSubmitting(true);
      await apiClient(`/tasks/${reassignModal.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          newOwnerUserId: newOwnerId,
          reason: reassignReason.trim(),
        }),
      });

      setReassignModal(null);
      setReassignReason('');
      setNewOwnerId('');
      loadTasks(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal menugaskan ulang tugas');
    } finally {
      setReassignSubmitting(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModal || !recipientEmail) return;

    setDispatchingEmail(true);
    try {
      const res = await apiClient<{ message: string }>(`/tasks/${emailModal.id}/dispatch-email`, {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail,
          notes: 'Notifikasi penugasan kunjungan silaturahmi Tarbiyah Sunnah',
        }),
      });

      setEmailSuccessMsg(res.data?.message || 'Email berhasil dikirim');
      setTimeout(() => {
        setEmailSuccessMsg(null);
        setEmailModal(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim email tugas');
    } finally {
      setDispatchingEmail(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      setDeleteLoading(true);
      await apiClient(`/tasks/${taskToDelete.id}`, { method: 'DELETE' });
      setTaskToDelete(null);
      loadTasks(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus tugas');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyMessage = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (tasks.length === 0) {
      alert('Tidak ada data tugas untuk diekspor');
      return;
    }

    const headers = ['Judul Tugas', 'Kanal', 'Target Jamaah', 'Nomor Telepon', 'PIC', 'Prioritas', 'Batas Waktu', 'Status'];
    const rows = tasks.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.taskType}"`,
      `"${t.person?.fullName || '-'}"`,
      `"${t.person?.phoneE164 || '-'}"`,
      `"${t.owner?.fullName || 'Belum ditugaskan'}"`,
      `"${t.priority}"`,
      `"${new Date(t.dueAt).toLocaleString('id-ID')}"`,
      `"${t.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agenda-tugas-followup-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActiveTypeFilter('all');
    setActiveStatusFilter('all');
    setActivePriorityFilter('all');
    setActiveStaffFilter('all');
    setOnlyOverdue(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#C77A16]/10 text-[#C77A16] border border-[#C77A16]/25 inline-flex items-center gap-1 uppercase">
            <Clock className="w-3 h-3" /> Belum Dihubungi
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#0F4C4A]/10 text-[#0F4C4A] border border-[#0F4C4A]/25 inline-flex items-center gap-1 uppercase">
            <MessageSquare className="w-3 h-3" /> Proses Tindak Lanjut
          </span>
        );
      case 'waiting':
        return (
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#B58B3C]/15 text-[#8E6B22] border border-[#B58B3C]/30 inline-flex items-center gap-1 uppercase">
            <Clock className="w-3 h-3" /> Menunggu Respon
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 inline-flex items-center gap-1 uppercase">
            <CheckCircle2 className="w-3 h-3" /> Selesai
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/12 uppercase">
            Dibatalkan
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 uppercase">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold bg-[#C77A16]/10 text-[#C77A16] border border-[#C77A16]/25 uppercase">Tinggi</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">Sedang</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#F2EEE4] text-[#6B7A72] border border-[#1B4332]/10 uppercase">Rendah</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'kunjungan':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Kunjungan
          </span>
        );
      case 'telepon':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#0F4C4A]/10 text-[#0F4C4A] border border-[#0F4C4A]/25 inline-flex items-center gap-1">
            <PhoneCall className="w-3 h-3" /> Telepon
          </span>
        );
      case 'whatsapp':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#2F7D4F]/10 text-[#2F7D4F] border border-[#2F7D4F]/25 inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> WhatsApp
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F2EEE4] text-[#3D4A44] border border-[#1B4332]/12 inline-flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Administrasi
          </span>
        );
    }
  };

  const isAnyFilterActive = Boolean(
    debouncedSearch ||
    activeTypeFilter !== 'all' ||
    activeStatusFilter !== 'all' ||
    activePriorityFilter !== 'all' ||
    activeStaffFilter !== 'all' ||
    onlyOverdue
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* 1. Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1B4332]/12 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C2321] font-display">
              Manajemen Amanah &amp; Agenda Tugas
            </h1>
            <span className="text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-[#1B4332]/10 text-[#14352A] border border-[#1B4332]/20 uppercase">
              FOLLOW-UP CS · SILATURAHMI · DISPATCH TUGAS
            </span>
          </div>
          <p className="text-xs text-[#6B7A72] mt-1 font-normal">
            Pusat koordinasi penugasan staf, silaturahmi kunjungan, follow-up donatur, dan pendampingan dakwah.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] border border-[#1B4332]/12 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-98"
            title="Ekspor daftar tugas ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7A72]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 text-[#E0B970]" />
            <span>+ Buat Amanah Tugas Baru</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Interactive Alert Strip KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Tugas */}
        <div
          onClick={() => { resetAllFilters(); }}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#1B4332] space-y-1 transition-all cursor-pointer ${
            !isAnyFilterActive ? 'ring-2 ring-[#1B4332]/30 border-[#1B4332]' : 'border-[#1B4332]/12 hover:border-[#1B4332]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#1B4332] tracking-wider uppercase flex items-center justify-between">
            <span>TOTAL AMANAH TUGAS</span>
            <Briefcase className="w-3.5 h-3.5 text-[#1B4332]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.totalAll.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72]">
            Seluruh Agenda Tindak Lanjut
          </div>
        </div>

        {/* 2. Menunggu / Pending */}
        <div
          onClick={() => setActiveStatusFilter(activeStatusFilter === 'pending' ? 'all' : 'pending')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#0F4C4A] space-y-1 transition-all cursor-pointer ${
            activeStatusFilter === 'pending' ? 'ring-2 ring-[#0F4C4A]/50 border-[#0F4C4A]' : 'border-[#1B4332]/12 hover:border-[#0F4C4A]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#0F4C4A] tracking-wider uppercase flex items-center justify-between">
            <span>MENUNGGU / BERJALAN</span>
            <Clock className="w-3.5 h-3.5 text-[#0F4C4A]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.pendingCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Belum Selesai Dikerjakan</span>
            {activeStatusFilter === 'pending' && <span className="text-[9.5px] font-mono font-bold text-[#0F4C4A]">✓ Filter</span>}
          </div>
        </div>

        {/* 3. Terlambat / Overdue */}
        <div
          onClick={() => setOnlyOverdue(!onlyOverdue)}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#C77A16] space-y-1 transition-all cursor-pointer ${
            onlyOverdue ? 'ring-2 ring-[#C77A16]/50 border-[#C77A16]' : 'border-[#1B4332]/12 hover:border-[#C77A16]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#C77A16] tracking-wider uppercase flex items-center justify-between">
            <span>TERLAMBAT (OVERDUE)</span>
            <AlertCircle className="w-3.5 h-3.5 text-[#C77A16]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.overdueCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Melewati Batas Waktu</span>
            {onlyOverdue && <span className="text-[9.5px] font-mono font-bold text-[#C77A16]">✓ Filter</span>}
          </div>
        </div>

        {/* 4. Selesai */}
        <div
          onClick={() => setActiveStatusFilter(activeStatusFilter === 'completed' ? 'all' : 'completed')}
          className={`p-4 bg-[#FBF9F4] border rounded-xl shadow-2xs border-l-[3px] border-l-[#2F7D4F] space-y-1 transition-all cursor-pointer ${
            activeStatusFilter === 'completed' ? 'ring-2 ring-[#2F7D4F]/50 border-[#2F7D4F]' : 'border-[#1B4332]/12 hover:border-[#2F7D4F]/40'
          }`}
        >
          <div className="font-mono text-[10.5px] font-semibold text-[#2F7D4F] tracking-wider uppercase flex items-center justify-between">
            <span>SELESAI DIKERJAKAN</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F]" />
          </div>
          <div className="text-2xl sm:text-[28px] font-bold font-display text-[#1C2321] leading-none">
            {stats.completedCount.toLocaleString('id-ID')}
          </div>
          <div className="text-[11.5px] text-[#6B7A72] flex items-center justify-between">
            <span>Telah Tuntas Dilaporkan</span>
            {activeStatusFilter === 'completed' && <span className="text-[9.5px] font-mono font-bold text-[#2F7D4F]">✓ Filter</span>}
          </div>
        </div>
      </div>

      {/* 3. Task Type Tabs */}
      <div className="flex items-center gap-1 bg-[#F2EEE4] p-1 rounded-xl border border-[#1B4332]/12 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'all', label: 'Semua Agenda', icon: Calendar },
          { id: 'kunjungan', label: 'Kunjungan Silaturahmi', icon: MapPin },
          { id: 'whatsapp', label: 'WhatsApp Follow-up', icon: MessageSquare },
          { id: 'telepon', label: 'Panggilan Telepon', icon: PhoneCall },
          { id: 'administrasi', label: 'Administrasi', icon: Briefcase },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTypeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTypeFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#1B4332] text-white shadow-2xs font-bold'
                  : 'text-[#3D4A44] hover:text-[#14352A] hover:bg-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="bg-[#FBF9F4] p-4 rounded-2xl border border-[#1B4332]/12 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9690] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul tugas, catatan tindak lanjut, atau nama jamaah..."
              className="w-full pl-10 pr-9 py-2 text-xs font-medium border border-[#1B4332]/14 rounded-xl focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9690] hover:text-[#1C2321] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadTasks(1)}
            disabled={loading}
            className="p-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#3D4A44] rounded-xl border border-[#1B4332]/12 transition-all flex items-center gap-1 text-xs font-semibold px-3"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#1B4332]/8 text-xs">
          <div>
            <select
              value={activeStatusFilter}
              onChange={(e) => setActiveStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="all">Semua Status Pengerjaan</option>
              <option value="pending">⏳ Belum Dihubungi (Pending)</option>
              <option value="in_progress">💬 Proses Tindak Lanjut</option>
              <option value="waiting">🕒 Menunggu Respon</option>
              <option value="completed">✅ Selesai Dikerjakan</option>
            </select>
          </div>

          <div>
            <select
              value={activePriorityFilter}
              onChange={(e) => setActivePriorityFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="all">Semua Tingkat Prioritas</option>
              <option value="urgent">🔴 Mendesak (Urgent)</option>
              <option value="high">🟠 Tinggi (High)</option>
              <option value="medium">🔵 Sedang (Medium)</option>
              <option value="low">⚪ Rendah (Low)</option>
            </select>
          </div>

          <div>
            <select
              value={activeStaffFilter}
              onChange={(e) => setActiveStaffFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#1B4332]/14 bg-[#FBF9F4] rounded-lg text-xs font-semibold text-[#1C2321] focus:ring-2 focus:ring-[#1B4332] outline-none"
            >
              <option value="all">Semua Staf Penanggung Jawab (PIC)</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  👤 {st.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#1C2321]">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="w-4 h-4 rounded text-[#C77A16] border-[#1B4332]/20 focus:ring-[#C77A16]"
              />
              <span className="text-[#C77A16] font-bold">⚠️ Hanya Overdue</span>
            </label>

            {isAnyFilterActive && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#6B7A72] hover:text-rose-700 font-semibold underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Tasks Table */}
      <div className="bg-[#FBF9F4] rounded-2xl border border-[#1B4332]/12 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16">
            <LoadingState message="Memuat agenda tugas & amanah..." />
          </div>
        ) : error ? (
          <div className="p-6 text-rose-700 text-xs bg-rose-50 border-b border-rose-200">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-[#6B7A72] text-xs space-y-3">
            <div className="w-12 h-12 bg-[#F2EEE4] rounded-xl flex items-center justify-center mx-auto text-[#6B7A72]">
              <Briefcase className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-[#1C2321]">Tidak ada tugas tindak lanjut yang ditemukan</p>
            <p className="text-xs text-[#6B7A72] max-w-sm mx-auto">
              Silakan buat amanah tugas baru atau sesuaikan filter pencarian Anda.
            </p>
            {isAnyFilterActive && (
              <button
                onClick={resetAllFilters}
                className="px-4 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg text-xs font-semibold border border-[#1B4332]/12"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1B4332]/12 bg-[#F2EEE4] text-[#14352A] text-[10.5px] font-mono font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">Status</th>
                  <th className="py-3 px-4">Agenda &amp; Uraian Tugas</th>
                  <th className="py-3 px-4">Target Jamaah</th>
                  <th className="py-3 px-3">Kanal &amp; Prioritas</th>
                  <th className="py-3 px-3">PIC / Petugas</th>
                  <th className="py-3 px-3">Batas Waktu</th>
                  <th className="py-3 px-4 text-right">Aksi &amp; Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B4332]/8 font-medium text-[#1C2321]">
                {tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  const initials = getInitials(task.person?.fullName || 'JM');

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-[#F2EEE4]/50 transition-colors ${
                        task.isOverdue ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Status Checkbox Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(task.id, isDone ? 'pending' : 'completed')}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            isDone
                              ? 'bg-[#2F7D4F] border-[#2F7D4F] text-white'
                              : 'border-[#1B4332]/25 hover:border-[#1B4332] bg-white'
                          }`}
                          title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      </td>

                      {/* Agenda & Uraian */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="space-y-1">
                          <p className={`font-bold text-xs font-display ${isDone ? 'line-through text-[#8A9690]' : 'text-[#1C2321]'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[11px] text-[#6B7A72] line-clamp-1 font-normal">
                              {task.description}
                            </p>
                          )}
                          {task.visitLocation && (
                            <div className="flex items-center gap-1 text-[10px] text-[#14352A] font-semibold">
                              <MapPin className="w-3 h-3 text-[#1B4332]" />
                              <span>{task.visitLocation}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {getStatusBadge(task.status)}
                          </div>
                        </div>
                      </td>

                      {/* Target Jamaah */}
                      <td className="py-3.5 px-4">
                        {task.person ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#1B4332]/10 border border-[#1B4332]/20 flex items-center justify-center font-mono text-[11px] font-bold text-[#14352A] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link
                                to={`/people/${task.person.id}`}
                                className="font-bold text-[#1C2321] hover:text-[#1B4332] block font-display"
                              >
                                {task.person.fullName}
                              </Link>
                              {task.person.phoneE164 && (
                                <div className="flex items-center gap-1 text-[10px] text-[#6B7A72] font-mono">
                                  <span>{formatPhoneDisplay(task.person.phoneE164)}</span>
                                  {task.waDirectUrl && (
                                    <a
                                      href={task.waDirectUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Buka Chat WA Kunjungan"
                                      className="text-[#2F7D4F] hover:bg-[#2F7D4F]/10 p-0.5 rounded"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8A9690] italic">Umum / Internal</span>
                        )}
                      </td>

                      {/* Kanal & Prioritas */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getTypeBadge(task.taskType)}</div>
                          <div>{getPriorityBadge(task.priority)}</div>
                        </div>
                      </td>

                      {/* PIC Staf */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-[#1C2321]">
                            {task.owner?.fullName || 'Belum Ditugaskan'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setReassignModal(task);
                              setNewOwnerId(task.owner?.id || '');
                            }}
                            className="text-[10px] text-[#1B4332] hover:underline font-semibold flex items-center gap-0.5"
                          >
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            <span>Ganti PIC</span>
                          </button>
                        </div>
                      </td>

                      {/* Batas Waktu */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className={`font-mono text-[11px] font-semibold ${task.isOverdue ? 'text-amber-700 font-bold' : 'text-[#1C2321]'}`}>
                            {new Date(task.dueAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-[10px] font-mono text-[#8A9690]">
                            {new Date(task.dueAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} WIB
                          </p>
                          {task.isOverdue && (
                            <span className="inline-flex px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900">
                              ⚠️ Lewat Tempo
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aksi & Dispatch */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Salin Pesan WA Template */}
                          {task.waVisitationMessage && (
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(task.id, task.waVisitationMessage!)}
                              className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg border border-[#1B4332]/12 transition-all text-xs flex items-center gap-1"
                              title="Salin Pesan Konfirmasi Silaturahmi WA"
                            >
                              {copiedId === task.id ? (
                                <Check className="w-3.5 h-3.5 text-[#2F7D4F]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-[#6B7A72]" />
                              )}
                              <span className="hidden xl:inline text-[10.5px] font-semibold">
                                {copiedId === task.id ? 'Tersalin' : 'Salin WA'}
                              </span>
                            </button>
                          )}

                          {/* Dispatch Surat Tugas via Email */}
                          <button
                            type="button"
                            onClick={() => {
                              setEmailModal(task);
                              setRecipientEmail(task.person?.email || task.owner?.email || '');
                            }}
                            className="p-1.5 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-lg border border-[#1B4332]/12 transition-all text-xs"
                            title="Kirim Surat Tugas via Email"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#0F4C4A]" />
                          </button>

                          {/* Hapus Tugas */}
                          <button
                            type="button"
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all"
                            title="Hapus tugas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Pagination Controls */}
        <div className="px-4 py-3 border-t border-[#1B4332]/10 bg-[#F2EEE4]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7A72]">
          <div>
            Menampilkan <strong className="text-[#1C2321]">{tasks.length}</strong> dari{' '}
            <strong className="text-[#1C2321]">{pagination.totalCount.toLocaleString('id-ID')}</strong> agenda amanah
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadTasks(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="font-mono text-xs font-semibold text-[#1C2321] px-2">
              Halaman {pagination.page} dari {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => loadTasks(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="py-1 px-2.5 bg-[#FBF9F4] hover:bg-[#F2EEE4] text-[#1C2321] rounded-lg border border-[#1B4332]/12 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <div>
                <h2 className="text-sm font-bold font-display text-[#1C2321]">
                  Buat Amanah &amp; Penugasan Baru
                </h2>
                <p className="text-xs text-[#6B7A72] mt-0.5">
                  Tugaskan silaturahmi, follow-up donatur, atau agenda kunjungan ke staf yayasan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] hover:bg-[#1B4332]/8 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Judul Tugas */}
              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Judul Agenda / Tugas <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Contoh: Silaturahmi & Penjelasan Wakaf Masjid"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                />
              </div>

              {/* Tipe Tugas & Prioritas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                    Kanal / Tipe Penugasan
                  </label>
                  <select
                    value={newTask.taskType}
                    onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] font-semibold outline-none"
                  >
                    <option value="kunjungan">🕌 Kunjungan Silaturahmi</option>
                    <option value="whatsapp">💬 WhatsApp Follow-up</option>
                    <option value="telepon">📞 Panggilan Telepon</option>
                    <option value="administrasi">📂 Administrasi Internal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-2.5 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] font-semibold outline-none"
                  >
                    <option value="urgent">🔴 Mendesak (Urgent)</option>
                    <option value="high">🟠 Tinggi (High)</option>
                    <option value="medium">🔵 Sedang (Medium)</option>
                    <option value="low">⚪ Rendah (Low)</option>
                  </select>
                </div>
              </div>

              {/* Target Jamaah */}
              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Target Jamaah (Opsional)
                </label>
                {selectedPerson ? (
                  <div className="flex items-center justify-between p-2.5 bg-[#F2EEE4] border border-[#1B4332]/14 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#1B4332] text-white font-mono font-bold text-xs flex items-center justify-center">
                        {getInitials(selectedPerson.fullName)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1C2321]">{selectedPerson.fullName}</p>
                        <p className="text-[10px] text-[#6B7A72]">{selectedPerson.phoneE164 || 'Tanpa telepon'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedPerson(null); setPersonSearch(''); }}
                      className="text-xs text-[#6B7A72] hover:text-rose-700 font-semibold underline"
                    >
                      Ganti
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#8A9690] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      placeholder="Ketik nama jamaah untuk menautkan tugas..."
                      className="w-full pl-9 pr-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] placeholder-[#8A9690] outline-none"
                    />
                    {searchingPersons && (
                      <Loader2 className="w-3.5 h-3.5 text-[#8A9690] animate-spin absolute right-3 top-3" />
                    )}

                    {personCandidates.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-[#FBF9F4] border border-[#1B4332]/14 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-[#1B4332]/8">
                        {personCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedPerson(c);
                              setPersonSearch('');
                              setPersonCandidates([]);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-[#F2EEE4] flex items-center justify-between text-xs transition-colors"
                          >
                            <div>
                              <p className="font-bold text-[#1C2321]">{c.fullName}</p>
                              <p className="text-[10px] font-mono text-[#6B7A72]">{c.phoneE164 || 'Tanpa nomor telepon'}</p>
                            </div>
                            <span className="text-[9.5px] font-mono font-semibold bg-[#1B4332]/10 text-[#14352A] px-2 py-0.5 rounded capitalize">
                              {c.engagementStatus || 'Jamaah'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PIC Penanggung Jawab & Batas Waktu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                    Staf Penanggung Jawab (PIC)
                  </label>
                  <select
                    value={newTask.ownerUserId}
                    onChange={(e) => setNewTask({ ...newTask, ownerUserId: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] font-semibold outline-none"
                  >
                    <option value="">-- Tugaskan ke Diri Sendiri --</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                    Batas Waktu (Due Date) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newTask.dueAt}
                    onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })}
                    className="w-full px-2.5 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                  />
                </div>
              </div>

              {/* Lokasi Kunjungan jika tipe kunjungan */}
              {newTask.taskType === 'kunjungan' && (
                <div>
                  <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                    Lokasi / Alamat Kunjungan
                  </label>
                  <input
                    type="text"
                    value={newTask.visitLocation}
                    onChange={(e) => setNewTask({ ...newTask, visitLocation: e.target.value })}
                    placeholder="Contoh: Jl. Dago No. 12, Bandung atau Kediaman Jamaah"
                    className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                  />
                </div>
              )}

              {/* Uraian / Catatan */}
              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Uraian &amp; Catatan Khusus
                </label>
                <textarea
                  rows={3}
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Jelaskan rincian agenda, poin pembicaraan, atau instruksi amanah..."
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {createSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Simpan &amp; Tugaskan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN MODAL */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <h2 className="text-sm font-bold font-display text-[#1C2321]">
                Penugasan Ulang (Reassign Task)
              </h2>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 text-xs">
                <p className="font-bold text-[#1C2321]">{reassignModal.title}</p>
                <p className="text-[#6B7A72] mt-0.5">
                  PIC Saat Ini: <strong className="text-[#1C2321]">{reassignModal.owner?.fullName || 'Belum ditugaskan'}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Pilih Staf Baru <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] font-semibold outline-none"
                >
                  <option value="">-- Pilih Staf Penanggung Jawab --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Alasan Penugasan Ulang <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Contoh: Petugas sebelumnya sedang dinas luar kota..."
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                />
              </div>

              <div className="pt-2 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignModal(null)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reassignSubmitting}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {reassignSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Simpan Perubahan PIC</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL DISPATCH MODAL */}
      {emailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#1B4332]/20 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#1B4332]/10 flex items-center justify-between bg-[#F2EEE4]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#1B4332]" />
                <h2 className="text-sm font-bold font-display text-[#1C2321]">
                  Kirim Surat Tugas &amp; Notifikasi Email
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="p-1.5 rounded-lg text-[#6B7A72] hover:text-[#1C2321] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-4">
              {emailSuccessMsg && (
                <div className="p-3 bg-[#2F7D4F]/10 border border-[#2F7D4F]/25 text-[#2F7D4F] rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{emailSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1C2321] mb-1">
                  Email Tujuan <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="nama@tarbiyahsunnah.id atau email jamaah"
                  className="w-full px-3 py-2 border border-[#1B4332]/14 rounded-xl text-xs focus:ring-2 focus:ring-[#1B4332] bg-[#F2EEE4] text-[#1C2321] outline-none"
                />
              </div>

              <div className="p-3 bg-[#F2EEE4] rounded-xl border border-[#1B4332]/12 text-xs space-y-1">
                <p className="text-[10px] font-mono font-bold text-[#14352A] uppercase">Ringkasan Surat Tugas:</p>
                <p className="font-bold text-[#1C2321]">{emailModal.title}</p>
                <p className="text-[#6B7A72]">
                  Petugas: <strong className="text-[#1C2321]">{emailModal.owner?.fullName || 'Staf YTS'}</strong>
                </p>
                <p className="text-[#6B7A72]">
                  Target: <strong className="text-[#1C2321]">{emailModal.person?.fullName || 'Bapak/Ibu Jamaah'}</strong>
                </p>
              </div>

              <div className="pt-2 border-t border-[#1B4332]/10 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmailModal(null)}
                  className="px-3.5 py-2 bg-[#F2EEE4] hover:bg-[#EAE4D6] text-[#1C2321] rounded-xl text-xs font-semibold border border-[#1B4332]/12"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={dispatchingEmail}
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#14352A] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
                >
                  {dispatchingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-[#E0B970]" />
                  )}
                  <span>Kirim Email Resmi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(taskToDelete)}
        title="Hapus Amanah Tugas"
        message={
          <div className="space-y-2 text-xs">
            <p>
              Apakah Anda yakin ingin menghapus amanah tugas{' '}
              <strong className="text-[#1C2321] font-bold">{taskToDelete?.title}</strong>?
            </p>
            <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Tindakan ini bersifat permanen dan akan menghapus tugas ini dari jadwal tindak lanjut tim.
            </p>
          </div>
        }
        confirmLabel="Ya, Hapus Tugas"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteTask}
        onClose={() => setTaskToDelete(null)}
      />
    </div>
  );
};
