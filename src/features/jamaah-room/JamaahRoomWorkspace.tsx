/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Inbox,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  PERMISSIONS as P,
  type PermissionCode,
} from "@server/permissions/constants";
import { apiClient } from "@/lib/apiClient";
import {
  ROOM_CATEGORY_LABELS as CATEGORIES,
  ROOM_STATUS_LABELS as STATUSES,
} from "@/lib/jamaahRoomModel";
import { InteractionDialog as Dialog } from "../interactions/InteractionDialog";
import { RoomDetail } from "./RoomDetail";
import { type RoomResult, roomTime } from "./roomTypes";
import "./room-workbench.css";
const FILTERS = [
  "search",
  "queue",
  "status",
  "category",
  "eventId",
  "personId",
  "ownerUserId",
  "archive",
  "from",
  "to",
  "order",
  "page",
] as const;
export function JamaahRoomWorkspace() {
  const [params, setParams] = useSearchParams(),
    { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const pending = useRef(params),
    [search, setSearch] = useState(params.get("search") || "");
  const [result, setResult] = useState<RoomResult | null>(null),
    [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]),
    [modal, setModal] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const selectedId = params.get("pesan") || "";
  const filters = Object.fromEntries(
      FILTERS.flatMap((key) =>
        params.get(key) ? [[key, params.get(key)!]] : [],
      ),
    ),
    filterKey = new URLSearchParams(filters).toString();
  useEffect(() => {
    pending.current = params;
  }, [params]);
  function change(patch: Record<string, string | null>) {
    const next = new URLSearchParams(pending.current);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in patch) && !("pesan" in patch)) next.delete("page");
    pending.current = next;
    setParams(next);
  }
  useEffect(() => {
    setSearch(params.get("search") || "");
  }, [params.get("search")]);
  useEffect(() => {
    if (search === (params.get("search") || "")) return;
    const timer = setTimeout(() => change({ search: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, params.get("search")]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelected([]);
    apiClient<RoomResult>("/jamaah-room?" + filterKey, {
      signal: controller.signal,
    })
      .then(({ data, meta }) => {
        if (controller.signal.aborted) return;
        setResult(data);
        setMeta({
          page: Number(meta?.page || 1),
          total: Number(meta?.total || 0),
          totalPages: Number(meta?.totalPages || 1),
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filterKey, version]);
  const refresh = () => setVersion((v) => v + 1);
  function open(name: string) {
    setModal(name);
    setError("");
    setReason("");
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (modal === "bulk") {
        const { data } = await apiClient<{ updated: number }>(
          "/jamaah-room/bulk-review",
          { method: "PATCH", body: JSON.stringify({ ids: selected }) },
        );
        setNotice(data.updated + " pesan mulai ditangani.");
      } else {
        const { data } = await apiClient<{ csv: string; count: number }>(
          "/jamaah-room/export",
          { method: "POST", body: JSON.stringify({ filters, reason }) },
        );
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + data.csv], { type: "text/csv;charset=utf-8" }),
          ),
          a = document.createElement("a");
        a.href = url;
        a.download =
          "ruang-jamaah-" + new Date().toISOString().slice(0, 10) + ".csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice(data.count + " pesan diekspor.");
      }
      setModal("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proses belum berhasil.");
    } finally {
      setBusy(false);
    }
  }
  const archive = params.get("archive") === "archived",
    queue = params.get("queue") || "all";
  return (
    <div className="rw">
      <header className="rw-header">
        <div className="rw-heading">
          <span className="rw-mark">
            <Inbox size={25} />
          </span>
          <div>
            <p className="rw-eyebrow">LAYANAN JAMAAH</p>
            <h1>Ruang Jamaah</h1>
            <p>Pesan masuk, tanggapan, dan tindak lanjut dalam satu ruang.</p>
          </div>
        </div>
        <div className="rw-actions">
          <Link
            className="ix-button"
            to="/ruang-jamaah"
            target="_blank"
            rel="noreferrer"
          >
            Halaman publik
            <ExternalLink size={15} />
          </Link>
          <button
            className="ix-icon-button"
            aria-label="Muat ulang pesan"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={17} />
          </button>
          {permissions.includes(P.DATA_EXPORT) && (
            <button
              className="ix-button"
              disabled={loading || !!error}
              onClick={() => open("export")}
            >
              <Download size={15} />
              Ekspor
            </button>
          )}
        </div>
      </header>
      <div className="rw-summary" aria-label="Ringkasan hasil filter">
        {Object.entries(STATUSES).map(([key, label]) => (
          <button
            key={key}
            className={"rw-stat is-" + key}
            aria-pressed={params.get("status") === key}
            onClick={() =>
              change({ status: params.get("status") === key ? null : key })
            }
          >
            <span>{label}</span>
            <strong>
              {loading || error || !result
                ? "—"
                : result.summary.find((s) => s.status === key)?.count || 0}
            </strong>
          </button>
        ))}
      </div>
      <section className="rw-inbox" aria-label="Kotak masuk">
        <nav className="rw-tabs rw-queues" aria-label="Antrean pesan">
          {[
            ["all", "Semua pesan"],
            ["reply", "Perlu balasan"],
            ["followup", "Tindak lanjut"],
            ["curation", "Kurasi cerita"],
            ["archive", "Arsip"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={
                key === "archive" ? archive : !archive && queue === key
              }
              onClick={() =>
                change({
                  archive: key === "archive" ? "archived" : null,
                  queue: key === "archive" ? null : key || null,
                  status: null,
                })
              }
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="rw-filters">
          <label className="rw-search">
            <span className="rw-sr-only">Cari pesan</span>
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari referensi, judul, atau nama"
            />
          </label>
          <label>
            <span className="rw-sr-only">Jenis pesan</span>
            <select
              value={params.get("category") || ""}
              onChange={(e) => change({ category: e.target.value })}
            >
              <option value="">Semua jenis</option>
              {Object.entries(CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="rw-sr-only">PIC pesan</span>
            <select
              value={params.get("ownerUserId") || ""}
              onChange={(e) => change({ ownerUserId: e.target.value })}
            >
              <option value="">Semua PIC</option>
              {result?.staffOptions.map((staff) => (
                <option value={staff.id} key={staff.id}>
                  {staff.fullName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="rw-sr-only">Urutkan pesan</span>
            <select
              value={params.get("order") || "newest"}
              onChange={(e) => change({ order: e.target.value })}
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </label>
        </div>
        <details className="rw-more-filters">
          <summary>
            Filter lainnya
            {["eventId", "from", "to", "personId"].some((key) =>
              params.has(key),
            )
              ? " · aktif"
              : ""}
          </summary>
          <div className="rw-extra-filters">
            <label>
              Event terkait
              <select
                value={params.get("eventId") || ""}
                onChange={(e) => change({ eventId: e.target.value })}
              >
                <option value="">Semua event</option>
                {result?.eventOptions.map((event) => (
                  <option value={event.id} key={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sejak (WIB)
              <input
                type="date"
                value={params.get("from") || ""}
                onInput={(e) => change({ from: e.currentTarget.value })}
              />
            </label>
            <label>
              Sampai (WIB)
              <input
                type="date"
                value={params.get("to") || ""}
                onInput={(e) => change({ to: e.currentTarget.value })}
              />
            </label>
            <button
              className="ix-text-button"
              onClick={() => {
                setSearch("");
                change(Object.fromEntries(FILTERS.map((key) => [key, null])));
              }}
            >
              Reset filter
            </button>
          </div>
          {params.get("personId") && (
            <p className="rw-context">
              Pesan dari profil Jamaah yang dipilih{" "}
              <Link
                to={"/people/" + params.get("personId") + "?tab=interactions"}
              >
                Buka profil
                <ArrowRight size={14} />
              </Link>
              <button
                className="ix-text-button"
                onClick={() => change({ personId: null })}
              >
                Lepas filter Jamaah
              </button>
            </p>
          )}
        </details>
        {notice && (
          <p className="rw-notice" role="status">
            {notice}
          </p>
        )}
        {error && !modal && (
          <div className="rw-notice is-error" role="alert">
            {error}
            <button className="ix-button" onClick={refresh}>
              Coba lagi
            </button>
          </div>
        )}
        <div className="rw-list-meta">
          <span>
            {loading
              ? "Memuat pesan…"
              : error
                ? "Pesan belum dapat dimuat"
                : meta.total + " pesan"}
          </span>
          {selected.length > 0 && (
            <button
              className="ix-button is-primary"
              disabled={busy}
              onClick={() => open("bulk")}
            >
              Tangani {selected.length} pesan
            </button>
          )}
        </div>
        {loading ? (
          <div className="rw-empty" role="status">
            Memuat kotak masuk…
          </div>
        ) : !error && result?.items.length ? (
          <div className="rw-message-list">
            {result.items.map((item) => (
              <article className="rw-row" key={item.id}>
                {permissions.includes(P.INTERACTIONS_CREATE) && (
                  <label className="rw-select">
                    <span className="rw-sr-only">
                      Pilih pesan {item.reference}
                    </span>
                    <input
                      type="checkbox"
                      disabled={
                        item.status !== "new" ||
                        !item.canManage ||
                        !!item.archivedAt
                      }
                      checked={selected.includes(item.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, item.id]
                            : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </label>
                )}
                <button
                  className="rw-open-message"
                  onClick={() => change({ pesan: item.id })}
                >
                  <span className="rw-row-top">
                    <span className="rw-ref">#{item.reference}</span>
                    <span>{roomTime(item.createdAt)} WIB</span>
                  </span>
                  <strong>{item.subject}</strong>
                  <span className="rw-preview">{item.preview}</span>
                  <span className="rw-row-meta">
                    {item.name || "Jamaah anonim"} · {CATEGORIES[item.category]}
                    {item.eventTitle ? " · " + item.eventTitle : ""}
                  </span>
                </button>
                <div className="rw-row-state">
                  <span className={"rw-badge is-" + item.status}>
                    {STATUSES[item.status]}
                  </span>
                  {item.wantsReply &&
                    ["new", "reviewing"].includes(item.status) && (
                      <span className="rw-dot-label">Minta balasan</span>
                    )}
                  {item.hasOpenTasks && (
                    <span className="rw-dot-label">Tugas aktif</span>
                  )}
                  <small>{item.owner?.fullName || "Belum ada PIC"}</small>
                  {item.publishedAt && (
                    <span className="rw-badge is-responded">Terbit</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          !error && (
            <div className="rw-empty">
              <Inbox size={30} />
              <h2>
                {archive
                  ? "Belum ada arsip"
                  : "Tidak ada pesan pada filter ini"}
              </h2>
              <p>Pesan dari halaman Ruang Jamaah akan masuk ke sini.</p>
            </div>
          )
        )}
        <footer className="rw-pagination">
          <span>
            Halaman {meta.page} / {meta.totalPages}
          </span>
          <div className="rw-actions">
            <button
              className="ix-icon-button"
              aria-label="Halaman sebelumnya"
              disabled={loading || meta.page <= 1}
              onClick={() => change({ page: String(meta.page - 1) })}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="ix-icon-button"
              aria-label="Halaman berikutnya"
              disabled={loading || meta.page >= meta.totalPages}
              onClick={() => change({ page: String(meta.page + 1) })}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>
      {selectedId && (
        <RoomDetail
          key={selectedId}
          id={selectedId}
          staff={result?.staffOptions || []}
          permissions={permissions}
          onClose={() => change({ pesan: null })}
          onChanged={refresh}
        />
      )}
      <Dialog
        open={!!modal}
        title={
          modal === "bulk" ? "Mulai menangani pesan" : "Ekspor Ruang Jamaah"
        }
        busy={busy}
        onClose={() => setModal("")}
      >
        <form
          className="ix-dialog-body rw-detail"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error && (
            <p className="rw-notice is-error" role="alert">
              {error}
            </p>
          )}
          {modal === "bulk" ? (
            <p>
              {selected.length} pesan baru akan ditandai ditangani. Pesan tanpa
              PIC akan ditugaskan kepada Anda.
            </p>
          ) : (
            <label>
              Alasan ekspor
              <input
                required
                minLength={3}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="rw-actions">
            <button
              className="ix-button is-primary"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Memproses…"
                : modal === "bulk"
                  ? "Mulai tangani"
                  : "Unduh CSV"}
            </button>
            <button
              className="ix-button"
              type="button"
              disabled={busy}
              onClick={() => setModal("")}
            >
              Kembali
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
