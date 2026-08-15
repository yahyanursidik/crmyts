import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import {
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  MessageSquare,
  MapPin,
  Mail,
  UserCheck,
  Send,
  Calendar,
  Phone,
  Briefcase,
  Copy,
  Check,
  Filter,
  FileText,
  Hourglass,
} from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
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
  };
  owner?: {
    id: string;
    fullName: string;
    email?: string;
  };
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
}

export const TasksListPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'kunjungan' | 'whatsapp' | 'telepon' | 'administrasi'>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'waiting' | 'completed'>('all');
  
  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [personsList, setPersonsList] = useState<PersonOption[]>([]);
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    taskType: 'kunjungan' as 'kunjungan' | 'telepon' | 'whatsapp' | 'administrasi',
    personId: '',
    ownerUserId: '',
    priority: 'high' as const,
    dueAt: new Date(Date.now() + 86400000).toISOString().substring(0, 16),
    visitLocation: '',
  });

  // Reassign Modal
  const [reassignModal, setReassignModal] = useState<TaskItem | null>(null);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Email Dispatch Modal
  const [emailModal, setEmailModal] = useState<TaskItem | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSuccessMsg, setEmailSuccessMsg] = useState<string | null>(null);
  const [dispatchingEmail, setDispatchingEmail] = useState(false);

  // Copy notification
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await apiClient<TaskItem[]>('/tasks');
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStaffAndPersons = async () => {
    try {
      const [staffRes, personsRes] = await Promise.all([
        fetch('/api/tasks/staff-list').then((r) => r.json()),
        fetch('/api/persons?limit=100').then((r) => r.json()),
      ]);

      if (staffRes.data) setStaffList(staffRes.data);
      if (personsRes.data?.items) setPersonsList(personsRes.data.items);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  useEffect(() => {
    loadTasks();
    loadStaffAndPersons();
  }, []);

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      await apiClient(`/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status tugas');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        title: newTask.title,
        description: newTask.description || null,
        taskType: newTask.taskType,
        priority: newTask.priority,
        dueAt: new Date(newTask.dueAt).toISOString(),
      };

      if (newTask.personId) payload.personId = newTask.personId;
      if (newTask.ownerUserId) payload.ownerUserId = newTask.ownerUserId;
      if (newTask.visitLocation) payload.visitLocation = newTask.visitLocation;

      await apiClient('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowModal(false);
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
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan tugas');
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal || !newOwnerId) return;

    try {
      const res = await fetch(`/api/tasks/${reassignModal.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newOwnerUserId: newOwnerId,
          reason: reassignReason,
        }),
      });

      if (res.ok) {
        setReassignModal(null);
        setReassignReason('');
        setNewOwnerId('');
        loadTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModal || !recipientEmail) return;

    setDispatchingEmail(true);
    try {
      const res = await fetch(`/api/tasks/${emailModal.id}/dispatch-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          notes: 'Notifikasi penugasan kunjungan silaturahmi Tarbiyah Sunnah',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setEmailSuccessMsg(json.data.message);
        setTimeout(() => {
          setEmailSuccessMsg(null);
          setEmailModal(null);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDispatchingEmail(false);
    }
  };

  const handleCopyMessage = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchType = activeTypeFilter === 'all' || t.taskType === activeTypeFilter;
    const matchStatus = activeStatusFilter === 'all' || t.status === activeStatusFilter;
    return matchType && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Belum Dihubungi
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Sudah Dihubungi
          </span>
        );
      case 'waiting':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
            <Hourglass className="w-3 h-3" /> Menunggu Respon
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Selesai
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            Dibatalkan
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Tinggi</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Sedang</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">Rendah</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'kunjungan':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Kunjungan Silaturahmi
          </span>
        );
      case 'telepon':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex items-center gap-1">
            <Phone className="w-3 h-3" /> Telepon
          </span>
        );
      case 'whatsapp':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> WhatsApp
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Administrasi
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-700" />
            Tracking Kontak, Follow-Up & Kunjungan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau status follow-up jamaah (Belum Dihubungi, Sudah, Menunggu, Selesai), catatan khusus, dan agenda kunjungan resmi.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Buat Tugas / Kunjungan Baru
        </button>
      </div>

      {/* Filter Section: Status Lifecycle & Task Type */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Status Lifecycle Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <button
            onClick={() => setActiveStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({tasks.length})
          </button>
          <button
            onClick={() => setActiveStatusFilter('pending')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeStatusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            ⏳ Belum Dihubungi ({tasks.filter((t) => t.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveStatusFilter('in_progress')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeStatusFilter === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            💬 Sudah Dihubungi ({tasks.filter((t) => t.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setActiveStatusFilter('waiting')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeStatusFilter === 'waiting' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            ⌛ Menunggu Respon ({tasks.filter((t) => t.status === 'waiting').length})
          </button>
          <button
            onClick={() => setActiveStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeStatusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            ✅ Selesai ({tasks.filter((t) => t.status === 'completed').length})
          </button>
        </div>

        {/* Task Type Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 shrink-0">
            Kanal:
          </span>
          <button
            onClick={() => setActiveTypeFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTypeFilter === 'all' ? 'bg-slate-200 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Kanal
          </button>
          <button
            onClick={() => setActiveTypeFilter('kunjungan')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTypeFilter === 'kunjungan' ? 'bg-emerald-100 text-emerald-900 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🚗 Kunjungan Silaturahmi ({tasks.filter((t) => t.taskType === 'kunjungan').length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('whatsapp')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTypeFilter === 'whatsapp' ? 'bg-teal-100 text-teal-900 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            💬 WhatsApp ({tasks.filter((t) => t.taskType === 'whatsapp').length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('telepon')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeTypeFilter === 'telepon' ? 'bg-purple-100 text-purple-900 font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📞 Telepon ({tasks.filter((t) => t.taskType === 'telepon').length})
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Memuat agenda tugas tindak lanjut..." />
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          Belum ada agenda tugas pada kombinasi filter ini.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const isKunjungan = task.taskType === 'kunjungan';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all ${
                  isKunjungan
                    ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/30 to-white hover:border-emerald-300'
                    : 'border-slate-200 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-base font-bold ${
                            task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        {getTypeBadge(task.taskType)}
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                        {task.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3" /> Jatuh Tempo
                          </span>
                        )}
                      </div>

                      {/* Catatan Khusus & Deskripsi */}
                      {task.description && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-900 block mb-0.5">Catatan Khusus Follow-Up:</span>
                            <span className="whitespace-pre-line">{task.description}</span>
                          </div>
                        </div>
                      )}

                      {/* Details & Target Jamaah */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-slate-600">
                        {task.person && (
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <span className="text-slate-400">Target Jamaah:</span>
                            <span className="font-bold text-emerald-800">{task.person.fullName}</span>
                            {task.person.phoneE164 && (
                              <span className="text-slate-500 font-mono">({task.person.phoneE164})</span>
                            )}
                            {task.person.cityRegency && <span className="text-slate-500">• {task.person.cityRegency}</span>}
                          </div>
                        )}

                        {task.visitLocation && (
                          <div className="flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Lokasi: {task.visitLocation}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Ditugaskan Kepada:</span>
                          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {task.owner?.fullName || 'Belum ditugaskan'}
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp Template Box for Kunjungan */}
                      {isKunjungan && task.waVisitationMessage && task.person?.phoneE164 && (
                        <div className="mt-3 p-3.5 bg-slate-900 text-emerald-300 rounded-xl text-xs font-mono space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                            <span>Template Pesan Penugasan Kunjungan Resmi Yayasan</span>
                            <button
                              onClick={() => handleCopyMessage(task.id, task.waVisitationMessage!)}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === task.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedId === task.id ? 'Tersalin!' : 'Salin Teks'}
                            </button>
                          </div>
                          <p className="whitespace-pre-line text-slate-200">{task.waVisitationMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar & Status Modifier */}
                  <div className="flex flex-col items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-right text-xs text-slate-500">
                      <div className="flex items-center gap-1 justify-end font-semibold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(task.dueAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB</span>
                      </div>
                    </div>

                    {/* Interactive Status Transition Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-500">Ubah Status:</label>
                      <select
                        value={task.status}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleUpdateStatus(task.id, e.target.value)}
                        className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="pending">⏳ Belum Dihubungi</option>
                        <option value="in_progress">💬 Sudah Dihubungi</option>
                        <option value="waiting">⌛ Menunggu Respon</option>
                        <option value="completed">✅ Selesai</option>
                        <option value="cancelled">❌ Dibatalkan</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Direct WhatsApp (wa.me) Button */}
                      {task.waDirectUrl && (
                        <a
                          href={task.waDirectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center gap-1.5"
                          title="Buka WhatsApp & Kirim Pesan Penugasan Kunjungan Langsung"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim WA (wa.me)</span>
                        </a>
                      )}

                      {/* Dispatch Email Button */}
                      <button
                        onClick={() => {
                          setEmailModal(task);
                          setRecipientEmail(task.person?.email || task.owner?.email || '');
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
                        title="Kirim Info Surat Tugas via Email"
                      >
                        <Mail className="w-3.5 h-3.5" /> Email
                      </button>

                      {/* Reassign Button */}
                      <button
                        onClick={() => {
                          setReassignModal(task);
                          setNewOwnerId(task.owner?.id || '');
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
                        title="Alihkan Tugas ke Staf Lain"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Alihkan PIC
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Buat Agenda Tugas & Penugasan Kunjungan
            </h2>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Tindak Lanjut *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTask({ ...newTask, taskType: 'kunjungan' })}
                    className={`p-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      newTask.taskType === 'kunjungan'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="w-4 h-4" /> Kunjungan Tatap Muka
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTask({ ...newTask, taskType: 'whatsapp' })}
                    className={`p-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      newTask.taskType === 'whatsapp'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Sapaan WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTask({ ...newTask, taskType: 'telepon' })}
                    className={`p-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      newTask.taskType === 'telepon'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Phone className="w-4 h-4" /> Telepon
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTask({ ...newTask, taskType: 'administrasi' })}
                    className={`p-2.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      newTask.taskType === 'administrasi'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" /> Administrasi
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul / Agenda *</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder={
                    newTask.taskType === 'kunjungan'
                      ? 'Contoh: Silaturahmi & Penjelasan Program Wakaf Tanah'
                      : 'Contoh: Sapaan follow-up donatur infaq'
                  }
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Jamaah / Donatur</label>
                  <select
                    value={newTask.personId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTask({ ...newTask, personId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Pilih Jamaah (Opsional) --</option>
                    {personsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} {p.cityRegency ? `(${p.cityRegency})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tugaskan Kepada Staf (PIC) *</label>
                  <select
                    value={newTask.ownerUserId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTask({ ...newTask, ownerUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold text-emerald-800"
                  >
                    <option value="">-- Tugaskan ke Saya Sendiri --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {newTask.taskType === 'kunjungan' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi / Alamat Kunjungan</label>
                  <input
                    type="text"
                    value={newTask.visitLocation}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, visitLocation: e.target.value })}
                    placeholder="Contoh: Jl. Dago No. 123, Bandung (Kediaman Bapak Fulan)"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Waktu / Batas Pertemuan *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newTask.dueAt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTask({ ...newTask, dueAt: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prioritas</label>
                  <select
                    value={newTask.priority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Khusus / Instruksi Tambahan</label>
                <textarea
                  rows={3}
                  value={newTask.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Catatan persiapan berkas, preferensi waktu jamaah, atau riwayat komunikasi sebelumnya"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  Simpan & Tugaskan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Alihkan Penugasan (Reassign PIC)</h3>
            <p className="text-xs text-slate-500">Tugas: <span className="font-semibold text-slate-800">{reassignModal.title}</span></p>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Staf Pengganti *</label>
                <select
                  required
                  value={newOwnerId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewOwnerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Pilih Staf Pengganti --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Pengalihan Tugas *</label>
                <textarea
                  required
                  rows={3}
                  value={reassignReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReassignReason(e.target.value)}
                  placeholder="Contoh: Jadwal bentrok dengan acara kajian akbar, dialihkan ke akhi Fulan"
                  className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModal(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Alihkan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Dispatch Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              Kirim Notifikasi Email Kunjungan
            </h3>
            <p className="text-xs text-slate-500">
              Kirimkan surat tugas dan informasi silaturahmi resmi Yayasan Tarbiyah Sunnah ke alamat email terkait.
            </p>

            {emailSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                <Check className="w-4 h-4" /> {emailSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Penerima *</label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                  placeholder="tujuan@example.com"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModal(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={dispatchingEmail || !recipientEmail}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {dispatchingEmail ? 'Mengirim...' : 'Kirim Email Surat Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
