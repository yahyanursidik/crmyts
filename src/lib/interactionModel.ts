export const INTERACTION_CHANNELS = [
  "whatsapp",
  "phone_call",
  "in_person",
  "telegram",
  "email",
  "other",
] as const;
export const INTERACTION_OUTCOMES = [
  "sudah_dihubungi",
  "tidak_merespons",
  "minta_dihubungi_kembali",
  "berminat",
  "belum_berminat",
  "selesai",
  "perlu_eskalasi",
] as const;
export const INTERACTION_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone_call: "Telepon",
  in_person: "Tatap muka",
  telegram: "Telegram",
  email: "Email",
  other: "Lainnya",
};
export const INTERACTION_OUTCOME_LABELS: Record<string, string> = {
  sudah_dihubungi: "Sudah dihubungi",
  tidak_merespons: "Belum merespons",
  minta_dihubungi_kembali: "Hubungi kembali",
  berminat: "Berminat",
  belum_berminat: "Belum berminat",
  selesai: "Selesai",
  perlu_eskalasi: "Perlu eskalasi",
};
export const OPEN_TASK_STATUSES = ["pending", "in_progress", "waiting"];
export function validInteractionInstant(value: string) {
  const day = value.slice(0, 10),
    date = new Date(day + "T00:00:00Z");
  return (
    Number.isFinite(+date) &&
    date.toISOString().slice(0, 10) === day &&
    Number.isFinite(Date.parse(value))
  );
}
export function interactionTaskType(channel: string) {
  return channel === "phone_call"
    ? "telepon"
    : channel === "in_person"
      ? "kunjungan"
      : channel === "whatsapp"
        ? "whatsapp"
        : "administrasi";
}
