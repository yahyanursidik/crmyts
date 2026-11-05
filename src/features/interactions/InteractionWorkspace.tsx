import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS as P,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  MessageSquare,
  Plus,
  Search,
  RefreshCw,
  ArrowRight,
  Download,
  Clock,
  ShieldCheck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Archive,
  RotateCcw,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { usePersonContext } from "@/lib/usePersonContext";
import { useCreateIntent } from "@/lib/useCreateIntent";
import {
  INTERACTION_CHANNEL_LABELS as CHANNELS,
  INTERACTION_OUTCOME_LABELS as OUTCOMES,
} from "@/lib/interactionModel";
import { InteractionForm } from "./InteractionForm";
import { InteractionDialog } from "./InteractionDialog";
import { type InteractionItem, type InteractionOptions } from "./types";
import { toWibInput, fromWibInput } from "../events/utils/eventPresentation";
import "./interactions.css";
const time = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const TASK_LABELS: Record<string, string> = {
  pending: "Menunggu",
  in_progress: "Dikerjakan",
  waiting: "Menunggu kabar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
export function InteractionWorkspace() {
  const [params, setParams] = useSearchParams(),
    personContext = usePersonContext(),
    { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const intent = useCreateIntent(P.INTERACTIONS_CREATE),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState(params.get("search") || "");
  const [list, setList] = useState<InteractionItem[]>([]),
    [pagination, setPagination] = useState({
      page: 1,
      pageSize: 25,
      totalPages: 1,
      totalCount: 0,
    }),
    [stats, setStats] = useState<any>(null),
    [options, setOptions] = useState<InteractionOptions | null>(null),
    [optionsError, setOptionsError] = useState(""),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState(""),
    [exportOpen, setExportOpen] = useState(false);
  const selectedId = params.get("interactionId") || "";
  const filters = Object.fromEntries(
    [
      "search",
      "personId",
      "channel",
      "outcome",
      "sensitivityLevel",
      "ownerUserId",
      "eventId",
      "archive",
      "followUp",
      "from",
      "to",
      "page",
      "pageSize",
    ].flatMap((key) => (params.get(key) ? [[key, params.get(key)!]] : [])),
  );
  const filterKey = new URLSearchParams(filters).toString();
  const pendingParams = useRef(params);
  useEffect(() => {
    pendingParams.current = params;
  }, [params]);
  const change = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(pendingParams.current);
    next.delete("page");
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    pendingParams.current = next;
    setParams(next, { replace: true });
  };
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params.get("search")]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim() !== (params.get("search") || ""))
        change({ search: search.trim() || null });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, params.get("search")]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    void apiClient<InteractionItem[]>("/interactions?" + filterKey, {
      signal: controller.signal,
    })
      .then((result) => {
        setList(result.data);
        setPagination(result.meta?.pagination as any);
        setStats(result.meta?.stats);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [filterKey, version]);
  useEffect(() => {
    const controller = new AbortController();
    setOptionsError("");
    void apiClient<InteractionOptions>(
      "/interactions/options" +
        (personContext.personId ? "?personId=" + personContext.personId : ""),
      {
        signal: controller.signal,
      },
    )
      .then((result) => setOptions(result.data))
      .catch((e) => {
        if (!controller.signal.aborted) setOptionsError(e.message);
      });
    return () => controller.abort();
  }, [version, personContext.personId]);
  const taskAllowed =
      permissions.includes(P.TASKS_VIEW_OWN) ||
      permissions.includes(P.TASKS_VIEW_ALL),
    profileAllowed = personContext.canProfile,
    eventAllowed = permissions.includes(P.EVENTS_VIEW);
  const success = (result: any) => {
    setVersion((v) => v + 1);
    setNotice(
      result?.createdTask
        ? "Interaksi dan tugas tindak lanjut tersimpan."
        : "Interaksi tersimpan.",
    );
    if (result?.interaction?.id)
      change({ interactionId: result.interaction.id });
  };
  const archive = params.get("archive") || "active",
    followUp = params.get("followUp");
  const filterSelect = (
    key: string,
    label: string,
    items: Record<string, string>,
  ) => (
    <label>
      {label}
      <select
        value={params.get(key) || ""}
        onChange={(e) => change({ [key]: e.target.value || null })}
      >
        <option value="">Semua {label.toLowerCase()}</option>
        {Object.entries(items).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="ix-workspace">
      <header className="ix-page-head">
        <div>
          <p className="ix-eyebrow">Layanan & silaturahmi</p>
          <h1>Interaksi Jamaah</h1>
          <p>Catat komunikasi. Tuntaskan tindak lanjut.</p>
        </div>
        <div className="ix-actions">
          {taskAllowed && (
            <Link
              className="ix-button"
              to={
                "/tasks" +
                (personContext.personId
                  ? "?personId=" + personContext.personId
                  : "")
              }
            >
              <ClipboardList size={16} />
              Tindak lanjut
            </Link>
          )}
          {permissions.includes(P.DATA_EXPORT) && (
            <button
              className="ix-button"
              disabled={!list.length || busy}
              onClick={() => setExportOpen(true)}
            >
              <Download size={16} />
              Ekspor
            </button>
          )}
          {permissions.includes(P.INTERACTIONS_CREATE) && (
            <button
              className="ix-button ix-primary"
              onClick={() => setCreate(true)}
            >
              <Plus size={16} />
              Catat interaksi
            </button>
          )}
        </div>
      </header>
      {personContext.personId && (
        <div className="ix-context">
          <strong>{personContext.person?.fullName || "Konteks Jamaah"}</strong>
          <div className="ix-actions">
            {profileAllowed && (
              <Link
                className="ix-text-button"
                to={"/people/" + personContext.personId + "?tab=interactions"}
              >
                Profil Jamaah
                <ArrowRight size={14} />
              </Link>
            )}
            <button className="ix-text-button" onClick={personContext.clear}>
              Semua Jamaah
            </button>
          </div>
        </div>
      )}
      {notice && (
        <div className="ix-notice" role="status">
          {notice}
          <button className="ix-text-button" onClick={() => setNotice("")}>
            Tutup
          </button>
        </div>
      )}
      <section className="ix-stats" aria-label="Ringkasan interaksi">
        {[
          [MessageSquare, "Catatan", stats?.totalAll],
          [Clock, "Hari ini", stats?.todayCount],
          [ClipboardList, "Perlu tindak lanjut", stats?.needFollowUpCount],
          [ShieldCheck, "Akses terbatas", stats?.privateCount],
        ].map(([Icon, label, count]: any, i) => (
          <div key={label}>
            <span className={"ix-stat-icon tone-" + i}>
              <Icon size={19} />
            </span>
            <div>
              <strong>
                {busy || error || !stats
                  ? "—"
                  : (count ?? 0).toLocaleString("id-ID")}
              </strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </section>
      <nav className="ix-tabs" aria-label="Bagian interaksi">
        <button
          aria-current={archive === "active" && !followUp ? "page" : undefined}
          onClick={() => change({ archive: null, followUp: null })}
        >
          Riwayat
        </button>
        <button
          aria-current={
            archive === "active" && followUp === "needed" ? "page" : undefined
          }
          onClick={() => change({ archive: null, followUp: "needed" })}
        >
          Tindak lanjut
        </button>
        <button
          aria-current={archive === "archived" ? "page" : undefined}
          onClick={() => change({ archive: "archived", followUp: null })}
        >
          Arsip
        </button>
      </nav>
      <section className="ix-filters" aria-label="Filter interaksi">
        <div className="ix-search">
          <Search size={17} />
          <input
            aria-label="Cari interaksi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama, WhatsApp, ringkasan…"
          />
          <button
            className="ix-icon-button"
            aria-label="Muat ulang interaksi"
            onClick={() => setVersion((v) => v + 1)}
            disabled={busy}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {optionsError && (
          <div className="ix-notice is-error" role="alert">
            Pilihan PIC/event belum dapat dimuat.
            <button
              className="ix-text-button"
              onClick={() => setVersion((v) => v + 1)}
            >
              Coba lagi
            </button>
          </div>
        )}
        <div className="ix-filter-grid">
          {filterSelect("channel", "Kanal", CHANNELS)}
          {filterSelect("outcome", "Hasil", OUTCOMES)}
          {filterSelect("sensitivityLevel", "Akses", {
            standard: "Standar",
            confidential: "Konfidensial",
            restricted: "Terbatas",
          })}
          {filterSelect(
            "ownerUserId",
            "PIC",
            Object.fromEntries(
              options?.staff.map((row) => [row.id, row.fullName]) || [],
            ),
          )}
          <label>
            Dari tanggal
            <input
              type="date"
              aria-label="Dari tanggal"
              value={params.get("from") || ""}
              onInput={(e) => change({ from: e.currentTarget.value || null })}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              aria-label="Sampai tanggal"
              value={params.get("to") || ""}
              onInput={(e) => change({ to: e.currentTarget.value || null })}
            />
          </label>
          {options?.canEvents && (
            <div className="ix-event-filter">
              {filterSelect(
                "eventId",
                "Event",
                Object.fromEntries(
                  options.events.map((row) => [row.id, row.title]),
                ),
              )}
            </div>
          )}
        </div>
        {Object.keys(filters).some(
          (key) => !["personId", "page", "pageSize", "archive"].includes(key),
        ) && (
          <button
            className="ix-text-button"
            onClick={() => {
              setSearch("");
              change(
                Object.fromEntries(
                  [
                    "search",
                    "channel",
                    "outcome",
                    "sensitivityLevel",
                    "ownerUserId",
                    "eventId",
                    "followUp",
                    "from",
                    "to",
                  ].map((key) => [key, null]),
                ),
              );
            }}
          >
            Reset filter
          </button>
        )}
      </section>
      {error ? (
        <div className="ix-notice is-error" role="alert">
          {error}
          <button
            className="ix-button"
            onClick={() => setVersion((v) => v + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : busy ? (
        <div className="ix-empty" role="status">
          <LoaderCircle className="animate-spin" />
          Memuat interaksi…
        </div>
      ) : !list.length ? (
        <div className="ix-empty">
          <MessageSquare size={30} />
          <h2>
            {archive === "archived"
              ? "Arsip masih kosong"
              : "Belum ada interaksi yang cocok"}
          </h2>
          <p>Sesuaikan filter atau catat komunikasi baru.</p>
        </div>
      ) : (
        <>
          <div className="ix-section-title">
            <h2>
              {archive === "archived"
                ? "Arsip interaksi"
                : followUp
                  ? "Antrean tindak lanjut"
                  : "Riwayat komunikasi"}
            </h2>
            <span>{pagination.totalCount.toLocaleString("id-ID")} catatan</span>
          </div>
          <div className="ix-records">
            {list.map((item) => (
              <article key={item.id} className="ix-record">
                <div className="ix-record-mark">
                  <MessageSquare size={18} />
                </div>
                <div className="ix-record-main">
                  <div className="ix-record-top">
                    <h3>
                      {profileAllowed ? (
                        <Link
                          to={"/people/" + item.personId + "?tab=interactions"}
                        >
                          {item.person?.fullName || "Jamaah"}
                        </Link>
                      ) : (
                        item.person?.fullName || "Jamaah"
                      )}
                    </h3>
                    <time>{time(item.occurredAt)} WIB</time>
                  </div>
                  <div className="ix-badges">
                    <span className="ix-badge">
                      {CHANNELS[item.channel] || item.channel}
                    </span>
                    {item.outcome && (
                      <span
                        className={
                          "ix-badge " +
                          ([
                            "minta_dihubungi_kembali",
                            "perlu_eskalasi",
                            "tidak_merespons",
                          ].includes(item.outcome)
                            ? "is-warning"
                            : "")
                        }
                      >
                        {OUTCOMES[item.outcome] || "Hasil tercatat"}
                      </span>
                    )}
                    {item.sensitivityLevel !== "standard" && (
                      <span className="ix-badge is-private">
                        <ShieldCheck size={12} />
                        {item.sensitivityLevel === "restricted"
                          ? "Terbatas"
                          : "Konfidensial"}
                      </span>
                    )}
                  </div>
                  <p className="ix-summary">{item.summary}</p>
                  <div className="ix-record-meta">
                    <span>
                      PIC {item.owner?.fullName || "Belum ditetapkan"}
                    </span>
                    {item.event && (
                      <span>
                        <CalendarDays size={13} />
                        {item.event.title}
                      </span>
                    )}
                    {item.followUps?.length > 0 && (
                      <span>
                        {item.followUps.length} tugas ·{" "}
                        {
                          item.followUps.filter((t) => t.status === "completed")
                            .length
                        }{" "}
                        selesai
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="ix-button"
                  onClick={() => change({ interactionId: item.id })}
                >
                  Detail
                  <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
          <nav className="ix-pagination" aria-label="Halaman interaksi">
            <span>
              Halaman {pagination.page} dari {pagination.totalPages}
            </span>
            <div className="ix-actions">
              <button
                className="ix-button"
                disabled={pagination.page <= 1}
                onClick={() => change({ page: String(pagination.page - 1) })}
              >
                <ChevronLeft size={15} />
                Sebelumnya
              </button>
              <button
                className="ix-button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => change({ page: String(pagination.page + 1) })}
              >
                Berikutnya
                <ChevronRight size={15} />
              </button>
            </div>
          </nav>
        </>
      )}
      <InteractionForm
        isOpen={create || intent.active}
        onClose={() => {
          setCreate(false);
          change({ action: null, new: null });
        }}
        onSuccess={success}
        initialPersonId={personContext.personId || undefined}
        initialPersonName={personContext.person?.fullName}
      />
      {selectedId && (
        <InteractionDetail
          id={selectedId}
          version={version}
          profileAllowed={profileAllowed}
          eventAllowed={eventAllowed}
          taskAllowed={taskAllowed}
          onClose={() => change({ interactionId: null })}
          onChanged={() => setVersion((v) => v + 1)}
        />
      )}
      {exportOpen && (
        <InteractionAction
          title="Ekspor interaksi"
          mode="export"
          filters={filters}
          onClose={() => setExportOpen(false)}
          onSuccess={() => {
            setExportOpen(false);
            setNotice("Ekspor hasil filter selesai.");
          }}
        />
      )}
    </div>
  );
}
function InteractionDetail({
  id,
  version,
  onClose,
  onChanged,
  profileAllowed,
  eventAllowed,
  taskAllowed,
}: {
  id: string;
  version: number;
  onClose: () => void;
  onChanged: () => void;
  profileAllowed: boolean;
  eventAllowed: boolean;
  taskAllowed: boolean;
}) {
  const [item, setItem] = useState<InteractionItem | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [edit, setEdit] = useState(false),
    [action, setAction] = useState<"archive" | "restore" | "followup" | null>(
      null,
    );
  useEffect(() => {
    const controller = new AbortController();
    setItem(null);
    setError("");
    void apiClient<InteractionItem>("/interactions/" + id, {
      signal: controller.signal,
    })
      .then((result) => setItem(result.data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, version, retry]);
  return (
    <InteractionDialog open title="Detail interaksi" onClose={onClose}>
      <div className="ix-dialog-body">
        {error ? (
          <div className="ix-notice is-error" role="alert">
            {error}
            <button
              className="ix-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              Coba lagi
            </button>
          </div>
        ) : !item ? (
          <p role="status">Memuat catatan…</p>
        ) : (
          <>
            <div className="ix-section-title">
              <h3>{item.person?.fullName || "Jamaah"}</h3>
              {profileAllowed && (
                <Link
                  className="ix-text-button"
                  to={"/people/" + item.personId + "?tab=interactions"}
                >
                  Profil Jamaah
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
            <div className="ix-badges">
              {item.roomEntryId && (
                <Link
                  className="ix-text-button"
                  to={"/ruang-jamaah/kelola?pesan=" + item.roomEntryId}
                >
                  Pesan Ruang Jamaah
                  <ArrowRight size={14} />
                </Link>
              )}
              <span className="ix-badge">{CHANNELS[item.channel]}</span>
              <span className="ix-badge">
                {item.sensitivityLevel === "standard"
                  ? "Standar"
                  : item.sensitivityLevel === "restricted"
                    ? "Terbatas"
                    : "Konfidensial"}
              </span>
              {item.archivedAt && (
                <span className="ix-badge is-warning">Diarsipkan</span>
              )}
            </div>
            <p className="ix-full-summary">{item.summary}</p>
            {item.outcome && (
              <p className="ix-outcome">
                <strong>Hasil</strong>
                {OUTCOMES[item.outcome] || item.outcome}
              </p>
            )}
            <dl className="ix-detail-meta">
              <div>
                <dt>Waktu (WIB)</dt>
                <dd>{time(item.occurredAt)}</dd>
              </div>
              <div>
                <dt>PIC</dt>
                <dd>{item.owner?.fullName || "Belum ditetapkan"}</dd>
              </div>
              <div>
                <dt>Pencatat</dt>
                <dd>{item.creator?.fullName || "Staf"}</dd>
              </div>
              {item.event && (
                <div>
                  <dt>Event</dt>
                  <dd>
                    {eventAllowed ? (
                      <Link
                        to={
                          "/events?eventId=" + item.event.id + "&panel=settings"
                        }
                      >
                        {item.event.title}
                      </Link>
                    ) : (
                      item.event.title
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {item.archivedAt && (
              <div className="ix-notice">
                {item.archiveReason || "Catatan diarsipkan."}
              </div>
            )}
            <section className="ix-followups">
              <div className="ix-section-title">
                <h3>Tindak lanjut</h3>
                {taskAllowed && (
                  <Link
                    className="ix-text-button"
                    to={
                      (item.roomEntryId
                        ? "/tasks?roomEntryId="
                        : "/tasks?interactionId=") +
                      (item.roomEntryId || item.id) +
                      "&personId=" +
                      item.personId
                    }
                  >
                    Buka tugas
                    <ArrowRight size={14} />
                  </Link>
                )}
              </div>
              {item.followUps?.length ? (
                item.followUps.map((task) => (
                  <div className="ix-linked-task" key={task.id}>
                    <strong>{task.title}</strong>
                    <div>
                      <span className="ix-badge">
                        {TASK_LABELS[task.status] || task.status}
                      </span>
                      <time>{time(task.dueAt)} WIB</time>
                    </div>
                  </div>
                ))
              ) : (
                <p className="ix-muted">
                  Belum ada tugas yang dapat ditampilkan.
                </p>
              )}
              {item.canManage &&
                !item.archivedAt &&
                taskAllowed &&
                !item.followUps?.some((task) =>
                  ["pending", "in_progress", "waiting"].includes(task.status),
                ) && (
                  <button
                    className="ix-button"
                    onClick={() => setAction("followup")}
                  >
                    <Plus size={15} />
                    Buat tindak lanjut
                  </button>
                )}
            </section>
            {item.canManage && (
              <div className="ix-actions ix-management">
                {!item.archivedAt && (
                  <button className="ix-button" onClick={() => setEdit(true)}>
                    <Pencil size={15} />
                    Koreksi
                  </button>
                )}
                <button
                  className="ix-button"
                  onClick={() =>
                    setAction(item.archivedAt ? "restore" : "archive")
                  }
                >
                  {item.archivedAt ? (
                    <RotateCcw size={15} />
                  ) : (
                    <Archive size={15} />
                  )}{" "}
                  {item.archivedAt ? "Pulihkan" : "Arsipkan"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <footer>
        <button className="ix-button" onClick={onClose}>
          Tutup
        </button>
      </footer>
      {item && (
        <InteractionForm
          isOpen={edit}
          onClose={() => setEdit(false)}
          onSuccess={() => {
            setEdit(false);
            onChanged();
          }}
          item={item}
        />
      )}{" "}
      {action && item && (
        <InteractionAction
          title={
            action === "archive"
              ? "Arsipkan interaksi"
              : action === "restore"
                ? "Pulihkan interaksi"
                : "Buat tindak lanjut"
          }
          mode={action}
          item={item}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            onChanged();
          }}
        />
      )}
    </InteractionDialog>
  );
}
function InteractionAction({
  title,
  mode,
  item,
  filters,
  onClose,
  onSuccess,
}: {
  title: string;
  mode: "archive" | "restore" | "export" | "followup";
  item?: InteractionItem;
  filters?: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState(""),
    [due, setDue] = useState(
      toWibInput(new Date(Date.now() + 172800000).toISOString()),
    ),
    [priority, setPriority] = useState("medium"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiClient<any>(
        mode === "export"
          ? "/interactions/export"
          : "/interactions/" +
              item!.id +
              (mode === "restore"
                ? "/restore"
                : mode === "followup"
                  ? "/follow-up"
                  : ""),
        {
          method: mode === "archive" ? "DELETE" : "POST",
          body: JSON.stringify(
            mode === "export"
              ? { filters, reason }
              : mode === "followup"
                ? {
                    nextAction: reason,
                    taskDueAt: fromWibInput(due),
                    taskPriority: priority,
                  }
                : { reason },
          ),
        },
      );
      if (mode === "export") {
        const url = URL.createObjectURL(
          new Blob(["\uFEFF" + result.data.csv], {
            type: "text/csv;charset=utf-8",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "interaksi-jamaah.csv";
        link.click();
        URL.revokeObjectURL(url);
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <InteractionDialog open title={title} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="ix-dialog-body">
          {error && (
            <div className="ix-notice is-error" role="alert">
              {error}
            </div>
          )}
          {mode === "archive" && (
            <p className="ix-muted">
              Catatan dapat dipulihkan. Tugas yang sudah dibuat tetap tersimpan.
            </p>
          )}
          {mode === "export" && (
            <p className="ix-muted">
              Seluruh hasil filter, maksimal 5.000 catatan.
            </p>
          )}
          <label>
            {mode === "followup" ? "Tindakan *" : "Alasan *"}
            <textarea
              required
              minLength={3}
              maxLength={mode === "followup" ? 300 : 500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </label>
          {mode === "followup" && (
            <div className="ix-form-grid">
              <label>
                Tenggat (WIB) *
                <input
                  type="datetime-local"
                  required
                  value={due}
                  onInput={(e) => setDue(e.currentTarget.value)}
                  onChange={(e) => setDue(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Prioritas
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={busy}
                >
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </label>
            </div>
          )}
        </div>
        <footer>
          <button
            type="button"
            className="ix-button"
            disabled={busy}
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className="ix-button ix-primary"
            disabled={busy}
            type="submit"
          >
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            {mode === "export"
              ? "Unduh CSV"
              : mode === "archive"
                ? "Arsipkan"
                : mode === "restore"
                  ? "Pulihkan"
                  : "Simpan tugas"}
          </button>
        </footer>
      </form>
    </InteractionDialog>
  );
}
