import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ClipboardList,
  Link2,
  Mail,
  MessageSquare,
  Save,
  UserRound,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import {
  PERMISSIONS as P,
  type PermissionCode,
} from "@server/permissions/constants";
import {
  ROOM_CATEGORY_LABELS as CATEGORIES,
  ROOM_STATUS_LABELS as STATUSES,
  ROOM_OPEN_TASKS,
} from "@/lib/jamaahRoomModel";
import { INTERACTION_CHANNEL_LABELS as CHANNELS } from "@/lib/interactionModel";
import { InteractionDialog as Dialog } from "../interactions/InteractionDialog";
import { fromWibInput, toWibInput } from "../events/utils/eventPresentation";
import { ROOM_TASK_LABELS, roomTime, type RoomEntry } from "./roomTypes";
type Props = {
  id: string;
  staff: Array<{ id: string; fullName: string }>;
  permissions: PermissionCode[];
  onClose: () => void;
  onChanged: () => void;
};
const ACTIONS: Record<string, string> = {
  updated: "Data diperbarui",
  response_recorded: "Tanggapan dicatat",
  task_created: "Tugas dibuat",
  task_status_changed: "Status tugas diperbarui",
  reviewing: "Mulai ditangani",
  published: "Cerita diterbitkan",
  unpublished: "Publikasi ditarik",
  archived: "Pesan diarsipkan",
  restored: "Pesan dipulihkan",
  reassigned: "PIC dipindahkan",
};
export function RoomDetail({
  id,
  staff,
  permissions,
  onClose,
  onChanged,
}: Props) {
  const [entry, setEntry] = useState<RoomEntry | null>(null),
    [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    status: "new",
    ownerUserId: "",
    internalNote: "",
    publicTitle: "",
    publicText: "",
  });
  const [tab, setTab] = useState("handling"),
    [modal, setModal] = useState(""),
    [reason, setReason] = useState(""),
    [search, setSearch] = useState(""),
    [candidates, setCandidates] = useState<
      Array<{
        id: string;
        fullName: string;
        phoneE164?: string;
        email?: string;
      }>
    >([]),
    [personId, setPersonId] = useState("");
  const [candidateError, setCandidateError] = useState(""),
    [candidateBusy, setCandidateBusy] = useState(false);
  const [reply, setReply] = useState(""),
    [channel, setChannel] = useState("whatsapp"),
    [when, setWhen] = useState(toWibInput(new Date().toISOString()));
  const [taskTitle, setTaskTitle] = useState(""),
    [taskDue, setTaskDue] = useState(""),
    [taskType, setTaskType] = useState("whatsapp"),
    [priority, setPriority] = useState("medium");
  useEffect(() => {
    const controller = new AbortController();
    setEntry(null);
    setError("");
    apiClient<RoomEntry>("/jamaah-room/" + id, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setEntry(data);
        setDraft({
          status: data.status,
          ownerUserId: data.ownerUserId || "",
          internalNote: data.internalNote || "",
          publicTitle: data.publicTitle || "",
          publicText: data.publicText || "",
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, reload]);
  useEffect(() => {
    if (modal !== "person") return;
    const controller = new AbortController();
    setCandidateBusy(true);
    setCandidateError("");
    const timer = setTimeout(() => {
      const endpoint = search.trim()
        ? "/persons?search=" +
          encodeURIComponent(search.trim()) +
          "&pageSize=10"
        : "/jamaah-room/" + id + "/person-candidates";
      apiClient<any>(endpoint, { signal: controller.signal })
        .then(({ data }) => {
          if (!controller.signal.aborted)
            setCandidates(Array.isArray(data) ? data : data.items || []);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setCandidateError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCandidateBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [modal, search, id]);
  const dirty =
    !!entry &&
    (draft.status !== entry.status ||
      draft.ownerUserId !== (entry.ownerUserId || "") ||
      draft.internalNote !== (entry.internalNote || "") ||
      draft.publicTitle !== (entry.publicTitle || "") ||
      draft.publicText !== (entry.publicText || ""));
  const editable = !!entry?.canManage && !entry.archivedAt;
  function close() {
    if (busy) return;
    if (dirty) {
      setModal("discard");
      return;
    }
    onClose();
  }
  function open(name: string) {
    if (dirty && !["publish", "unpublish"].includes(name)) {
      setNotice("Simpan perubahan sebelum melanjutkan.");
      return;
    }
    setReason("");
    setError("");
    setModal(name);
    if (name === "person") {
      setSearch("");
      setPersonId(entry?.personId || "");
    }
    if (name === "reply") {
      setReply("");
      setWhen(toWibInput(new Date().toISOString()));
    }
  }
  async function mutate(path: string, method: string, payload: any) {
    if (!entry || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient(path, {
        method,
        body: JSON.stringify({
          ...payload,
          expectedUpdatedAt: entry.updatedAt,
        }),
      });
      setModal("");
      setReload((v) => v + 1);
      onChanged();
      setNotice("Perubahan tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally {
      setBusy(false);
    }
  }
  function save(published?: boolean) {
    void mutate("/jamaah-room/" + id, "PATCH", {
      ...draft,
      ownerUserId: draft.ownerUserId || null,
      ...(published !== undefined ? { published } : {}),
    });
  }
  const subTitle =
    modal === "person"
      ? "Tautkan Jamaah"
      : modal === "reply"
        ? "Catat tanggapan"
        : modal === "task"
          ? "Buat tugas"
          : modal === "discard"
            ? "Tinggalkan perubahan?"
            : modal === "publish"
              ? "Terbitkan cerita?"
              : modal === "unpublish"
                ? "Tarik publikasi?"
                : entry?.archivedAt
                  ? "Pulihkan pesan"
                  : "Arsipkan pesan";
  const pending = entry?.tasks.some((task) =>
    ROOM_OPEN_TASKS.includes(task.status),
  );
  return (
    <Dialog
      open
      title={entry ? "Pesan #" + entry.reference : "Detail pesan"}
      onClose={close}
      busy={busy}
    >
      <div
        className="ix-dialog-body rw-detail"
        onClickCapture={(event) => {
          if (dirty && (event.target as HTMLElement).closest('a[href^="/"]')) {
            event.preventDefault();
            setNotice("Simpan perubahan sebelum berpindah halaman.");
          }
        }}
      >
        {error && (
          <div role="alert" className="rw-notice is-error">
            {error}
            <button
              className="ix-text-button"
              disabled={busy}
              onClick={() => {
                setModal("");
                setReload((v) => v + 1);
              }}
            >
              Muat ulang
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="rw-notice">
            {notice}
          </p>
        )}
        {!entry ? (
          !error && <p role="status">Memuat pesan…</p>
        ) : (
          <>
            <div className="rw-badges">
              <span className={"rw-badge is-" + entry.status}>
                {STATUSES[entry.status]}
              </span>
              <span className="rw-badge">{CATEGORIES[entry.category]}</span>
              {entry.wantsReply && (
                <span className="rw-badge is-reply">Minta balasan</span>
              )}
              {entry.archivedAt && (
                <span className="rw-badge is-closed">Arsip</span>
              )}
            </div>
            <h3 className="rw-message-title">{entry.subject}</h3>
            <p className="rw-muted">
              {entry.name || "Jamaah anonim"} · {roomTime(entry.createdAt)} WIB
            </p>
            <p className="rw-message">{entry.message}</p>
            <div className="rw-context">
              <span>
                <UserRound size={15} />
                {entry.owner?.fullName || "Belum ada PIC"}
              </span>
              {entry.person ? (
                <Link to={"/people/" + entry.person.id + "?tab=interactions"}>
                  Profil: {entry.person.fullName}
                  <ArrowRight size={14} />
                </Link>
              ) : (
                <span>Belum ditautkan ke Jamaah</span>
              )}
              {entry.eventId && permissions.includes(P.EVENTS_VIEW) && (
                <Link to={"/events?eventId=" + entry.eventId}>
                  {entry.eventTitle || "Event terkait"}
                  <ArrowRight size={14} />
                </Link>
              )}
              {entry.wantsReply && entry.phone && (
                <a
                  href={"https://wa.me/" + entry.phone.replace(/\D/g, "")}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                  <ArrowRight size={14} />
                </a>
              )}
              {entry.wantsReply && entry.email && (
                <a href={"mailto:" + entry.email}>
                  <Mail size={14} />
                  Email
                </a>
              )}
            </div>
            {!entry.canManage && (
              <p className="rw-notice">
                Pesan ditangani {entry.owner?.fullName || "PIC lain"}.
                Administrator dapat memindahkan PIC.
              </p>
            )}
            {entry.archivedAt && (
              <p className="rw-notice">Diarsipkan: {entry.archiveReason}</p>
            )}
            <nav className="rw-tabs" aria-label="Bagian pesan">
              {[
                ["handling", "Penanganan"],
                ["history", "Riwayat"],
                ...(["cerita", "pengalaman"].includes(entry.category)
                  ? [["curation", "Kurasi cerita"]]
                  : []),
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key || "handling")}
                >
                  {label}
                </button>
              ))}
            </nav>
            <fieldset disabled={busy || !editable} className="rw-fields">
              {tab === "handling" && (
                <>
                  <div className="rw-pair">
                    <label>
                      Status
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, status: e.target.value }))
                        }
                      >
                        {Object.entries(STATUSES).map(([key, label]) => (
                          <option
                            key={key}
                            value={key}
                            disabled={key === "responded" && !entry.response}
                          >
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      PIC
                      <select
                        value={draft.ownerUserId}
                        disabled={!permissions.includes(P.TASKS_REASSIGN)}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            ownerUserId: e.target.value,
                          }))
                        }
                      >
                        <option value="">Belum ditugaskan</option>
                        {entry.owner &&
                          !staff.some((s) => s.id === entry.owner!.id) && (
                            <option value={entry.owner.id} disabled>
                              {entry.owner.fullName} (nonaktif)
                            </option>
                          )}
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Catatan internal
                    <textarea
                      value={draft.internalNote}
                      maxLength={3000}
                      rows={3}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          internalNote: e.target.value,
                        }))
                      }
                      placeholder="Langkah berikutnya atau alasan penutupan"
                    />
                  </label>
                  <div className="rw-actions">
                    <button
                      className="ix-button is-primary"
                      type="button"
                      disabled={!dirty}
                      onClick={() => save()}
                    >
                      <Save size={15} />
                      Simpan
                    </button>
                    {!entry.ownerUserId && (
                      <button
                        className="ix-button"
                        type="button"
                        disabled={dirty}
                        onClick={() =>
                          void mutate("/jamaah-room/" + id, "PATCH", {
                            ownerUserId: undefined,
                            status: "reviewing",
                          })
                        }
                      >
                        Ambil penanganan
                      </button>
                    )}
                    <button
                      className="ix-button"
                      type="button"
                      onClick={() => open("person")}
                    >
                      <Link2 size={15} />
                      {entry.person ? "Koreksi Jamaah" : "Tautkan Jamaah"}
                    </button>
                  </div>
                  <div className="rw-section-heading">
                    <h4>Tanggapan</h4>
                    <button
                      className="ix-text-button"
                      type="button"
                      onClick={() => open("reply")}
                    >
                      <MessageSquare size={15} />
                      Catat tanggapan
                    </button>
                  </div>
                  {entry.response ? (
                    <div className="rw-response">
                      <p>{entry.response}</p>
                      <small>
                        {entry.responseRecordedAt
                          ? roomTime(entry.responseRecordedAt) + " WIB · "
                          : ""}
                        {entry.replyChannel ? CHANNELS[entry.replyChannel] : ""}
                      </small>
                    </div>
                  ) : (
                    <p className="rw-muted">
                      Belum ada tanggapan yang dicatat.
                    </p>
                  )}
                  <div className="rw-section-heading">
                    <h4>Tindak lanjut</h4>
                    {permissions.includes(P.TASKS_CREATE) && (
                      <button
                        className="ix-text-button"
                        type="button"
                        disabled={pending || entry.status === "closed"}
                        onClick={() => open("task")}
                      >
                        <ClipboardList size={15} />
                        Buat tugas
                      </button>
                    )}
                  </div>
                </>
              )}
              {tab === "curation" && (
                <>
                  <p className="rw-notice">
                    {entry.publicationConsent
                      ? "Jamaah mengizinkan publikasi."
                      : "Jamaah tidak mengizinkan publikasi."}{" "}
                    {entry.anonymousPublication
                      ? "Nama disamarkan."
                      : "Nama panggilan ditampilkan."}
                  </p>
                  <label>
                    Judul publik
                    <input
                      value={draft.publicTitle}
                      maxLength={160}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, publicTitle: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Teks publik
                    <textarea
                      value={draft.publicText}
                      maxLength={4000}
                      rows={6}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, publicText: e.target.value }))
                      }
                    />
                  </label>
                  <p className="rw-muted">
                    Gunakan ringkasan tanpa kontak atau informasi pribadi.
                  </p>
                  <div className="rw-actions">
                    <button
                      className="ix-button"
                      type="button"
                      disabled={!dirty}
                      onClick={() => save()}
                    >
                      Simpan draf
                    </button>
                    {entry.publishedAt ? (
                      <button
                        className="ix-button"
                        type="button"
                        onClick={() => open("unpublish")}
                      >
                        Tarik publikasi
                      </button>
                    ) : (
                      <button
                        className="ix-button is-primary"
                        type="button"
                        disabled={!entry.publicationConsent}
                        onClick={() => open("publish")}
                      >
                        Terbitkan cerita
                      </button>
                    )}
                  </div>
                </>
              )}
            </fieldset>
            {tab === "handling" && (
              <>
                {entry.tasks.length ? (
                  <div className="rw-task-list">
                    {entry.tasks.map((task) => (
                      <div className="rw-task" key={task.id}>
                        <strong>{task.title}</strong>
                        <span>
                          {ROOM_TASK_LABELS[task.status]} ·{" "}
                          {roomTime(task.dueAt)} WIB
                        </span>
                        <Link to={"/tasks?roomEntryId=" + id}>
                          Kelola tugas
                          <ArrowRight size={14} />
                        </Link>
                        {editable &&
                          (permissions.includes(P.TASKS_UPDATE_OWN) ||
                            permissions.includes(P.TASKS_MANAGE_OWN)) &&
                          ROOM_OPEN_TASKS.includes(task.status) && (
                            <div className="rw-actions">
                              <button
                                className="ix-button"
                                disabled={busy || dirty}
                                onClick={() =>
                                  void mutate(
                                    "/tasks/" + task.id + "/status",
                                    "PATCH",
                                    { status: "completed" },
                                  )
                                }
                              >
                                Selesai
                              </button>
                              <button
                                className="ix-text-button"
                                disabled={busy || dirty}
                                onClick={() =>
                                  void mutate(
                                    "/tasks/" + task.id + "/status",
                                    "PATCH",
                                    { status: "cancelled" },
                                  )
                                }
                              >
                                Batalkan
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rw-muted">
                    Belum ada tugas. Buat tenggat bila perlu ditindaklanjuti.
                  </p>
                )}
                <div className="rw-actions rw-archive">
                  {entry.canManage && (
                    <button
                      className="ix-text-button"
                      type="button"
                      disabled={busy || pending}
                      onClick={() => open("archive")}
                    >
                      {entry.archivedAt ? "Pulihkan pesan" : "Arsipkan pesan"}
                    </button>
                  )}
                </div>
              </>
            )}
            {tab === "history" && (
              <div className="rw-timeline">
                {entry.activity.length ? (
                  entry.activity.map((log) => (
                    <article key={log.id}>
                      <strong>{ACTIONS[log.action] || log.action}</strong>
                      <span>
                        {log.actor?.fullName || "Petugas"} ·{" "}
                        {roomTime(log.occurredAt)} WIB
                      </span>
                      {log.content && <p>{log.content}</p>}
                      {log.details?.reason &&
                        log.details.reason !== log.content && (
                          <p>Alasan: {log.details.reason}</p>
                        )}
                      {log.interactionId && (
                        <Link
                          to={
                            "/interactions?interactionId=" + log.interactionId
                          }
                        >
                          Lihat interaksi
                          <ArrowRight size={14} />
                        </Link>
                      )}
                      {log.taskId && (
                        <Link to={"/tasks?roomEntryId=" + id}>
                          Lihat tugas
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="rw-muted">Belum ada aktivitas penanganan.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <Dialog
        open={!!modal}
        title={subTitle}
        onClose={() => {
          if (!busy) setModal("");
        }}
        busy={busy}
      >
        <form
          className="ix-dialog-body rw-detail"
          onSubmit={(e) => {
            e.preventDefault();
            if (modal === "person")
              void mutate("/jamaah-room/" + id, "PATCH", {
                personId: personId || null,
                reason,
              });
            else if (modal === "reply")
              void mutate("/jamaah-room/" + id + "/response", "POST", {
                response: reply,
                replyChannel: channel,
                responseOccurredAt: fromWibInput(when),
              });
            else if (modal === "task")
              void mutate("/jamaah-room/" + id + "/tasks", "POST", {
                title: taskTitle,
                dueAt: fromWibInput(taskDue),
                priority,
                taskType,
              });
            else if (modal === "archive")
              void mutate(
                "/jamaah-room/" + id + (entry?.archivedAt ? "/restore" : ""),
                entry?.archivedAt ? "POST" : "DELETE",
                { reason },
              );
            else if (modal === "publish") save(true);
            else if (modal === "unpublish") save(false);
            else {
              setModal("");
              onClose();
            }
          }}
        >
          {error && (
            <p className="rw-notice is-error" role="alert">
              {error}
            </p>
          )}
          <fieldset className="rw-fields" disabled={busy}>
            {modal === "person" && (
              <>
                <label>
                  Cari Jamaah
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nama, WhatsApp, atau email"
                  />
                </label>
                {candidateBusy ? (
                  <p role="status">Mencari…</p>
                ) : candidateError ? (
                  <p role="alert">{candidateError}</p>
                ) : (
                  <div className="rw-person-list">
                    {candidates.map((candidate) => (
                      <label key={candidate.id}>
                        <input
                          type="radio"
                          name="room-person"
                          value={candidate.id}
                          checked={personId === candidate.id}
                          onChange={() => setPersonId(candidate.id)}
                        />
                        <span>
                          <strong>{candidate.fullName}</strong>
                          <small>
                            {candidate.phoneE164 ||
                              candidate.email ||
                              "Tanpa kontak"}
                          </small>
                        </span>
                      </label>
                    ))}
                    {!candidates.length && (
                      <p>Belum ada hasil. Cari profil Jamaah yang benar.</p>
                    )}
                  </div>
                )}
                {entry?.personId && (
                  <label className="rw-check">
                    <input
                      type="checkbox"
                      checked={!personId}
                      onChange={(e) =>
                        setPersonId(e.target.checked ? "" : entry.personId!)
                      }
                    />
                    Lepas tautan profil
                  </label>
                )}
                <label>
                  Alasan penautan
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </>
            )}
            {modal === "reply" && (
              <>
                <p className="rw-notice">
                  Hubungi jamaah melalui kontaknya, lalu catat hasilnya di sini.
                  Tombol ini tidak mengirim pesan.
                </p>
                <label>
                  Ringkasan tanggapan
                  <textarea
                    required
                    minLength={3}
                    maxLength={3000}
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </label>
                <div className="rw-pair">
                  <label>
                    Kanal
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      {Object.entries(CHANNELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Waktu tanggapan (WIB)
                    <input
                      type="datetime-local"
                      required
                      value={when}
                      onInput={(e) => setWhen(e.currentTarget.value)}
                    />
                  </label>
                </div>
                {!entry?.personId && (
                  <p className="rw-muted">
                    Tautkan profil Jamaah agar tanggapan berikutnya masuk ke
                    Interactions.
                  </p>
                )}
              </>
            )}
            {modal === "task" && (
              <>
                <label>
                  Judul tugas
                  <input
                    required
                    minLength={3}
                    maxLength={300}
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </label>
                <label>
                  Tenggat (WIB)
                  <input
                    type="datetime-local"
                    required
                    value={taskDue}
                    onInput={(e) => setTaskDue(e.currentTarget.value)}
                  />
                </label>
                <div className="rw-pair">
                  <label>
                    Jenis
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value)}
                    >
                      {[
                        ["whatsapp", "WhatsApp"],
                        ["telepon", "Telepon"],
                        ["kunjungan", "Kunjungan"],
                        ["administrasi", "Administrasi"],
                      ].map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prioritas
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      {[
                        ["low", "Rendah"],
                        ["medium", "Normal"],
                        ["high", "Tinggi"],
                        ["urgent", "Mendesak"],
                      ].map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
            {modal === "archive" && (
              <label>
                Alasan {entry?.archivedAt ? "pemulihan" : "pengarsipan"}
                <textarea
                  required
                  minLength={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            {modal === "discard" && (
              <p>Perubahan yang belum disimpan akan ditinggalkan.</p>
            )}
            {modal === "publish" && (
              <p>
                Judul dan teks publik akan tampil di Ruang Jamaah sesuai izin
                penulis.
              </p>
            )}
            {modal === "unpublish" && (
              <p>
                Cerita akan ditarik dari halaman publik. Riwayat tetap
                tersimpan.
              </p>
            )}
            <div className="rw-actions">
              <button type="submit" className="ix-button is-primary">
                {busy
                  ? "Menyimpan…"
                  : modal === "discard"
                    ? "Tinggalkan"
                    : modal === "publish"
                      ? "Terbitkan"
                      : modal === "unpublish"
                        ? "Tarik publikasi"
                        : "Simpan"}
              </button>
              <button
                type="button"
                className="ix-button"
                onClick={() => setModal("")}
              >
                Kembali
              </button>
            </div>
          </fieldset>
        </form>
      </Dialog>
    </Dialog>
  );
}
