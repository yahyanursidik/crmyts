import { useEffect, useId, useRef, useState } from "react";
import { usePermissions } from "@refinedev/core";
import {
  PERMISSIONS as P,
  type PermissionCode,
} from "@server/permissions/constants";
import { LoaderCircle, Search, Check } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import {
  INTERACTION_CHANNEL_LABELS as CHANNELS,
  INTERACTION_OUTCOME_LABELS as OUTCOMES,
} from "@/lib/interactionModel";
import { toWibInput, fromWibInput } from "../events/utils/eventPresentation";
import { InteractionDialog } from "./InteractionDialog";
import { type InteractionItem, type InteractionOptions } from "./types";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  initialPersonId?: string;
  initialPersonName?: string;
  item?: InteractionItem | null;
}
export function InteractionForm({
  isOpen,
  onClose,
  onSuccess,
  initialPersonId,
  initialPersonName,
  item,
}: Props) {
  const { data: permissions = [] } = usePermissions<PermissionCode[]>({}),
    id = useId();
  const [person, setPerson] = useState<{
      id: string;
      fullName: string;
      isActive?: boolean;
    } | null>(null),
    [search, setSearch] = useState(""),
    [candidates, setCandidates] = useState<any[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [form, setForm] = useState({
    channel: "whatsapp",
    summary: "",
    outcome: "",
    sensitivityLevel: "standard",
    occurredAt: "",
    eventId: "",
    ownerUserId: "",
    nextAction: "",
    taskDueAt: "",
    taskPriority: "medium",
    reason: "",
  });
  const [makeTask, setMakeTask] = useState(false),
    [options, setOptions] = useState<InteractionOptions | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const instance = useRef(0);
  useEffect(() => {
    if (!isOpen) return;
    instance.current++;
    setBusy(false);
    setForm({
      channel: item?.channel || "whatsapp",
      summary: item?.summary || "",
      outcome: item?.outcome || "",
      sensitivityLevel: item?.sensitivityLevel || "standard",
      occurredAt: toWibInput(item?.occurredAt || new Date().toISOString()),
      eventId: item?.eventId || "",
      ownerUserId: "",
      nextAction: "",
      taskDueAt: toWibInput(new Date(Date.now() + 172800000).toISOString()),
      taskPriority: "medium",
      reason: "",
    });
    setMakeTask(false);
    setError("");
    setSearch("");
    setCandidates([]);
    setSearchError("");
    setPerson(
      item?.person ||
        (initialPersonId
          ? {
              id: initialPersonId,
              fullName: initialPersonName || "Memuat Jamaah…",
            }
          : null),
    );
    const controller = new AbortController();
    if (initialPersonId && !item)
      void apiClient<any>("/persons/" + initialPersonId + "/summary", {
        signal: controller.signal,
      })
        .then((result) => setPerson(result.data))
        .catch((e) => {
          if (!controller.signal.aborted) setSearchError(e.message);
        });
    return () => {
      controller.abort();
      instance.current++;
    };
  }, [isOpen, item?.id, initialPersonId, initialPersonName]);
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setOptions(null);
    void apiClient<InteractionOptions>(
      "/interactions/options" + (person?.id ? "?personId=" + person.id : ""),
      { signal: controller.signal },
    )
      .then((result) => setOptions(result.data))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [isOpen, person?.id]);
  useEffect(() => {
    if (!isOpen || person || search.trim().length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const result = await apiClient<any[]>(
          "/persons?search=" +
            encodeURIComponent(search.trim()) +
            "&pageSize=6",
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setCandidates(result.data.filter((row) => row.isActive !== false));
      } catch (e: any) {
        if (!controller.signal.aborted) setSearchError(e.message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, person, isOpen]);
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person || person.isActive === false) {
      setError("Pilih Jamaah aktif terlebih dahulu.");
      return;
    }
    if (!options || searchError) {
      setError(
        searchError || "Pilihan form belum dapat dimuat. Buka kembali form.",
      );
      return;
    }
    if (makeTask && (!form.nextAction.trim() || !form.taskDueAt)) {
      setError("Isi tindakan dan tenggat tugas.");
      return;
    }
    const current = instance.current;
    setBusy(true);
    setError("");
    try {
      let body: any = {
        channel: form.channel,
        summary: form.summary.trim(),
        outcome: form.outcome || null,
        sensitivityLevel: form.sensitivityLevel,
        eventId: form.eventId || null,
      };
      if (item) {
        body.reason = form.reason.trim();
        for (const key of [
          "channel",
          "summary",
          "outcome",
          "sensitivityLevel",
          "eventId",
        ] as const) {
          if (form[key] === (item[key] || "")) delete body[key];
        }
        if (form.occurredAt !== toWibInput(item.occurredAt))
          body.occurredAt = fromWibInput(form.occurredAt);
      } else
        body = {
          ...body,
          personId: person.id,
          occurredAt: fromWibInput(form.occurredAt),
          ownerUserId: form.ownerUserId || null,
          createFollowUpTask: makeTask,
          nextAction: makeTask ? form.nextAction.trim() : null,
          taskDueAt: makeTask ? fromWibInput(form.taskDueAt) : null,
          taskPriority: form.taskPriority,
        };
      const result = await apiClient(
        item ? "/interactions/" + item.id : "/interactions",
        { method: item ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (current === instance.current) {
        onSuccess?.(result.data);
        onClose();
      }
    } catch (e: any) {
      if (current === instance.current)
        setError(e.message || "Interaksi belum tersimpan.");
    } finally {
      if (current === instance.current) setBusy(false);
    }
  };
  const select = (
    key: keyof typeof form,
    label: string,
    values: Record<string, string>,
    required = false,
  ) => (
    <label htmlFor={id + key}>
      {label}
      <select
        id={id + key}
        value={form[key]}
        disabled={busy}
        required={required}
        onChange={(e) => set(key, e.target.value)}
      >
        {Object.entries(values).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <InteractionDialog
      open={isOpen}
      title={item ? "Koreksi interaksi" : "Catat interaksi"}
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="ix-dialog-body">
          {error && (
            <div className="ix-notice is-error" role="alert">
              {error}
            </div>
          )}
          <div className="ix-person-picker">
            <label htmlFor={id + "person"}>Jamaah *</label>
            {person ? (
              <div className="ix-selected">
                <strong>{person.fullName}</strong>
                {!initialPersonId && !item && (
                  <button
                    type="button"
                    className="ix-text-button"
                    onClick={() => {
                      setPerson(null);
                      setSearch("");
                    }}
                  >
                    Ganti
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="ix-search">
                  <Search size={16} />
                  <input
                    id={id + "person"}
                    aria-label="Cari Jamaah"
                    placeholder="Nama atau WhatsApp, minimal 2 karakter"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={busy}
                  />
                  {searching && (
                    <LoaderCircle className="animate-spin" size={15} />
                  )}
                </div>
                {searchError && (
                  <p role="alert" className="ix-error-text">
                    {searchError}
                  </p>
                )}
                {candidates.length > 0 && (
                  <div className="ix-candidates">
                    {candidates.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setPerson(row);
                          setCandidates([]);
                        }}
                      >
                        <strong>{row.fullName}</strong>
                        <span>
                          {row.phoneE164 || row.cityRegency || "Tanpa kontak"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim().length >= 2 &&
                  !searching &&
                  !candidates.length &&
                  !searchError && (
                    <p className="ix-muted">
                      Tidak ada Jamaah aktif yang cocok.
                    </p>
                  )}
              </>
            )}
          </div>
          <div className="ix-form-grid">
            {select("channel", "Kanal", CHANNELS)}
            <label>
              Waktu interaksi (WIB) *
              <input
                type="datetime-local"
                required
                value={form.occurredAt}
                onInput={(e) => set("occurredAt", e.currentTarget.value)}
                onChange={(e) => set("occurredAt", e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="ix-span">
              Ringkasan *
              <textarea
                rows={3}
                minLength={3}
                maxLength={4000}
                required
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                disabled={busy}
              />
            </label>
            {select("outcome", "Hasil", {
              "": "Belum ditentukan",
              ...OUTCOMES,
              ...(item?.outcome && !OUTCOMES[item.outcome]
                ? { [item.outcome]: "Hasil lama tersimpan" }
                : {}),
            })}
            {select("sensitivityLevel", "Akses catatan", {
              standard: "Standar",
              confidential: "Konfidensial",
              restricted: "Terbatas",
            })}
            {(options?.canEvents || item?.eventId) && (
              <label className="ix-span">
                Konteks event
                <select
                  value={form.eventId}
                  onChange={(e) => set("eventId", e.target.value)}
                  disabled={busy || !options?.canEvents}
                >
                  <option value="">Tanpa event</option>
                  {item?.event &&
                    !options?.events.some(
                      (event) => event.id === item.event!.id,
                    ) && (
                      <option value={item.event.id}>{item.event.title}</option>
                    )}
                  {options?.events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!item &&
              options &&
              options.staff.length > 1 &&
              select("ownerUserId", "PIC", {
                "": "Saya",
                ...Object.fromEntries(
                  options.staff.map((row) => [row.id, row.fullName]),
                ),
              })}
          </div>
          {!item && permissions.includes(P.TASKS_CREATE) && (
            <section className="ix-followup-form">
              <label className="ix-check">
                <input
                  type="checkbox"
                  checked={makeTask}
                  onChange={(e) => setMakeTask(e.target.checked)}
                  disabled={busy}
                />
                Buat tugas tindak lanjut
              </label>
              {makeTask && (
                <div className="ix-form-grid">
                  <label className="ix-span">
                    Tindakan *
                    <input
                      required
                      maxLength={300}
                      value={form.nextAction}
                      onChange={(e) => set("nextAction", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Tenggat (WIB) *
                    <input
                      type="datetime-local"
                      required
                      value={form.taskDueAt}
                      onInput={(e) => set("taskDueAt", e.currentTarget.value)}
                      onChange={(e) => set("taskDueAt", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  {select("taskPriority", "Prioritas", {
                    low: "Rendah",
                    medium: "Sedang",
                    high: "Tinggi",
                    urgent: "Mendesak",
                  })}
                </div>
              )}
            </section>
          )}
          {item && (
            <label>
              Alasan koreksi *
              <textarea
                rows={2}
                required
                minLength={3}
                maxLength={500}
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                disabled={busy}
              />
            </label>
          )}
        </div>
        <footer>
          <button
            type="button"
            className="ix-button"
            onClick={onClose}
            disabled={busy}
          >
            Batal
          </button>
          <button
            className="ix-button ix-primary"
            type="submit"
            disabled={busy || !options || !person || !!searchError}
          >
            {busy ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Simpan interaksi
          </button>
        </footer>
      </form>
    </InteractionDialog>
  );
}
