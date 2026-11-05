import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  ExternalLink,
  FileUp,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Settings2,
  Store,
  Users,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import {
  BAZAAR_CATEGORY_LABELS,
  BAZAAR_STATUS_LABELS,
  bazaarRegistrationOpen,
} from "@/lib/bazaarPolicy";
import { EventBazaarManageModal } from "../events/components/EventBazaarManageModal";
import { useEventDialog } from "../events/components/useEventDialog";
import { parseBazaarCsv, bazaarCsvTemplate } from "./importModel";
import "./bazaar.css";
type Panel =
  | "overview"
  | "layout"
  | "applications"
  | "operations"
  | "surveys"
  | "settings";
interface EventItem {
  id: string;
  title: string;
  speaker: string;
  startAt: string;
  endAt?: string | null;
  status: string;
  locationName?: string | null;
  bazaar?: {
    id: string;
    title: string;
    isOpen: boolean;
    registrationDeadline?: string | null;
    paymentConfigured?: boolean;
    boothsCount: number;
    availableBoothsCount: number;
    bookedBoothsCount: number;
    tenantsCount: number;
    verifiedTenantsCount: number;
    totalInfaqRupiah: number;
  } | null;
}
interface Tenant {
  id: string;
  personId?: string | null;
  brandName: string;
  businessCategory: string;
  picName: string;
  picPhone: string;
  picEmail?: string | null;
  address?: string | null;
  productDescription?: string | null;
  internalFlag: string;
  internalNotes?: string | null;
  isLegacyData?: boolean;
  totalParticipations?: number;
  lifetimeInfaqRupiah?: number;
  applications?: Array<{
    id: string;
    status: string;
    infaqAmountRupiah: number;
    bazaar?: { eventId: string; title: string };
    assignedBooth?: { code: string } | null;
  }>;
  incidents?: Array<{ id: string; description: string; recordedAt: string }>;
  evaluations?: Array<{
    id: string;
    internalNotes?: string | null;
    recommendNextEvent: boolean;
  }>;
}
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const day = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
export function BazaarWorkspace() {
  const [params, setParams] = useSearchParams();
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({});
  const manage = permissions.includes(PERMISSIONS.EVENTS_MANAGE);
  const tab = params.get("tab") || "events";
  const eventId = params.get("eventId");
  const tenantId = params.get("tenantId");
  const panel = (
    [
      "overview",
      "layout",
      "applications",
      "operations",
      "surveys",
      "settings",
    ].includes(params.get("panel") || "")
      ? params.get("panel")
      : "overview"
  ) as Panel;
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);
  const status = params.get("status") || "all";
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const epoch = useRef(0);
  const change = (patch: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch))
        value ? next.set(key, value) : next.delete(key);
      return next;
    });
  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(
      () =>
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            search.trim() ? next.set("q", search.trim()) : next.delete("q");
            next.delete("page");
            return next;
          },
          { replace: true },
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, q, setParams]);
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setBusy(true);
    try {
      const result = await apiClient<EventItem[]>("/bazaar/overview");
      if (request !== epoch.current) return;
      setEvents(result.data);
      if (tab === "tenants") {
        const list = await apiClient<Tenant[]>("/bazaar/tenants");
        if (request !== epoch.current) return;
        setTenants(list.data);
      }
      setError("");
    } catch (err) {
      if (request === epoch.current)
        setError(
          err instanceof Error ? err.message : "Data bazar belum dapat dimuat.",
        );
    } finally {
      if (request === epoch.current) setBusy(false);
    }
  }, [tab]);
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const filteredEvents = (events || []).filter(
    (row) =>
      [row.title, row.speaker, row.locationName, row.bazaar?.title]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (status === "all" ||
        (status === "setup" && !row.bazaar) ||
        (status === "active" &&
          row.bazaar &&
          bazaarRegistrationOpen(row.bazaar, row)) ||
        (status === "closed" &&
          row.bazaar &&
          !bazaarRegistrationOpen(row.bazaar, row))),
  );
  const filteredTenants = (tenants || []).filter(
    (row) =>
      [row.brandName, row.picName, row.picPhone, row.picEmail]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (!params.get("category") ||
        row.businessCategory === params.get("category")) &&
      (!params.get("flag") || row.internalFlag === params.get("flag")),
  );
  const total =
    tab === "tenants" ? filteredTenants.length : filteredEvents.length;
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const open = (id: string, next: Panel) =>
    change({ eventId: id, panel: next });
  const copy = async (id: string, survey = false) => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin +
          "/bazar/" +
          id +
          (survey ? "/survey" : "/daftar"),
      );
      setNotice("Tautan " + (survey ? "survei" : "pendaftaran") + " disalin.");
    } catch {
      setError(
        "Tautan belum dapat disalin. Buka portal melalui tombol yang tersedia.",
      );
    }
  };
  const importRows = async (dryRun: boolean) => {
    setImporting(true);
    setImportError("");
    try {
      const rows = parseBazaarCsv(csv);
      const result = await apiClient<any>("/bazaar/tenants/import-legacy", {
        method: "POST",
        body: JSON.stringify({ rows, dryRun }),
      });
      setPreview(result.data);
      if (!dryRun) {
        setNotice(
          result.data.imported +
            " tenant baru; " +
            result.data.merged +
            " profil dilengkapi.",
        );
        await load();
      }
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Impor belum dapat diproses.",
      );
    } finally {
      setImporting(false);
    }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(
      new Blob([bazaarCsvTemplate], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-tenant-yts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="bz-workspace">
      <header className="bz-heading">
        <div>
          <span className="bz-eyebrow">Kegiatan & usaha Jamaah</span>
          <h1>Bazar & Tenant</h1>
          <p>Kurasi usaha, kelola stan, pantau operasional.</p>
        </div>
        <div className="bz-actions">
          <Link
            className="bz-button"
            to="/bazar"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={15} />
            Katalog publik
          </Link>
          <Link className="bz-button bz-primary" to="/events">
            <CalendarDays size={15} />
            Pilih event
          </Link>
        </div>
      </header>
      <section className="bz-stats" aria-label="Ringkasan bazar">
        {[
          {
            label: "Pendaftaran terbuka",
            value: events?.filter(
              (row) => row.bazaar && bazaarRegistrationOpen(row.bazaar, row),
            ).length,
            icon: Store,
          },
          {
            label: "Stan terisi",
            value: events?.reduce(
              (sum, row) => sum + (row.bazaar?.bookedBoothsCount || 0),
              0,
            ),
            icon: MapPin,
          },
          {
            label: "Tenant terverifikasi",
            value: events?.reduce(
              (sum, row) => sum + (row.bazaar?.verifiedTenantsCount || 0),
              0,
            ),
            icon: Users,
          },
          {
            label: "Infaq terverifikasi",
            value: events
              ? money(
                  events.reduce(
                    (sum, row) => sum + (row.bazaar?.totalInfaqRupiah || 0),
                    0,
                  ),
                )
              : null,
            icon: Coins,
          },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={label} className={"bz-stat bz-tone-" + i}>
            <span>
              <Icon size={20} />
            </span>
            <div>
              <strong>{value ?? "—"}</strong>
              <small>{label}</small>
            </div>
          </div>
        ))}
      </section>
      {notice && (
        <div role="status" className="bz-notice">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button aria-label="Tutup notifikasi" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="bz-error">
          {error}
          <button className="bz-button" onClick={() => void load()}>
            Coba lagi
          </button>
        </div>
      )}
      <nav className="bz-tabs" aria-label="Bagian bazar">
        {[
          { key: "events", label: "Bazar per event", icon: CalendarDays },
          { key: "tenants", label: "Direktori tenant", icon: Users },
          ...(manage
            ? [{ key: "import", label: "Impor tenant", icon: FileUp }]
            : []),
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() =>
              change({
                tab: key,
                page: null,
                q: null,
                status: null,
                category: null,
                flag: null,
              })
            }
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      {tab !== "import" && (
        <>
          <div className="bz-toolbar">
            <label className="bz-search">
              <Search size={17} />
              <input
                aria-label={tab === "tenants" ? "Cari tenant" : "Cari bazar"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "tenants"
                    ? "Brand, PIC, atau WhatsApp…"
                    : "Event, pemateri, atau lokasi…"
                }
              />
            </label>
            {tab === "events" ? (
              <select
                aria-label="Status bazar"
                value={status}
                onChange={(e) => change({ status: e.target.value, page: null })}
              >
                <option value="all">Semua event</option>
                <option value="active">Pendaftaran terbuka</option>
                <option value="closed">Tutup / riwayat</option>
                <option value="setup">Belum disiapkan</option>
              </select>
            ) : (
              <>
                <select
                  aria-label="Kategori tenant"
                  value={params.get("category") || ""}
                  onChange={(e) =>
                    change({ category: e.target.value, page: null })
                  }
                >
                  <option value="">Semua kategori</option>
                  {Object.entries(BAZAAR_CATEGORY_LABELS).map(
                    ([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <select
                  aria-label="Tinjauan tenant"
                  value={params.get("flag") || ""}
                  onChange={(e) => change({ flag: e.target.value, page: null })}
                >
                  <option value="">Semua tinjauan</option>
                  <option value="normal">Normal</option>
                  <option value="review_next_event">Tinjau kembali</option>
                  <option value="do_not_auto_accept">Perlu persetujuan</option>
                </select>
              </>
            )}
            <button
              className="bz-button"
              disabled={busy}
              aria-label="Muat ulang bazar"
              onClick={() => void load()}
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            </button>
          </div>
          {busy && !(tab === "events" ? events : tenants) ? (
            <div className="bz-empty">
              <LoaderCircle className="animate-spin" size={24} />
              Memuat data bazar…
            </div>
          ) : (
            <>
              <div className="bz-section-title">
                <h2>
                  {tab === "tenants" ? "Usaha Jamaah" : "Bazar per event"}
                </h2>
                <span>
                  {total} {tab === "tenants" ? "tenant" : "event"}
                </span>
              </div>
              {total === 0 ? (
                <div className="bz-empty">
                  <Store size={27} />
                  <h3>Belum ada hasil</h3>
                  <p>
                    {search
                      ? "Coba nama atau filter lain."
                      : tab === "tenants"
                        ? "Tenant baru dan hasil impor akan muncul di sini."
                        : "Siapkan bazar dari jadwal event yang tersedia."}
                  </p>
                </div>
              ) : tab === "events" ? (
                <div className="bz-event-grid">
                  {filteredEvents
                    .slice((page - 1) * 12, page * 12)
                    .map((row) => (
                      <article className="bz-event-card" key={row.id}>
                        <div className="bz-card-top">
                          <span className="bz-date">{day(row.startAt)}</span>
                          <span
                            className={
                              "bz-badge " +
                              (!row.bazaar
                                ? ""
                                : bazaarRegistrationOpen(row.bazaar, row)
                                  ? "bz-live"
                                  : "")
                            }
                          >
                            {!row.bazaar
                              ? "Belum disiapkan"
                              : bazaarRegistrationOpen(row.bazaar, row)
                                ? "Pendaftaran terbuka"
                                : "Tutup / riwayat"}
                          </span>
                        </div>
                        <h3>{row.bazaar?.title || row.title}</h3>
                        {row.bazaar?.title !== row.title && (
                          <p className="bz-event-name">{row.title}</p>
                        )}
                        <p>{row.locationName || "Lokasi belum diatur"}</p>
                        {row.bazaar ? (
                          <>
                            <div className="bz-card-metrics">
                              <span>
                                <strong>{row.bazaar.tenantsCount}</strong>
                                pendaftar
                              </span>
                              <span>
                                <strong>
                                  {row.bazaar.bookedBoothsCount}/
                                  {row.bazaar.boothsCount}
                                </strong>
                                stan terisi
                              </span>
                              <span>
                                <strong>
                                  {row.bazaar.availableBoothsCount}
                                </strong>
                                tersedia
                              </span>
                            </div>
                            <div className="bz-actions">
                              <button
                                className="bz-button bz-primary"
                                onClick={() => open(row.id, "applications")}
                              >
                                <Users size={14} />
                                Tenant
                              </button>
                              <button
                                className="bz-button"
                                onClick={() => open(row.id, "layout")}
                              >
                                <MapPin size={14} />
                                Stan
                              </button>
                              <button
                                className="bz-button"
                                onClick={() => open(row.id, "overview")}
                              >
                                Ringkasan
                                <ArrowRight size={14} />
                              </button>
                            </div>
                            {!row.bazaar.paymentConfigured && (
                              <button
                                className="bz-bank-pending"
                                onClick={() => open(row.id, "settings")}
                              >
                                Rekening belum diatur <Settings2 size={13} />
                              </button>
                            )}
                            <div className="bz-card-footer">
                              <Link
                                to={
                                  "/events?eventId=" +
                                  row.id +
                                  "&panel=settings"
                                }
                              >
                                Buka event <ExternalLink size={12} />
                              </Link>
                              <button onClick={() => void copy(row.id)}>
                                Salin formulir
                              </button>
                              <button onClick={() => void copy(row.id, true)}>
                                Survei
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="bz-actions">
                            <button
                              className="bz-button"
                              onClick={() => open(row.id, "overview")}
                            >
                              <Settings2 size={14} />
                              {manage ? "Siapkan bazar" : "Lihat event"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                </div>
              ) : (
                <div className="bz-tenant-list">
                  {filteredTenants
                    .slice((page - 1) * 12, page * 12)
                    .map((row) => (
                      <article className="bz-tenant" key={row.id}>
                        <span className="bz-tenant-icon">
                          <Store size={22} />
                        </span>
                        <div>
                          <h3>{row.brandName}</h3>
                          <p>
                            {BAZAAR_CATEGORY_LABELS[row.businessCategory] ||
                              row.businessCategory}{" "}
                            · {row.picName}
                          </p>
                          <small>{row.picPhone}</small>
                          <div className="bz-actions">
                            <span
                              className={
                                "bz-badge " +
                                (row.internalFlag === "normal" ? "bz-live" : "")
                              }
                            >
                              {row.internalFlag === "normal"
                                ? "Normal"
                                : row.internalFlag === "review_next_event"
                                  ? "Tinjau kembali"
                                  : "Perlu persetujuan"}
                            </span>
                            <span className="bz-badge">
                              {row.totalParticipations || 0} pendaftaran
                            </span>
                            {!row.personId && (
                              <span className="bz-badge">
                                Belum terhubung ke Jamaah
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="bz-button"
                          onClick={() => change({ tenantId: row.id })}
                        >
                          Profil
                          <ChevronRight size={14} />
                        </button>
                      </article>
                    ))}
                </div>
              )}
              {pages > 1 && (
                <nav className="bz-pagination" aria-label="Halaman bazar">
                  <button
                    className="bz-button"
                    disabled={page === 1}
                    aria-label="Halaman sebelumnya"
                    onClick={() => change({ page: String(page - 1) })}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span>
                    {page} / {pages}
                  </span>
                  <button
                    className="bz-button"
                    disabled={page === pages}
                    aria-label="Halaman berikutnya"
                    onClick={() => change({ page: String(page + 1) })}
                  >
                    <ChevronRight size={15} />
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
      {tab === "import" && manage && (
        <section className="bz-import">
          <div className="bz-section-title">
            <div>
              <h2>Impor tenant lama</h2>
              <p>Periksa data sebelum menambah atau melengkapi profil.</p>
            </div>
            <button className="bz-button" onClick={downloadTemplate}>
              <Download size={15} />
              Template CSV
            </button>
          </div>
          <label>
            Data CSV
            <textarea
              aria-label="Data CSV tenant"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
              placeholder={bazaarCsvTemplate}
              rows={8}
            />
          </label>
          <label className="bz-file">
            Buka berkas CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2_000_000) {
                    setImportError("Ukuran CSV maksimal 2 MB.");
                    return;
                  }
                  setCsv(await file.text());
                  setPreview(null);
                }
              }}
            />
          </label>
          {importError && (
            <div className="bz-error" role="alert">
              {importError}
            </div>
          )}
          <div className="bz-actions">
            <button
              className="bz-button"
              disabled={importing || !csv.trim()}
              onClick={() => void importRows(true)}
            >
              {importing ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Search size={15} />
              )}
              Periksa data
            </button>
            {preview?.dryRun && preview.invalid === 0 && (
              <button
                className="bz-button bz-primary"
                disabled={importing}
                onClick={() => void importRows(false)}
              >
                Terapkan {preview.totalProcessed} baris
              </button>
            )}
          </div>
          {preview && (
            <>
              <div className="bz-notice">
                {preview.dryRun ? "Pratinjau" : "Hasil impor"} ·{" "}
                {preview.totalProcessed} baris · {preview.invalid || 0} perlu
                diperbaiki
                {!preview.dryRun
                  ? " · " +
                    preview.imported +
                    " baru · " +
                    preview.merged +
                    " dilengkapi"
                  : ""}
              </div>
              <div className="bz-import-results">
                {preview.results.slice(0, 100).map((row: any) => (
                  <div key={row.row}>
                    <strong>Baris {row.row}</strong>
                    <span>{row.brandName || row.message}</span>
                    <span className="bz-badge">
                      {row.status === "create"
                        ? "Baru"
                        : row.status === "merge"
                          ? "Lengkapi profil"
                          : "Perbaiki"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {eventId && (
        <EventBazaarManageModal
          eventId={eventId}
          isOpen={true}
          initialTab={panel}
          onTabChange={(next) => change({ panel: next })}
          onClose={() => change({ eventId: null, panel: null })}
          onRefreshParent={() => void load()}
        />
      )}
      <BazaarTenantProfile
        id={tenantId}
        manage={manage}
        personAllowed={permissions.includes(PERMISSIONS.PERSONS_LIST)}
        onClose={() => change({ tenantId: null })}
        onSaved={() => void load()}
      />
    </div>
  );
}
function BazaarTenantProfile({
  id,
  manage,
  personAllowed,
  onClose,
  onSaved,
}: {
  id: string | null;
  manage: boolean;
  personAllowed: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useEventDialog(!!id, () => {
    if (!busy) onClose();
  });
  useEffect(() => {
    setTenant(null);
    setForm(null);
    setError("");
    if (!id) return;
    const controller = new AbortController();
    void apiClient<Tenant>("/bazaar/tenants/" + id, {
      signal: controller.signal,
    })
      .then((result) => {
        setTenant(result.data);
        const t = result.data;
        setForm({
          brandName: t.brandName,
          picName: t.picName,
          picPhone: t.picPhone,
          picEmail: t.picEmail || "",
          businessCategory: t.businessCategory,
          address: t.address || "",
          productDescription: t.productDescription || "",
          internalFlag: t.internalFlag,
          internalNotes: t.internalNotes || "",
        });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [id]);
  if (!id) return null;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiClient("/bazaar/tenants/" + id, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      const result = await apiClient<Tenant>("/bazaar/tenants/" + id);
      setTenant(result.data);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Profil belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bz-overlay">
      <div
        className="bz-profile"
        role="dialog"
        aria-modal="true"
        aria-label="Profil tenant"
        ref={ref}
        tabIndex={-1}
      >
        <header>
          <div>
            <span className="bz-eyebrow">Direktori usaha Jamaah</span>
            <h2>{tenant?.brandName || "Profil tenant"}</h2>
          </div>
          <button
            className="bz-button"
            aria-label="Tutup profil tenant"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="bz-profile-body">
          {error && (
            <div className="bz-error" role="alert">
              {error}
            </div>
          )}
          {!tenant && !error && (
            <div className="bz-empty">
              <LoaderCircle className="animate-spin" />
              Memuat profil…
            </div>
          )}
          {tenant && form && (
            <>
              <div className="bz-actions">
                {tenant.personId && personAllowed ? (
                  <Link className="bz-button" to={"/people/" + tenant.personId}>
                    Profil Jamaah
                    <ExternalLink size={14} />
                  </Link>
                ) : (
                  <span className="bz-badge">
                    {tenant.personId
                      ? "Jamaah terhubung"
                      : "Simpan profil untuk menghubungkan PIC ke Jamaah"}
                  </span>
                )}
                <span className="bz-badge">
                  {tenant.isLegacyData ? "Data impor" : "Pendaftaran portal"}
                </span>
              </div>
              <form onSubmit={save} className="bz-profile-form">
                {[
                  { key: "brandName", label: "Nama usaha", required: true },
                  { key: "picName", label: "Nama PIC", required: true },
                  { key: "picPhone", label: "WhatsApp", required: true },
                  { key: "picEmail", label: "Email" },
                ].map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <input
                      required={field.required}
                      type={field.key === "picEmail" ? "email" : "text"}
                      value={form[field.key]}
                      readOnly={!manage}
                      onChange={(e) =>
                        setForm({ ...form, [field.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Kategori
                  <select
                    disabled={!manage}
                    value={form.businessCategory}
                    onChange={(e) =>
                      setForm({ ...form, businessCategory: e.target.value })
                    }
                  >
                    {Object.entries(BAZAAR_CATEGORY_LABELS).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Tinjauan
                  <select
                    disabled={!manage}
                    value={form.internalFlag}
                    onChange={(e) =>
                      setForm({ ...form, internalFlag: e.target.value })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="review_next_event">Tinjau kembali</option>
                    <option value="do_not_auto_accept">
                      Perlu persetujuan
                    </option>
                  </select>
                </label>
                <label className="bz-full">
                  Produk
                  <textarea
                    value={form.productDescription}
                    readOnly={!manage}
                    onChange={(e) =>
                      setForm({ ...form, productDescription: e.target.value })
                    }
                  />
                </label>
                <label className="bz-full">
                  Catatan internal
                  <textarea
                    value={form.internalNotes}
                    readOnly={!manage}
                    onChange={(e) =>
                      setForm({ ...form, internalNotes: e.target.value })
                    }
                  />
                </label>
                {manage && (
                  <button
                    className="bz-button bz-primary bz-full"
                    disabled={busy}
                  >
                    {busy ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Simpan profil
                  </button>
                )}
              </form>
              <section>
                <h3>Riwayat bazar</h3>
                {tenant.applications?.length ? (
                  <div className="bz-profile-history">
                    {tenant.applications.map((app) => (
                      <article key={app.id}>
                        <div>
                          <strong>{app.bazaar?.title || "Bazar"}</strong>
                          <p>
                            {BAZAAR_STATUS_LABELS[app.status] || app.status} ·{" "}
                            {app.assignedBooth?.code || "Belum ada stan"}
                          </p>
                        </div>
                        <Link
                          className="bz-button"
                          onClick={onClose}
                          to={
                            "/bazaar?eventId=" +
                            app.bazaar?.eventId +
                            "&panel=applications"
                          }
                        >
                          Buka
                          <ArrowRight size={14} />
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Belum ada pendaftaran event.</p>
                )}
              </section>
              <section>
                <h3>Insiden & evaluasi</h3>
                {tenant.incidents?.map((item) => (
                  <p key={item.id}>
                    {day(item.recordedAt)} · {item.description}
                  </p>
                ))}
                {tenant.evaluations?.map((item) => (
                  <p key={item.id}>
                    {item.recommendNextEvent
                      ? "Direkomendasikan"
                      : "Perlu tinjauan"}
                    {item.internalNotes ? " · " + item.internalNotes : ""}
                  </p>
                ))}
                {!tenant.incidents?.length && !tenant.evaluations?.length && (
                  <p>Belum ada catatan.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
