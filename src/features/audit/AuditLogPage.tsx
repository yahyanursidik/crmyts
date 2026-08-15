import { useState, useEffect } from 'react';
import { ShieldCheck, Filter, History, Download, Eye, FileText, RefreshCw } from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string;
  actorEmail: string;
  reason: string | null;
  requestId: string | null;
  hasBeforeJson: boolean;
  hasAfterJson: boolean;
  createdAt: string;
}

interface ExportLogItem {
  id: string;
  exportType: string;
  actorName: string;
  actorEmail: string;
  rowCount: number;
  reason: string;
  filterJson: any;
  fileReference: string | null;
  createdAt: string;
}

export function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<'audit' | 'exports'>('audit');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [exportsList, setExportsList] = useState<ExportLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [detailModal, setDetailModal] = useState<any | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/logs');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data.items || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExportLogs = async () => {
    try {
      const res = await fetch('/api/audit/exports');
      if (res.ok) {
        const json = await res.json();
        setExportsList(json.data.items || []);
      }
    } catch (err) {
      console.error('Error fetching export logs:', err);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchExportLogs();
  }, []);

  const openDetail = async (logId: string) => {
    try {
      const res = await fetch(`/api/audit/logs/${logId}`);
      if (res.ok) {
        const json = await res.json();
        setDetailModal(json.data);
      }
    } catch (err) {
      console.error('Failed to load audit detail:', err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Trail & Rekam Jejak Mutasi</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Catatan permanen (*append-only*) untuk transparansi operasional, kepatuhan finansial, dan audit keamanan data yayasan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchAuditLogs(); fetchExportLogs(); }}
            className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Segarkan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Jejak Aktivitas Sistem ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab('exports')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'exports'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Download className="w-4 h-4" />
          Kepatuhan Ekspor Data ({exportsList.length})
        </button>
      </div>

      {activeTab === 'audit' ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="Cari aksi, aktor, atau entitas..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedAction}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAction(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Kategori Aksi</option>
                <option value="verify_donation">Verifikasi Donasi</option>
                <option value="reject_donation">Penolakan Donasi</option>
                <option value="correct_donation">Koreksi Donasi</option>
                <option value="transition_waqf_stage">Transisi Wakaf</option>
                <option value="merge_persons">Penggabungan Jamaah</option>
                <option value="create_sensitive_interaction">Catatan Sensitif</option>
                <option value="export_data">Ekspor Data</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Memuat rekam jejak audit...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">Belum ada riwayat audit yang sesuai dengan filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Aksi / Operasi</th>
                    <th className="py-3 px-4">Entitas Target</th>
                    <th className="py-3 px-4">Aktor / Staf</th>
                    <th className="py-3 px-4">Alasan Audit</th>
                    <th className="py-3 px-4 text-center">Detail Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-mono text-xs text-slate-500">{item.entityType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.actorName}</div>
                        <div className="text-xs text-slate-500">{item.actorEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={item.reason || '-'}>
                        {item.reason || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openDetail(item.id)}
                          className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          Inspeksi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Riwayat Kepatuhan Ekspor Data</h2>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Perlindungan Data Pribadi
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Setiap aktivitas pengunduhan daftar jamaah atau data donasi diwajibkan mencantumkan alasan audit untuk pencegahan kebocoran data.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Waktu Ekspor</th>
                  <th className="py-3 px-4">Tipe Berkas</th>
                  <th className="py-3 px-4">Staf Pengunduh</th>
                  <th className="py-3 px-4">Jumlah Baris</th>
                  <th className="py-3 px-4">Alasan Kepatuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exportsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                      Belum ada aktivitas ekspor data yang tercatat.
                    </td>
                  </tr>
                ) : (
                  exportsList.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(exp.createdAt).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{exp.exportType}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{exp.actorName}</div>
                        <div className="text-xs text-slate-500">{exp.actorEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{exp.rowCount.toLocaleString()} baris</td>
                      <td className="py-3 px-4 text-slate-600 italic">{exp.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Diff Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Detail Rekam Jejak Audit
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {detailModal.id}</p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-xs text-slate-500">Aktor / Staf:</span>
                <p className="font-medium text-slate-900">{detailModal.actor?.fullName || 'Sistem'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Waktu Transaksi:</span>
                <p className="font-medium text-slate-900">
                  {new Date(detailModal.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Aksi:</span>
                <p className="font-medium text-slate-900">{detailModal.action}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Alasan Audit:</span>
                <p className="font-medium text-slate-900">{detailModal.reason || '-'}</p>
              </div>
            </div>

            {/* Before vs After JSON Diffs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1.5 rounded-t-lg border-b border-amber-200">
                  Status Sebelum (Before JSON)
                </h4>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-b-lg overflow-x-auto max-h-60">
                  {detailModal.beforeJson ? JSON.stringify(detailModal.beforeJson, null, 2) : '// Tidak ada data sebelumnya (New Record)'}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-t-lg border-b border-emerald-200">
                  Status Sesudah (After JSON)
                </h4>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-b-lg overflow-x-auto max-h-60">
                  {detailModal.afterJson ? JSON.stringify(detailModal.afterJson, null, 2) : '// Rekaman kosong'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Tutup Inspeksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
