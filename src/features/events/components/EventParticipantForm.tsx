import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useEventDialog } from "./useEventDialog";
export function EventParticipantForm({
  eventId,
  isPaid,
  onClose,
  onSaved,
}: {
  eventId: string;
  isPaid?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    gender: "ikhwan",
    email: "",
    cityRegency: "",
    age: "",
    vehicleType: "none",
    vehiclePlateNumber: "",
    isSpecialInvite: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useEventDialog(true, () => {
    if (!saving) onClose();
  });
  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <div
      className="event-overlay event-overlay-child"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-participant"
      tabIndex={-1}
    >
      <div className="event-form-sheet">
        <header>
          <div>
            <span className="event-eyebrow">PENDAFTARAN STAF</span>
            <h2 id="add-event-participant">Tambah peserta</h2>
          </div>
          <button
            type="button"
            className="event-icon"
            aria-label="Tutup tambah peserta"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} />
          </button>
        </header>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving) return;
            setSaving(true);
            setError("");
            try {
              await apiClient(`/events/${eventId}/participants/manual`, {
                method: "POST",
                body: JSON.stringify(form),
              });
              onSaved();
            } catch (error: any) {
              setError(error.message || "Gagal menambahkan peserta.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {error && (
            <p className="event-error" role="alert">
              {error}
            </p>
          )}
          {isPaid && (
            <p className="event-notice">
              Peserta menunggu verifikasi pembayaran sebelum check-in.
            </p>
          )}
          <div className="event-form-grid">
            <label>
              Nama lengkap
              <input
                autoComplete="name"
                value={form.fullName}
                minLength={3}
                maxLength={160}
                required
                onChange={(e) => update("fullName", e.target.value)}
              />
            </label>
            <label>
              WhatsApp
              <input
                type="tel"
                autoComplete="tel"
                value={form.phone}
                required
                onChange={(e) => update("phone", e.target.value)}
              />
            </label>
            <label>
              Gender
              <select
                value={form.gender}
                onChange={(e) => update("gender", e.target.value)}
              >
                <option value="ikhwan">Ikhwan</option>
                <option value="akhwat">Akhwat</option>
              </select>
            </label>
            <label>
              Usia
              <input
                type="number"
                min={1}
                max={120}
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            <label>
              Kota/kabupaten
              <input
                value={form.cityRegency}
                maxLength={120}
                onChange={(e) => update("cityRegency", e.target.value)}
              />
            </label>
            <label>
              Kendaraan
              <select
                value={form.vehicleType}
                onChange={(e) => update("vehicleType", e.target.value)}
              >
                <option value="none">Tanpa kendaraan</option>
                <option value="motorcycle">Motor</option>
                <option value="car">Mobil</option>
              </select>
            </label>
            {form.vehicleType !== "none" && (
              <label>
                Nomor polisi
                <input
                  value={form.vehiclePlateNumber}
                  maxLength={24}
                  onChange={(e) => update("vehiclePlateNumber", e.target.value)}
                />
              </label>
            )}
          </div>
          <label className="event-check">
            <input
              type="checkbox"
              checked={form.isSpecialInvite}
              onChange={(e) => update("isSpecialInvite", e.target.checked)}
            />
            Jalur undangan khusus
          </label>
          <footer>
            <button
              type="button"
              className="event-button"
              disabled={saving}
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="submit"
              className="event-button primary"
              disabled={saving}
            >
              <UserPlus size={16} />
              {saving ? "Menyimpan…" : "Tambah peserta"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
