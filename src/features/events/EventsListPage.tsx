import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  CalendarDays,
  MessageSquare,
  Plus,
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  ExternalLink,
  Users,
  QrCode,
  Settings2,
  Store,
  Copy,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Ticket,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useCreateIntent } from "@/lib/useCreateIntent";
import { LoadingState } from "@/components/common/LoadingState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EventManageModal } from "./EventManageModal";
import { EventSubmissionsModal } from "./EventSubmissionsModal";
import { EventScannerModal } from "./components/EventScannerModal";
import { EventBazaarManageModal } from "./components/EventBazaarManageModal";
import { EventEditModal } from "./components/EventEditModal";
import {
  EventWorkspaceNav,
  type EventPanel,
} from "./components/EventWorkspaceNav";
import { eventDateWib, registrationIsOpen } from "./utils/eventPresentation";
import "./events.css";

interface EventItem {
  id: string;
  title: string;
  category: string;
  speaker: string;
  startAt: string;
  endAt?: string | null;
  deliveryMode: string;
  locationName?: string | null;
  status: string;
  isPaid?: boolean;
  priceRupiah?: number | null;
  targetAudience?: string;
  quota?: number | null;
  isRegistrationOpen: boolean;
  attendanceCount: number;
  attendedCount: number;
  registeredCount: number;
}
const statuses = {
  scheduled: "Terjadwal",
  ongoing: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
const audiences: Record<string, string> = {
  umum: "Umum",
  ikhwan_only: "Ikhwan",
  akhwat_only: "Akhwat",
  anak: "Anak",
  itikaf_ramadan: "Iktikaf",
};
export const EventsListPage: React.FC = () => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const createIntent = useCreateIntent(PERMISSIONS.EVENTS_MANAGE);
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const manage = permissions.includes(PERMISSIONS.EVENTS_MANAGE);
  const attendance = permissions.includes(PERMISSIONS.ATTENDANCE_MANAGE);
  const [toast, setToast] = useState("");
  const [remove, setRemove] = useState<EventItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const q = params.get("q") || "";
  const status = params.get("status") || "all";
  const category = params.get("category") || "all";
  const audience = params.get("audience") || "all";
  const mode = params.get("mode") || "all";
  const [search, setSearch] = useState(q);
  useEffect(() => {
    setSearch(q);
  }, [q]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);
  const change = (patch: Record<string, string | null>, resetPage = true) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (search.trim()) next.set("q", search.trim());
        else next.delete("q");
        if (resetPage) next.delete("page");
        for (const [key, value] of Object.entries(patch)) {
          if (value && value !== "all") next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient<EventItem[]>("/events");
      setEvents(res.data || []);
    } catch (e: any) {
      setError(e.message || "Daftar event gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const eventId = params.get("eventId");
  const panel = (
    ["settings", "scanner", "bazaar", "edit"].includes(
      params.get("panel") || "",
    )
      ? params.get("panel")
      : "participants"
  ) as EventPanel | "edit";
  const currentEvent = events.find((event) => event.id === eventId);
  const openPanel = (id: string, next: EventPanel | "edit") =>
    change({ eventId: id, panel: next }, false);
  const closePanel = () => {
    change({ eventId: null, panel: null }, false);
    void load();
  };
  const filtered = events.filter((event) => {
    const text =
      `${event.title} ${event.speaker} ${event.locationName || ""} ${event.category}`.toLowerCase();
    return (
      text.includes(q.toLowerCase()) &&
      (category === "all" || category === event.category) &&
      (audience === "all" || audience === event.targetAudience) &&
      (mode === "all" || mode === event.deliveryMode) &&
      (status === "all" ||
        (status === "open_reg"
          ? registrationIsOpen(event)
          : status === "closed_reg"
            ? !registrationIsOpen(event)
            : status === "upcoming"
              ? new Date(event.startAt).getTime() > Date.now() &&
                !["cancelled", "completed"].includes(event.status)
              : status === event.status))
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  const page = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const shown = filtered.slice((page - 1) * 9, page * 9);
  const list = params.get("view") === "list";
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/kajian/${id}`,
      );
      setToast("Tautan pendaftaran disalin.");
    } catch {
      setToast("Tautan gagal disalin. Buka halaman publik untuk menyalinnya.");
    }
  };
  const actions = (event: EventItem) => (
    <div className="event-card-actions">
      {permissions.includes(PERMISSIONS.INTERACTIONS_VIEW)&&<Link className="event-icon" title="Pesan jamaah" aria-label={`Pesan jamaah ${event.title}`} to={'/ruang-jamaah/kelola?eventId='+event.id}><MessageSquare size={17}/></Link>}
      <button
        className="event-button primary"
        onClick={() => openPanel(event.id, "participants")}
      >
        <Users size={15} />
        Peserta <span>{event.attendanceCount.toLocaleString("id-ID")}</span>
      </button>
      {attendance && (
        <button
          className="event-icon"
          title="Scanner"
          aria-label={`Scanner ${event.title}`}
          onClick={() => openPanel(event.id, "scanner")}
        >
          <QrCode size={17} />
        </button>
      )}
      {manage && (
        <>
          <button
            className="event-icon"
            title="Pengaturan"
            aria-label={`Pengaturan ${event.title}`}
            onClick={() => openPanel(event.id, "settings")}
          >
            <Settings2 size={17} />
          </button>
          <button
            className="event-icon"
            title="Bazar"
            aria-label={`Bazar ${event.title}`}
            onClick={() => openPanel(event.id, "bazaar")}
          >
            <Store size={17} />
          </button>
        </>
      )}
      <details className="event-more">
        <summary aria-label={`Opsi ${event.title}`}>•••</summary>
        <div>
          {manage && (
            <button onClick={() => openPanel(event.id, "edit")}>
              <Pencil size={14} />
              Edit jadwal
            </button>
          )}
          <button onClick={() => void copy(event.id)}>
            <Copy size={14} />
            Salin tautan
          </button>
          <Link to={`/kajian/${event.id}`} target="_blank">
            <ExternalLink size={14} />
            Halaman publik
          </Link>
          {manage && (
            <button className="danger" onClick={() => setRemove(event)}>
              <Trash2 size={14} />
              Hapus jadwal kosong
            </button>
          )}
        </div>
      </details>
    </div>
  );
  return (
    <div className="events-workspace">
      <header className="events-heading">
        <div>
          <span className="event-eyebrow">KEGIATAN YAYASAN</span>
          <h1>Event & presensi</h1>
          <p>Kelola kegiatan, peserta, dan kehadiran dalam satu alur.</p>
        </div>
        <div className="event-heading-actions">
          <Link className="event-button" to="/kajian" target="_blank">
            <ExternalLink size={16} />
            Portal kajian
          </Link>
          {manage && (
            <button
              className="event-button primary"
              onClick={() =>
                change({ action: "create", eventId: null, panel: null }, false)
              }
            >
              <Plus size={17} />
              Buat event
            </button>
          )}
        </div>
      </header>
      <section className="event-metrics" aria-label="Ringkasan event">
        {(
          [
            ["Total event", events.length, CalendarDays, "forest"],
            [
              "Pendaftaran buka",
              events.filter((event) => registrationIsOpen(event)).length,
              Ticket,
              "gold",
            ],
            [
              "Pendaftaran peserta",
              events.reduce((sum, event) => sum + event.attendanceCount, 0),
              Users,
              "clay",
            ],
            [
              "Kehadiran tercatat",
              events.reduce((sum, event) => sum + event.attendedCount, 0),
              CheckCircle2,
              "forest",
            ],
          ] as const
        ).map(([label, value, Icon, tone]) => (
          <div className={`event-metric ${tone}`} key={label}>
            <span>
              <Icon size={17} />
              {label}
            </span>
            <strong>
              {loading && !events.length ? "—" : value.toLocaleString("id-ID")}
            </strong>
          </div>
        ))}
      </section>
      <section className="event-directory" aria-label="Daftar event">
        <div className="event-toolbar">
          <form
            className="event-search"
            onSubmit={(event) => {
              event.preventDefault();
              change({ q: search.trim() });
            }}
          >
            <Search size={18} />
            <input
              aria-label="Cari event"
              placeholder="Cari event, pemateri, lokasi…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  change({ q: null });
                }}
                aria-label="Hapus pencarian"
              >
                ×
              </button>
            )}
            <button type="submit">Cari</button>
          </form>
          <div className="event-view">
            <button
              className="event-icon"
              aria-label="Tampilan kartu"
              aria-pressed={!list}
              onClick={() => change({ view: null }, false)}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className="event-icon"
              aria-label="Tampilan daftar"
              aria-pressed={list}
              onClick={() => change({ view: "list" }, false)}
            >
              <List size={18} />
            </button>
            <button
              className="event-icon"
              disabled={loading}
              aria-label="Muat ulang event"
              onClick={() => void load()}
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="event-filters">
          <label>
            Status
            <select
              value={status}
              onChange={(event) => change({ status: event.target.value })}
            >
              {[
                ["all", "Semua status"],
                ["upcoming", "Agenda mendatang"],
                ["open_reg", "Pendaftaran buka"],
                ["closed_reg", "Pendaftaran tutup"],
                ...Object.entries(statuses),
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kategori
            <select
              value={category}
              onChange={(event) => change({ category: event.target.value })}
            >
              <option value="all">Semua kategori</option>
              {[...new Set(events.map((event) => event.category))]
                .sort()
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
          <label>
            Peserta
            <select
              value={audience}
              onChange={(event) => change({ audience: event.target.value })}
            >
              <option value="all">Semua segmen</option>
              {Object.entries(audiences).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pelaksanaan
            <select
              value={mode}
              onChange={(event) => change({ mode: event.target.value })}
            >
              <option value="all">Semua mode</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
        </div>
        <div className="event-results">
          <strong>{filtered.length} event</strong>
          <span>Jadwal ditampilkan dalam WIB</span>
        </div>
        {error ? (
          <div className="event-empty" role="alert">
            <h2>Event belum dapat dimuat</h2>
            <p>{error}</p>
            <button className="event-button" onClick={() => void load()}>
              Coba lagi
            </button>
          </div>
        ) : loading && !events.length ? (
          <LoadingState message="Memuat event…" />
        ) : !shown.length ? (
          <div className="event-empty">
            <CalendarDays size={30} />
            <h2>Belum ada event yang sesuai</h2>
            <p>Coba kata kunci atau filter lain.</p>
            <button
              className="event-button"
              onClick={() => {
                setSearch("");
                change({
                  q: null,
                  category: null,
                  audience: null,
                  status: null,
                  mode: null,
                });
              }}
            >
              Reset filter
            </button>
          </div>
        ) : (
          <div className={`event-cards ${list ? "is-list" : ""}`}>
            {shown.map((event) => (
              <article className="event-card" key={event.id}>
                <div className="event-card-top">
                  <span className="event-category">{event.category}</span>
                  <span
                    className={`event-status ${event.status === "cancelled" ? "danger" : registrationIsOpen(event) ? "open" : ""}`}
                  >
                    {event.status === "cancelled"
                      ? "Dibatalkan"
                      : registrationIsOpen(event)
                        ? "Buka"
                        : "Tutup"}
                  </span>
                </div>
                <h2>{event.title}</h2>
                <p className="event-speaker">{event.speaker}</p>
                <div className="event-schedule">
                  <CalendarDays size={16} />
                  <span>{eventDateWib(event.startAt)}</span>
                </div>
                <p className="event-location">
                  {event.deliveryMode === "online"
                    ? "Online"
                    : event.locationName || "Lokasi belum diisi"}
                  {event.deliveryMode === "hybrid" ? " · Hybrid" : ""}
                </p>
                <div className="event-card-meta">
                  <span>
                    {audiences[event.targetAudience || "umum"] || "Umum"}
                  </span>
                  <span>
                    {statuses[event.status as keyof typeof statuses] ||
                      event.status}
                  </span>
                  <span>
                    {event.isPaid
                      ? `Rp${Number(event.priceRupiah || 0).toLocaleString("id-ID")}`
                      : "Gratis"}
                  </span>
                </div>
                <div className="event-attendance">
                  <div>
                    <span>Sudah hadir</span>
                    <strong>
                      {event.attendedCount.toLocaleString("id-ID")}{" "}
                      <small>
                        / {event.attendanceCount.toLocaleString("id-ID")}
                      </small>
                    </strong>
                  </div>
                  <progress
                    aria-label={`Kehadiran ${event.title}`}
                    max={Math.max(1, event.attendanceCount)}
                    value={event.attendedCount}
                  />
                </div>
                {actions(event)}
              </article>
            ))}
          </div>
        )}
        <footer className="event-pagination">
          <span>
            {filtered.length
              ? `${(page - 1) * 9 + 1}–${Math.min(page * 9, filtered.length)} dari ${filtered.length}`
              : "0 event"}
          </span>
          <div>
            <button
              className="event-icon"
              aria-label="Halaman sebelumnya"
              disabled={page <= 1}
              onClick={() => change({ page: String(page - 1) }, false)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {page} / {pages}
            </span>
            <button
              className="event-icon"
              aria-label="Halaman berikutnya"
              disabled={page >= pages}
              onClick={() => change({ page: String(page + 1) }, false)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>
      {(createIntent.active || (eventId && panel === "edit")) && (
        <EventEditModal
          key={eventId || "create"}
          eventId={eventId && panel === "edit" ? eventId : null}
          isOpen
          onClose={() => {
            createIntent.clear();
            if (eventId) closePanel();
          }}
          onEventUpdated={() => {
            void load();
            setToast(
              eventId
                ? "Event diperbarui."
                : "Event dibuat. Lanjutkan ke pengaturan atau peserta.",
            );
          }}
        />
      )}
      {eventId && panel === "participants" && (
        <EventSubmissionsModal
          key={eventId}
          eventId={eventId}
          isOpen
          onClose={closePanel}
          onRefreshList={load}
          workspaceNav={
            <EventWorkspaceNav
              active="participants"
              onChange={(next) => openPanel(eventId, next)}
            />
          }
        />
      )}
      {eventId && panel === "settings" && (
        <EventManageModal
          key={eventId}
          eventId={eventId}
          onClose={closePanel}
          onEventUpdated={load}
          onOpenParticipants={() => openPanel(eventId, "participants")}
          workspaceNav={
            <EventWorkspaceNav
              active="settings"
              onChange={(next) => openPanel(eventId, next)}
            />
          }
        />
      )}
      {eventId && panel === "scanner" && (
        <EventScannerModal
          isOpen
          eventId={eventId}
          eventTitle={currentEvent?.title || "Event YTS"}
          onClose={closePanel}
          workspaceNav={
            <EventWorkspaceNav
              active="scanner"
              onChange={(next) => openPanel(eventId, next)}
            />
          }
        />
      )}
      {eventId && panel === "bazaar" && (
        <EventBazaarManageModal
          isOpen
          eventId={eventId}
          onClose={closePanel}
          workspaceNav={
            <EventWorkspaceNav
              active="bazaar"
              onChange={(next) => openPanel(eventId, next)}
            />
          }
        />
      )}
      {remove && (
        <ConfirmDialog
          isOpen
          title="Hapus jadwal kosong"
          message={`Hapus “${remove.title}”? Event dengan riwayat peserta atau operasional tetap disimpan. Untuk membatalkan kegiatan, ubah status melalui Edit jadwal.`}
          confirmLabel={removing ? "Menghapus…" : "Hapus jadwal"}
          variant="danger"
          onClose={() => {
            if (!removing) setRemove(null);
          }}
          onConfirm={async () => {
            if (removing) return;
            setRemoving(true);
            try {
              await apiClient(`/events/${remove.id}`, { method: "DELETE" });
              setRemove(null);
              setToast("Jadwal kosong dihapus.");
              await load();
            } catch (error: any) {
              setToast(error.message);
              setRemove(null);
            } finally {
              setRemoving(false);
            }
          }}
        />
      )}
      {toast && (
        <div role="status" className="event-toast">
          {toast}
        </div>
      )}
    </div>
  );
};
