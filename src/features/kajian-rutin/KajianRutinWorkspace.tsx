import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  ArrowLeft,
  Archive,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  List,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { apiClient } from "../../lib/apiClient";
import { useCreateIntent } from "../../lib/useCreateIntent";
import {
  describeJadwal,
  formatWibDate,
  formatWibTime,
  formatRoutineTimeRange,
  TARGET_AUDIENCE_LABELS,
  type KajianRutinSeries,
  type KajianRutinSession,
  type KajianRutinSpeaker,
  type KajianRutinEarlyBird,
} from "../../lib/kajianRutin";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { KajianRutinSeriesModal } from "./KajianRutinSeriesModal";
import { KajianRutinSessionEditModal } from "./KajianRutinSessionEditModal";
import { KajianRutinAnnouncementsModal } from "./KajianRutinAnnouncementsModal";
import { KajianRutinQrModal } from "./KajianRutinQrModal";
import { KajianRutinAttendanceModal } from "./KajianRutinAttendanceModal";
import "./kajian-rutin.css";

type Sessions = { series: KajianRutinSeries; sessions: KajianRutinSession[] };
export function KajianRutinWorkspace() {
  const [params, setParams] = useSearchParams();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const manage = permissions.includes(PERMISSIONS.EVENTS_MANAGE);
  const attendance = permissions.includes(PERMISSIONS.ATTENDANCE_VIEW_SUMMARY);
  const createIntent = useCreateIntent(PERMISSIONS.EVENTS_MANAGE);
  const seriesId = params.get("seriesId");
  const sessionId = params.get("sessionId");
  const panel = params.get("panel");
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);
  const status = params.get("status") || "active";
  const [list, setList] = useState<KajianRutinSeries[] | null>(null);
  const [unique, setUnique] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<Sessions | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [early, setEarly] = useState<{
    items: KajianRutinEarlyBird[];
    sessionsCount: number;
  } | null>(null);
  const [speakers, setSpeakers] = useState<KajianRutinSpeaker[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    run: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(
    () => localStorage.getItem("kajian_rutin_view") || "card",
  );
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("4");
  const sessionFilter = params.get("sessions") || "upcoming";
  const sessionPage = Math.max(1, Number(params.get("sessionPage")) || 1);
  const setSessionFilter = (value: string) =>
    change({ sessions: value, sessionPage: null });
  const setSessionPage = (value: number) =>
    change({ sessionPage: String(value) });
  const epoch = useRef(0);
  const listEpoch = useRef(0);
  const change = (patch: Record<string, string | null>) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch))
        value ? next.set(key, value) : next.delete(key);
      if ("seriesId" in patch && patch.seriesId !== previous.get("seriesId")) {
        next.delete("sessions");
        next.delete("sessionPage");
        next.delete("focusSession");
      }
      return next;
    });
  useEffect(() => {
    setSearch(q);
  }, [q]);
  useEffect(() => {
    if (search === q) return;
    const timer = window.setTimeout(
      () =>
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            search.trim() ? next.set("q", search.trim()) : next.delete("q");
            next.delete("page");
            return next;
          },
          { replace: true },
        ),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [search, q, setParams]);
  const loadList = useCallback(async () => {
    const request = ++listEpoch.current;
    try {
      const result = await apiClient<KajianRutinSeries[]>(
        "/kajian-rutin/series",
      );
      if (request !== listEpoch.current) return;
      setList(result.data);
      setUnique(Number(result.meta?.totalUniqueAttendees || 0));
      setError("");
    } catch (err) {
      if (request === listEpoch.current)
        setError(
          err instanceof Error ? err.message : "Daftar belum dapat dimuat.",
        );
    }
  }, []);
  const loadSessions = useCallback(async (id: string, silent = false) => {
    const request = ++epoch.current;
    if (!silent) {
      setData(null);
      setEarly(null);
      setLoading(true);
    }
    setSessionError("");
    try {
      const result = await apiClient<Sessions>(
        "/kajian-rutin/series/" + id + "/sessions",
      );
      if (request !== epoch.current) return;
      setData(result.data);
      const birds = await apiClient<{
        items: KajianRutinEarlyBird[];
        sessionsCount: number;
      }>("/kajian-rutin/series/" + id + "/early-birds?days=30");
      if (request === epoch.current) setEarly(birds.data);
    } catch (err) {
      if (request === epoch.current)
        setSessionError(
          err instanceof Error ? err.message : "Sesi belum dapat dimuat.",
        );
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  }, []);
  const refresh = async () => {
    await loadList();
    if (seriesId) await loadSessions(seriesId, true);
  };
  useEffect(() => {
    void loadList();
    return () => {
      listEpoch.current++;
    };
  }, [loadList]);
  useEffect(() => {
    setAddOpen(false);
    setFormError("");
    if (seriesId) void loadSessions(seriesId);
    else {
      epoch.current++;
      setData(null);
      setEarly(null);
      setLoading(false);
    }
    return () => {
      epoch.current++;
    };
  }, [seriesId, loadSessions]);
  useEffect(() => {
    void apiClient<KajianRutinSpeaker[]>("/kajian-rutin/speakers")
      .then((result) => setSpeakers(result.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const filtered = useMemo(
    () =>
      (list || []).filter(
        (row) =>
          (status === "all" ||
            (status === "archived" ? !row.isActive : row.isActive)) &&
          [
            row.title,
            row.speaker,
            row.locationName,
            TARGET_AUDIENCE_LABELS[row.targetAudience],
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [list, search, status],
  );
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const context = data?.series.id === seriesId ? data : null;
  const editing = panel === "series-edit" ? context?.series || null : null;
  const focusSession = params.get("focusSession");
  useEffect(() => {
    if (context && !sessionId && focusSession)
      document
        .getElementById("kr-session-" + focusSession)
        ?.focus({ preventScroll: true });
  }, [context, sessionId, focusSession]);
  const activeSession =
    context?.sessions.find((row) => row.id === sessionId) || null;
  const upcoming =
    context?.sessions
      .filter(
        (row) =>
          row.status !== "cancelled" &&
          (row.endAt
            ? Date.parse(row.endAt)
            : Date.parse(row.startAt) + 7_200_000) >= Date.now(),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt)) || [];
  const sessionRows = (context?.sessions || [])
    .filter(
      (row) =>
        sessionFilter === "all" ||
        (sessionFilter === "cancelled"
          ? row.status === "cancelled"
          : sessionFilter === "past"
            ? row.status !== "cancelled" &&
              (row.endAt
                ? Date.parse(row.endAt)
                : Date.parse(row.startAt) + 7_200_000) < Date.now()
            : upcoming.some((item) => item.id === row.id)),
    )
    .sort((a, b) =>
      sessionFilter === "upcoming"
        ? a.startAt.localeCompare(b.startAt)
        : b.startAt.localeCompare(a.startAt),
    );
  const sessionPages = Math.max(1, Math.ceil(sessionRows.length / 10));
  const selectedSessionPage = Math.min(sessionPage, sessionPages);
  const sessionVisible = sessionRows.slice(
    (selectedSessionPage - 1) * 10,
    selectedSessionPage * 10,
  );
  const openPanel = (row: KajianRutinSession, value: string) => {
    setFormError("");
    change({ sessionId: row.id, panel: value, focusSession: null });
  };
  const closePanel = () => {
    setFormError("");
    change({ sessionId: null, panel: null, focusSession: sessionId });
  };
  const mutate = async (path: string, method: string, body?: unknown) => {
    await apiClient(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await refresh();
  };
  const saveSeries = async (body: Record<string, unknown>) => {
    setSaving(true);
    setFormError("");
    try {
      const result = await apiClient<KajianRutinSeries>(
        "/kajian-rutin/series" + (editing ? "/" + editing.id : ""),
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      await loadList();
      change({
        seriesId: result.data.id,
        action: null,
        new: null,
        panel: null,
        sessionId: null,
      });
      setNotice("Seri berhasil disimpan.");
      if (seriesId === result.data.id) await loadSessions(seriesId, true);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Seri belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveSession = async (body: Record<string, unknown>) => {
    if (!activeSession) return;
    setSaving(true);
    setFormError("");
    try {
      await mutate("/kajian-rutin/sessions/" + activeSession.id, "PATCH", body);
      closePanel();
      setNotice("Sesi diperbarui.");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Sesi belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };
  const createSessions = async (generate: boolean) => {
    if (!context) return;
    setBusy(true);
    setSessionError("");
    try {
      await mutate(
        "/kajian-rutin/series/" +
          context.series.id +
          "/sessions" +
          (generate ? "/generate" : ""),
        "POST",
        generate
          ? { count: Number(count) }
          : {
              ...(newDate ? { sessionDate: newDate } : {}),
              ...(topic.trim() ? { topic: topic.trim() } : {}),
            },
      );
      setAddOpen(false);
      setNewDate("");
      setTopic("");
      setNotice("Sesi dan QR siap digunakan.");
    } catch (err) {
      setSessionError(
        err instanceof Error ? err.message : "Sesi belum dapat dibuat.",
      );
    } finally {
      setBusy(false);
    }
  };
  const archive = (row: KajianRutinSeries) =>
    setConfirmation({
      title: row.isActive ? "Arsipkan seri?" : "Pulihkan seri?",
      message: row.isActive
        ? "Seri disembunyikan dari portal. Semua sesi dan riwayat tetap tersimpan."
        : "Seri dan sesi terjadwal kembali tersedia di portal.",
      run: async () => {
        await mutate("/kajian-rutin/series/" + row.id, "PATCH", {
          isActive: !row.isActive,
        });
        setNotice(row.isActive ? "Seri diarsipkan." : "Seri dipulihkan.");
      },
    });
  const newButton = (
    <button
      className="kr-button kr-primary"
      onClick={() => {
        setFormError("");
        change({ action: "create", panel: null, sessionId: null });
      }}
    >
      <Plus size={16} /> Buat seri
    </button>
  );
  return (
    <div className="kr-workspace">
      <header className="kr-header">
        <div>
          <div className="kr-eyebrow">Kegiatan Jamaah</div>
          <h1>Kajian Rutin</h1>
          <p>Atur pertemuan, siapkan QR, pantau kehadiran.</p>
        </div>
        <div className="kr-actions">
          <Link
            className="kr-button"
            to="/peserta/kajian"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} /> Portal Jamaah
          </Link>
          {manage && (
            <>
              <button
                className="kr-button"
                onClick={() =>
                  change({ panel: "announcements", sessionId: null })
                }
              >
                <Megaphone size={15} /> Pengumuman
              </button>
              {newButton}
            </>
          )}
        </div>
      </header>
      <section className="kr-stats" aria-label="Ringkasan Kajian Rutin">
        {[
          {
            label: "Seri aktif",
            value: list?.filter((row) => row.isActive).length,
            icon: CalendarDays,
          },
          {
            label: "Sesi dibuat",
            value: list?.reduce(
              (sum, row) => sum + (row.totalSessions || 0),
              0,
            ),
            icon: CalendarPlus,
          },
          {
            label: "Kehadiran",
            value: list?.reduce(
              (sum, row) => sum + (row.totalAttendance || 0),
              0,
            ),
            icon: CheckCircle2,
          },
          { label: "Jamaah unik", value: unique, icon: Users },
        ].map(({ label, value, icon: Icon }, i) => (
          <div className={"kr-stat kr-tone-" + i} key={label}>
            <span className="kr-stat-icon">
              <Icon size={19} />
            </span>
            <div>
              <strong>
                {value == null ? "—" : value.toLocaleString("id-ID")}
              </strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </section>
      {notice && (
        <div className="kr-notice" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="kr-error" role="alert">
          {error}
          <button className="kr-button" onClick={() => void loadList()}>
            Coba lagi
          </button>
        </div>
      )}
      <div className="kr-toolbar">
        <label className="kr-search">
          <Search size={17} />
          <input
            aria-label="Cari seri kajian"
            value={search}
            placeholder="Cari kajian, pemateri, lokasi…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Status seri"
          value={status}
          onChange={(e) => change({ status: e.target.value, page: null })}
        >
          <option value="active">Aktif</option>
          <option value="archived">Diarsipkan</option>
          <option value="all">Semua seri</option>
        </select>
        <div className="kr-mode" role="group" aria-label="Tampilan daftar">
          {[
            { value: "card", label: "Kartu", icon: LayoutGrid },
            { value: "table", label: "Ringkas", icon: List },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              aria-label={label}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                localStorage.setItem("kajian_rutin_view", value);
              }}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
        <button
          className="kr-button kr-icon"
          aria-label="Muat ulang"
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {!list && !error && (
        <div className="kr-empty">
          <LoaderCircle className="animate-spin" size={22} />
          Memuat seri kajian…
        </div>
      )}
      {list && (
        <div className={seriesId ? "kr-columns" : ""}>
          <section className="kr-directory" aria-label="Daftar seri kajian">
            <div className="kr-section-title">
              <h2>Seri kajian</h2>
              <span>{filtered.length} seri</span>
            </div>
            {visible.length === 0 ? (
              <div className="kr-empty">
                <CalendarDays size={28} />
                <h3>
                  {q
                    ? "Seri tidak ditemukan"
                    : status === "archived"
                      ? "Belum ada arsip"
                      : "Belum ada seri aktif"}
                </h3>
                <p>
                  {q
                    ? "Coba nama pemateri atau lokasi lain."
                    : "Seri baru dan pertemuannya akan muncul di sini."}
                </p>
                {manage && newButton}
              </div>
            ) : (
              <div
                className={
                  mode === "table" || seriesId
                    ? "kr-series-list"
                    : "kr-series-grid"
                }
              >
                {visible.map((row) => (
                  <article
                    key={row.id}
                    className={
                      "kr-series " + (seriesId === row.id ? "kr-selected" : "")
                    }
                  >
                    <button
                      className="kr-series-open"
                      onClick={() =>
                        change({
                          seriesId: row.id,
                          sessionId: null,
                          panel: null,
                        })
                      }
                      aria-pressed={seriesId === row.id}
                    >
                      <div className="kr-series-top">
                        {row.posterUrl ? (
                          <img src={row.posterUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="kr-series-icon">
                            <CalendarDays size={20} />
                          </span>
                        )}
                        <span
                          className={
                            "kr-badge " + (row.isActive ? "kr-live" : "")
                          }
                        >
                          {row.isActive ? "Aktif" : "Arsip"}
                        </span>
                      </div>
                      <h3>{row.title}</h3>
                      <p>{row.speaker || "Pemateri belum diatur"}</p>
                      <div className="kr-schedule">{describeJadwal(row)}</div>
                      <div className="kr-series-bottom">
                        <span>
                          {row.totalSessions || 0} sesi ·{" "}
                          {row.totalAttendance || 0} hadir
                        </span>
                        <ChevronRight size={16} />
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            )}
            {pages > 1 && (
              <nav className="kr-pagination" aria-label="Halaman seri">
                <button
                  className="kr-button"
                  disabled={currentPage === 1}
                  aria-label="Seri sebelumnya"
                  onClick={() => change({ page: String(currentPage - 1) })}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {currentPage} / {pages}
                </span>
                <button
                  className="kr-button"
                  disabled={currentPage === pages}
                  aria-label="Seri berikutnya"
                  onClick={() => change({ page: String(currentPage + 1) })}
                >
                  <ChevronRight size={15} />
                </button>
              </nav>
            )}
          </section>
          {seriesId && (
            <section className="kr-detail" aria-label="Detail seri">
              <div className="kr-section-title">
                <button
                  className="kr-back"
                  onClick={() =>
                    change({ seriesId: null, sessionId: null, panel: null })
                  }
                >
                  <ArrowLeft size={15} /> Semua seri
                </button>
                <span>Ruang pengelolaan</span>
              </div>
              {loading && (
                <div className="kr-empty">
                  <LoaderCircle className="animate-spin" size={22} />
                  Memuat sesi…
                </div>
              )}
              {sessionError && (
                <div role="alert" className="kr-error">
                  {sessionError}
                  <button
                    className="kr-button"
                    onClick={() => void loadSessions(seriesId)}
                  >
                    Coba lagi
                  </button>
                </div>
              )}
              {context && (
                <>
                  <div className="kr-detail-heading">
                    <div>
                      <span
                        className={
                          "kr-badge " +
                          (context.series.isActive ? "kr-live" : "")
                        }
                      >
                        {context.series.isActive ? "Seri aktif" : "Diarsipkan"}
                      </span>
                      <h2>{context.series.title}</h2>
                      <p>
                        {context.series.speaker || "Pemateri belum diatur"} ·{" "}
                        {TARGET_AUDIENCE_LABELS[context.series.targetAudience]}
                      </p>
                      <p>{describeJadwal(context.series)}</p>
                      <p>
                        {context.series.locationName || "Lokasi belum diatur"}
                        {context.series.quota
                          ? " · Kuota " + context.series.quota + " per sesi"
                          : " · Tanpa batas kuota"}
                      </p>
                    </div>
                    {manage && (
                      <div className="kr-actions">
                        <button
                          className="kr-button"
                          onClick={() => {
                            setFormError("");
                            change({ panel: "series-edit", sessionId: null });
                          }}
                        >
                          <Pencil size={14} /> Ubah
                        </button>
                        <button
                          className="kr-button"
                          onClick={() => archive(context.series)}
                        >
                          <Archive size={14} />
                          {context.series.isActive ? "Arsipkan" : "Pulihkan"}
                        </button>
                        {context.sessions.length === 0 && (
                          <button
                            aria-label="Hapus seri kosong"
                            className="kr-button kr-danger"
                            onClick={() =>
                              setConfirmation({
                                title: "Hapus seri kosong?",
                                message: context.series.title,
                                run: async () => {
                                  await mutate(
                                    "/kajian-rutin/series/" + context.series.id,
                                    "DELETE",
                                  );
                                  change({ seriesId: null });
                                },
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {context.series.description && (
                    <p className="kr-description">
                      {context.series.description}
                    </p>
                  )}
                  {upcoming[0] && (
                    <div className="kr-next">
                      <CalendarDays size={21} />
                      <div>
                        <span>Pertemuan berikutnya</span>
                        <strong>
                          {formatWibDate(upcoming[0].startAt)} ·{" "}
                          {formatWibTime(upcoming[0].startAt)}
                        </strong>
                        <p>{upcoming[0].topic || context.series.title}</p>
                      </div>
                      <button
                        className="kr-button"
                        onClick={() => openPanel(upcoming[0]!, "qr")}
                      >
                        <QrCode size={16} /> QR
                      </button>
                    </div>
                  )}
                  <div className="kr-section-title">
                    <h3>Pertemuan</h3>
                    {manage && context.series.isActive && (
                      <button
                        className="kr-button kr-primary"
                        aria-expanded={addOpen}
                        onClick={() => setAddOpen(!addOpen)}
                      >
                        <Plus size={14} /> Buat sesi
                      </button>
                    )}
                  </div>
                  {addOpen && (
                    <div className="kr-create-sessions">
                      <div className="kr-create-single">
                        <label>
                          Tanggal
                          <input
                            type="date"
                            value={newDate}
                            onInput={(e) => setNewDate(e.currentTarget.value)}
                            onChange={(e) => setNewDate(e.target.value)}
                          />
                        </label>
                        <label>
                          Tema (opsional)
                          <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            maxLength={200}
                          />
                        </label>
                        <button
                          disabled={busy}
                          className="kr-button kr-primary"
                          onClick={() => void createSessions(false)}
                        >
                          <CalendarPlus size={15} /> Tambah sesi
                        </button>
                        <small>
                          Tanpa tanggal: ikuti pola seri berikutnya.
                        </small>
                      </div>
                      <div className="kr-create-auto">
                        <label>
                          Jadwalkan otomatis
                          <select
                            value={count}
                            onChange={(e) => setCount(e.target.value)}
                          >
                            {[1, 2, 4, 8, 12].map((n) => (
                              <option key={n} value={n}>
                                {n} pertemuan
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          disabled={busy}
                          className="kr-button"
                          onClick={() => void createSessions(true)}
                        >
                          <Wand2 size={15} /> Buat jadwal
                        </button>
                        {context.series.recurrence === "monthly" && (
                          <small>
                            Hari dan pekan yang sama tiap bulan; pekan kelima
                            dilewati bila tidak tersedia.
                          </small>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className="kr-tabs"
                    role="group"
                    aria-label="Filter pertemuan"
                  >
                    {[
                      { key: "upcoming", label: "Mendatang" },
                      { key: "past", label: "Riwayat" },
                      { key: "cancelled", label: "Dibatalkan" },
                      { key: "all", label: "Semua" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        aria-pressed={sessionFilter === item.key}
                        onClick={() => {
                          setSessionFilter(item.key);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {sessionRows.length === 0 ? (
                    <div className="kr-empty kr-empty-small">
                      <CalendarDays size={24} />
                      <p>Belum ada sesi pada tampilan ini.</p>
                    </div>
                  ) : (
                    <div className="kr-session-list">
                      {sessionVisible.map((row) => (
                        <article
                          key={row.id}
                          id={"kr-session-" + row.id}
                          tabIndex={-1}
                          className="kr-session"
                        >
                          <div className="kr-session-date">
                            <strong>
                              {new Date(row.startAt).toLocaleDateString(
                                "id-ID",
                                { day: "2-digit", timeZone: "Asia/Jakarta" },
                              )}
                            </strong>
                            <span>
                              {new Date(row.startAt).toLocaleDateString(
                                "id-ID",
                                {
                                  month: "short",
                                  year: "numeric",
                                  timeZone: "Asia/Jakarta",
                                },
                              )}
                            </span>
                          </div>
                          <div className="kr-session-main">
                            <h4>{row.topic || context.series.title}</h4>
                            <p>
                              {formatRoutineTimeRange(row.startAt, row.endAt)} ·{" "}
                              {row.locationName ||
                                context.series.locationName ||
                                "Lokasi belum diatur"}
                            </p>
                            <span
                              className={
                                "kr-badge " +
                                (row.status === "cancelled"
                                  ? "kr-cancelled"
                                  : "kr-live")
                              }
                            >
                              {row.status === "cancelled"
                                ? "Dibatalkan"
                                : "Terjadwal"}
                            </span>
                            <span className="kr-attended">
                              {row.attendanceCount || 0} hadir
                            </span>
                          </div>
                          <div className="kr-session-actions">
                            <button
                              className="kr-button"
                              onClick={() => openPanel(row, "qr")}
                            >
                              <QrCode size={14} /> QR
                            </button>
                            {attendance && (
                              <button
                                className="kr-button"
                                onClick={() => openPanel(row, "attendance")}
                              >
                                <Users size={14} /> Presensi
                              </button>
                            )}
                            {manage && (
                              <>
                                <button
                                  className="kr-button kr-icon"
                                  aria-label={"Ubah sesi " + row.sessionDate}
                                  onClick={() => openPanel(row, "edit")}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="kr-button kr-icon"
                                  aria-label={
                                    (row.status === "cancelled"
                                      ? "Pulihkan sesi "
                                      : "Batalkan sesi ") + row.sessionDate
                                  }
                                  onClick={() =>
                                    setConfirmation({
                                      title:
                                        row.status === "cancelled"
                                          ? "Pulihkan sesi?"
                                          : "Batalkan sesi?",
                                      message:
                                        "Riwayat kehadiran tetap tersimpan.",
                                      run: async () => {
                                        await mutate(
                                          "/kajian-rutin/sessions/" + row.id,
                                          "PATCH",
                                          {
                                            status:
                                              row.status === "cancelled"
                                                ? "scheduled"
                                                : "cancelled",
                                          },
                                        );
                                      },
                                    })
                                  }
                                >
                                  {row.status === "cancelled" ? (
                                    <RefreshCw size={14} />
                                  ) : (
                                    <X size={14} />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {sessionPages > 1 && (
                    <nav className="kr-pagination" aria-label="Halaman sesi">
                      <button
                        className="kr-button"
                        disabled={selectedSessionPage === 1}
                        onClick={() => setSessionPage(selectedSessionPage - 1)}
                        aria-label="Sesi sebelumnya"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span>
                        {selectedSessionPage} / {sessionPages}
                      </span>
                      <button
                        className="kr-button"
                        disabled={selectedSessionPage === sessionPages}
                        onClick={() => setSessionPage(selectedSessionPage + 1)}
                        aria-label="Sesi berikutnya"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </nav>
                  )}
                  {early && (
                    <details className="kr-early">
                      <summary>Jamaah paling rutin · 30 hari</summary>
                      {early.items.length ? (
                        <ol>
                          {early.items.slice(0, 10).map((row, index) => (
                            <li key={index}>
                              <span>{row.fullName}</span>
                              <strong>
                                {row.attended} hadir · {row.early} lebih awal
                              </strong>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>Belum ada kehadiran pada periode ini.</p>
                      )}
                    </details>
                  )}
                </>
              )}
              {context && sessionId && !activeSession && (
                <div className="kr-error">
                  Sesi tidak tersedia pada seri ini.
                  <button className="kr-button" onClick={closePanel}>
                    Tutup
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      <KajianRutinSeriesModal
        isOpen={manage && (!!editing || createIntent.active)}
        series={editing}
        speakers={speakers}
        saving={saving}
        error={formError}
        onSave={saveSeries}
        onClose={() => {
          if (saving) return;
          change({ action: null, new: null, panel: null });
        }}
        onAddSpeaker={async (name) => {
          try {
            const result = await apiClient<KajianRutinSpeaker>(
              "/kajian-rutin/speakers",
              { method: "POST", body: JSON.stringify({ name }) },
            );
            setSpeakers((previous) => [
              ...previous.filter((row) => row.id !== result.data.id),
              result.data,
            ]);
            return result.data;
          } catch (err) {
            setFormError(
              err instanceof Error
                ? err.message
                : "Pemateri belum dapat ditambahkan.",
            );
            return null;
          }
        }}
      />
      <KajianRutinSessionEditModal
        isOpen={manage && panel === "edit" && !!activeSession}
        session={activeSession}
        series={context?.series || null}
        speakers={speakers}
        saving={saving}
        error={formError}
        onSave={saveSession}
        onClose={closePanel}
      />
      <KajianRutinQrModal
        session={panel === "qr" ? activeSession : null}
        seriesTitle={context?.series.title || "Kajian Rutin"}
        onClose={closePanel}
        onRotated={() => {
          if (seriesId) void loadSessions(seriesId, true);
        }}
      />
      <KajianRutinAttendanceModal
        sessionId={
          attendance && panel === "attendance"
            ? activeSession?.id || null
            : null
        }
        onClose={closePanel}
        onChanged={() => void refresh()}
      />
      <KajianRutinAnnouncementsModal
        isOpen={manage && panel === "announcements"}
        onClose={() => change({ panel: null })}
      />
      <ConfirmDialog
        isOpen={!!confirmation}
        title={confirmation?.title || ""}
        message={confirmation?.message || ""}
        confirmLabel="Lanjutkan"
        loading={busy}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
        onConfirm={async () => {
          if (!confirmation) return;
          setBusy(true);
          try {
            await confirmation.run();
            setConfirmation(null);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Perubahan belum dapat disimpan.",
            );
            setConfirmation(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
