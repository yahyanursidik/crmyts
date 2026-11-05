import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Plus,
  Search,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import {
  formatWibDate,
  formatWibTime,
  formatRoutineTimeRange,
  SOURCE_LABELS,
  type KajianRutinAttendanceRow,
  type KajianRutinSession,
  type KajianRutinSeries,
} from "../../lib/kajianRutin";
import { useEventDialog } from "../events/components/useEventDialog";
import "./kajian-rutin.css";

interface AttendancePayload {
  session: KajianRutinSession;
  series: KajianRutinSeries;
  items: KajianRutinAttendanceRow[];
  presentCount: number;
  correctedCount: number;
  summaryOnly: boolean;
  checkInWindow: { openAt: string; closeAt: string };
}
type PersonOption = {
  id: string;
  fullName: string;
  email?: string | null;
  phoneE164?: string | null;
  gender?: "ikhwan" | "akhwat" | null;
};
export function KajianRutinAttendanceModal({
  sessionId,
  onClose,
  onChanged,
}: {
  sessionId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const manage = permissions.includes(PERMISSIONS.ATTENDANCE_MANAGE);
  const exportAllowed = manage && permissions.includes(PERMISSIONS.DATA_EXPORT);
  const personAllowed = permissions.includes(PERMISSIONS.PERSONS_LIST);
  const personView =
    permissions.includes(PERMISSIONS.PERSONS_VIEW) ||
    permissions.includes(PERMISSIONS.PERSONS_VIEW_OPERATIONAL);
  const [payload, setPayload] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("present");
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    note: "",
  });
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(
    null,
  );
  const [personSearch, setPersonSearch] = useState("");
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [pickerError, setPickerError] = useState("");
  const [manualError, setManualError] = useState("");
  const [saving, setSaving] = useState(false);
  const [correction, setCorrection] = useState<KajianRutinAttendanceRow | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReason, setExportReason] = useState("");
  const epoch = useRef(0);
  const currentSession = useRef(sessionId);
  currentSession.current = sessionId;
  const ref = useEventDialog(!!sessionId, () => {
    if (!saving) onClose();
  });
  const load = useCallback(async (id: string, silent = false) => {
    const request = ++epoch.current;
    if (!silent) {
      setLoading(true);
      setPayload(null);
    }
    try {
      const result = await apiClient<AttendancePayload>(
        "/kajian-rutin/sessions/" + id + "/attendance",
      );
      if (request !== epoch.current || currentSession.current !== id) return;
      setPayload(result.data);
      setError("");
    } catch (err) {
      if (request === epoch.current)
        setError(
          err instanceof Error ? err.message : "Presensi belum dapat dimuat.",
        );
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    setPayload(null);
    setSearch("");
    setStatus("present");
    setPage(1);
    setCorrection(null);
    setReason("");
    setError("");
    setManualError("");
    setManual({ fullName: "", email: "", phone: "", gender: "", note: "" });
    setSelectedPerson(null);
    setPersonSearch("");
    setOptions([]);
    setExportOpen(false);
    if (sessionId) void load(sessionId);
    return () => {
      epoch.current++;
    };
  }, [sessionId, load]);
  useEffect(() => {
    setOptions([]);
    setPickerError("");
    if (!personAllowed || personSearch.trim().length < 2 || !sessionId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void apiClient<PersonOption[]>(
        "/persons?search=" +
          encodeURIComponent(personSearch.trim()) +
          "&pageSize=6&isActive=true",
        { signal: controller.signal },
      )
        .then((result) => setOptions(result.data))
        .catch((err) => {
          if (!controller.signal.aborted)
            setPickerError(
              err instanceof Error ? err.message : "Pencarian belum tersedia.",
            );
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [personSearch, personAllowed, sessionId]);
  const filtered = useMemo(
    () =>
      (payload?.items || []).filter(
        (row) =>
          (status === "all" ||
            (status === "present"
              ? row.status === "present"
              : row.status !== "present")) &&
          [row.fullName, row.email, row.phone]
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [payload, search, status],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  if (!sessionId) return null;
  const addManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setManualError("");
    try {
      await apiClient("/kajian-rutin/sessions/" + sessionId + "/attendance", {
        method: "POST",
        body: JSON.stringify({
          ...manual,
          personId: selectedPerson?.id,
          email: manual.email || null,
          phone: manual.phone || null,
          gender: manual.gender || null,
        }),
      });
      setManual({ fullName: "", email: "", phone: "", gender: "", note: "" });
      setSelectedPerson(null);
      setPersonSearch("");
      await load(sessionId, true);
      onChanged?.();
    } catch (err) {
      setManualError(
        err instanceof Error ? err.message : "Presensi belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };
  const correct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!correction) return;
    setSaving(true);
    setError("");
    try {
      await apiClient("/kajian-rutin/attendance/" + correction.id, {
        method: "PATCH",
        body: JSON.stringify({
          status: correction.status === "present" ? "voided" : "present",
          reason,
        }),
      });
      setCorrection(null);
      setReason("");
      await load(sessionId, true);
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Koreksi belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };
  const download = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiClient<{ csv: string }>(
        "/kajian-rutin/sessions/" + sessionId + "/attendance/export",
        {
          method: "POST",
          body: JSON.stringify({
            ids: filtered.map((row) => row.id),
            reason: exportReason,
          }),
        },
      );
      const url = URL.createObjectURL(
        new Blob([result.data.csv], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        "presensi-" + (payload?.session.sessionDate || sessionId) + ".csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ekspor belum dapat dibuat.",
      );
    } finally {
      setSaving(false);
    }
  };
  const personName = (row: KajianRutinAttendanceRow) =>
    row.personId && personView ? (
      <Link to={"/people/" + row.personId} onClick={onClose}>
        {row.fullName}
      </Link>
    ) : (
      <strong>{row.fullName}</strong>
    );
  const rowAction = (row: KajianRutinAttendanceRow) =>
    manage && (
      <button
        className="kr-button"
        disabled={saving}
        onClick={() => {
          setCorrection(row);
          setReason("");
        }}
      >
        {row.status === "present" ? <X size={13} /> : <Undo2 size={13} />}
        {row.status === "present" ? "Koreksi" : "Pulihkan"}
      </button>
    );
  return (
    <div
      className="kr-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        ref={ref}
        className="kr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kr-attendance-heading"
        tabIndex={-1}
      >
        <header className="kr-dialog-header">
          <div>
            <h2 id="kr-attendance-heading">Presensi Jamaah</h2>
            <p>
              {payload
                ? payload.series.title +
                  " · " +
                  formatWibDate(payload.session.startAt)
                : "Memuat sesi…"}
            </p>
          </div>
          <div className="kr-actions">
            {exportAllowed && (
              <button
                className="kr-button"
                disabled={!filtered.length || saving}
                aria-expanded={exportOpen}
                onClick={() => setExportOpen(!exportOpen)}
              >
                <Download size={15} /> Ekspor CSV
              </button>
            )}
            <button
              className="kr-button kr-icon"
              disabled={saving}
              aria-label="Tutup presensi"
              onClick={onClose}
            >
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="kr-dialog-body">
          {error && (
            <div role="alert" className="kr-error">
              {error}
              <button
                className="kr-button"
                onClick={() => void load(sessionId)}
              >
                Muat ulang
              </button>
            </div>
          )}
          {loading && (
            <div className="kr-empty">
              <LoaderCircle className="animate-spin" size={22} />
              Memuat presensi…
            </div>
          )}
          {payload && (
            <>
              <div className="kr-actions">
                <span className="kr-badge kr-live">
                  {payload.presentCount} hadir
                </span>
                <span className="kr-badge">
                  {payload.correctedCount} dikoreksi / izin
                </span>
                <span className="kr-badge">
                  {formatRoutineTimeRange(
                    payload.checkInWindow.openAt,
                    payload.checkInWindow.closeAt,
                  )}
                </span>
                {payload.series.quota ? (
                  <span className="kr-badge">Kuota {payload.series.quota}</span>
                ) : null}
              </div>
              {exportOpen && (
                <form className="kr-correction" onSubmit={download}>
                  <label>
                    Keperluan ekspor
                    <input
                      required
                      minLength={3}
                      maxLength={300}
                      value={exportReason}
                      onChange={(e) => setExportReason(e.target.value)}
                      placeholder="Contoh: laporan kehadiran panitia"
                    />
                  </label>
                  <div className="kr-actions">
                    <button
                      className="kr-button kr-primary"
                      disabled={saving || exportReason.trim().length < 3}
                    >
                      Unduh {filtered.length} baris
                    </button>
                    <button
                      type="button"
                      className="kr-button"
                      onClick={() => setExportOpen(false)}
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
              {manage &&
                payload.series.isActive &&
                payload.session.status !== "cancelled" && (
                  <details className="kr-manual">
                    <summary>Tambah kehadiran manual</summary>
                    <form onSubmit={addManual}>
                      {personAllowed && (
                        <div className="kr-person-picker">
                          <label>
                            Cari Jamaah yang sudah ada
                            <input
                              value={personSearch}
                              onChange={(e) => {
                                setPersonSearch(e.target.value);
                                setSelectedPerson(null);
                              }}
                              placeholder="Nama, email, atau WhatsApp"
                            />
                          </label>
                          {pickerError && (
                            <p className="kr-error">{pickerError}</p>
                          )}
                          {options.length > 0 && !selectedPerson && (
                            <div className="kr-person-results">
                              {options.map((person) => (
                                <button
                                  type="button"
                                  key={person.id}
                                  onClick={() => {
                                    setSelectedPerson(person);
                                    setPersonSearch(person.fullName);
                                    setOptions([]);
                                    setManual({
                                      fullName: person.fullName,
                                      email: person.email || "",
                                      phone: person.phoneE164 || "",
                                      gender: person.gender || "",
                                      note: "",
                                    });
                                  }}
                                >
                                  <UserRound size={13} /> {person.fullName} ·{" "}
                                  {person.phoneE164 ||
                                    person.email ||
                                    "Tanpa kontak"}
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedPerson && (
                            <p>
                              <CheckCircle2 size={13} /> Terhubung ke profil
                              Jamaah{" "}
                              <button
                                className="kr-button"
                                type="button"
                                onClick={() => {
                                  setSelectedPerson(null);
                                  setPersonSearch("");
                                  setManual({
                                    fullName: "",
                                    email: "",
                                    phone: "",
                                    gender: "",
                                    note: "",
                                  });
                                }}
                              >
                                Ganti
                              </button>
                            </p>
                          )}
                        </div>
                      )}
                      <label>
                        Nama lengkap *
                        <input
                          required
                          minLength={2}
                          maxLength={160}
                          value={manual.fullName}
                          readOnly={!!selectedPerson}
                          onChange={(e) =>
                            setManual({ ...manual, fullName: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        WhatsApp
                        <input
                          type="tel"
                          maxLength={24}
                          placeholder="08…"
                          value={manual.phone}
                          readOnly={!!selectedPerson}
                          onChange={(e) =>
                            setManual({ ...manual, phone: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          maxLength={254}
                          value={manual.email}
                          readOnly={!!selectedPerson}
                          onChange={(e) =>
                            setManual({ ...manual, email: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Gender
                        <select
                          aria-label="Gender"
                          value={manual.gender}
                          onChange={(e) =>
                            setManual({ ...manual, gender: e.target.value })
                          }
                        >
                          <option value="">Pilih bila diperlukan</option>
                          <option value="ikhwan">Ikhwan</option>
                          <option value="akhwat">Akhwat</option>
                        </select>
                      </label>
                      <label className="kr-form-full">
                        Catatan
                        <input
                          value={manual.note}
                          maxLength={300}
                          onChange={(e) =>
                            setManual({ ...manual, note: e.target.value })
                          }
                        />
                      </label>
                      {!selectedPerson && (
                        <p className="kr-form-full">
                          Jamaah baru akan tersimpan di direktori.
                        </p>
                      )}
                      {manualError && (
                        <div className="kr-error" role="alert">
                          {manualError}
                        </div>
                      )}
                      <button
                        className="kr-button kr-primary"
                        disabled={saving || manual.fullName.trim().length < 2}
                      >
                        {saving ? (
                          <LoaderCircle className="animate-spin" size={15} />
                        ) : (
                          <Plus size={15} />
                        )}{" "}
                        Catat hadir
                      </button>
                    </form>
                  </details>
                )}
              {!payload.summaryOnly && (
                <>
                  <div className="kr-toolbar">
                    <label className="kr-search">
                      <Search size={16} />
                      <input
                        aria-label="Cari presensi"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Cari nama, email, WhatsApp…"
                      />
                    </label>
                    <select
                      aria-label="Status presensi"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="present">Hadir</option>
                      <option value="corrected">Koreksi / izin</option>
                      <option value="all">Semua catatan</option>
                    </select>
                  </div>
                  {correction && (
                    <form className="kr-correction" onSubmit={correct}>
                      <p>
                        <strong>{correction.fullName}</strong> ·{" "}
                        {correction.status === "present"
                          ? "Batalkan catatan hadir. Riwayat tetap disimpan."
                          : "Pulihkan kehadiran dengan waktu asli."}
                      </p>
                      <label>
                        Alasan *
                        <input
                          autoFocus
                          required
                          minLength={3}
                          maxLength={300}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <div className="kr-actions">
                        <button
                          className="kr-button kr-primary"
                          disabled={saving || reason.trim().length < 3}
                        >
                          Simpan koreksi
                        </button>
                        <button
                          className="kr-button"
                          type="button"
                          disabled={saving}
                          onClick={() => setCorrection(null)}
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  )}
                  {!filtered.length ? (
                    <div className="kr-empty kr-empty-small">
                      <UsersIcon />
                      <p>
                        {search
                          ? "Tidak ada hasil yang cocok."
                          : "Belum ada catatan pada tampilan ini."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <table className="kr-attendance-table">
                        <thead>
                          <tr>
                            <th>Jamaah</th>
                            <th>Kontak</th>
                            <th>Presensi WIB</th>
                            <th>Status</th>
                            {manage && <th>Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((row) => (
                            <tr key={row.id}>
                              <td>
                                {personName(row)}
                                <small>
                                  {row.personId
                                    ? "Profil terhubung"
                                    : "Riwayat lama"}
                                  {row.earlyRank
                                    ? " · Awal #" + row.earlyRank
                                    : ""}
                                </small>
                              </td>
                              <td className="kr-contact">
                                {row.phone || "—"}
                                <small>{row.email || "—"}</small>
                              </td>
                              <td>
                                {formatWibTime(row.checkInAt)}
                                <small>
                                  {SOURCE_LABELS[row.source] || row.source}
                                </small>
                              </td>
                              <td>
                                <span
                                  className={
                                    "kr-badge " +
                                    (row.status === "present" ? "kr-live" : "")
                                  }
                                >
                                  {row.status === "present"
                                    ? "Hadir"
                                    : row.status === "voided"
                                      ? "Dikoreksi"
                                      : "Izin"}
                                </span>
                                {row.note && <small>{row.note}</small>}
                              </td>
                              {manage && <td>{rowAction(row)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="kr-attendance-mobile">
                        {visible.map((row) => (
                          <article key={row.id}>
                            {personName(row)}
                            <p>{row.phone || row.email || "Tanpa kontak"}</p>
                            <p>
                              {formatWibTime(row.checkInAt)} ·{" "}
                              {SOURCE_LABELS[row.source] || row.source}
                              {row.earlyRank ? " · Awal #" + row.earlyRank : ""}
                            </p>
                            <div className="kr-actions">
                              <span
                                className={
                                  "kr-badge " +
                                  (row.status === "present" ? "kr-live" : "")
                                }
                              >
                                {row.status === "present"
                                  ? "Hadir"
                                  : row.status === "voided"
                                    ? "Dikoreksi"
                                    : "Izin"}
                              </span>
                              {rowAction(row)}
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  <nav className="kr-pagination" aria-label="Halaman presensi">
                    <span>{filtered.length} catatan</span>
                    <button
                      className="kr-button"
                      aria-label="Presensi sebelumnya"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span>
                      {currentPage} / {pages}
                    </span>
                    <button
                      className="kr-button"
                      aria-label="Presensi berikutnya"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </nav>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function UsersIcon() {
  return <UserRound size={24} />;
}
