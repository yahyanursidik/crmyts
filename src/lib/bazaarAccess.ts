export function readBazaarAccessToken(token: string) {
  try {
    const [prefix, payload] = token.trim().split(".");
    if (prefix !== "bazaar-access" || !payload) return null;
    const data = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    return typeof data.applicationId === "string"
      ? (data as { applicationId: string; bazaarId: string })
      : null;
  } catch {
    return null;
  }
}
export function saveBazaarReceipt(eventId: string, token: string) {
  if (!readBazaarAccessToken(token)) return;
  try {
    localStorage.setItem("yts_bazaar_access:" + eventId, token);
  } catch {
    /* The receipt can still be copied/downloaded when storage is unavailable. */
  }
}
export function loadBazaarReceipt(eventId: string) {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get(
    "access",
  );
  if (fragment && readBazaarAccessToken(fragment)) {
    saveBazaarReceipt(eventId, fragment);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    return fragment;
  }
  try {
    return localStorage.getItem("yts_bazaar_access:" + eventId) || "";
  } catch {
    return "";
  }
}
export function bazaarReceiptUrl(
  eventId: string,
  token: string,
  survey = false,
) {
  return (
    window.location.origin +
    "/bazar/" +
    eventId +
    (survey ? "/survey" : "/daftar?tab=status") +
    "#access=" +
    encodeURIComponent(token)
  );
}
export function downloadBazaarReceipt(
  eventId: string,
  token: string,
  brand: string,
) {
  const content =
    "BUKTI PENDAFTARAN BAZAR YTS\n" +
    brand +
    "\n\nKode akses pribadi (jangan bagikan ke publik):\n" +
    token +
    "\n\nStatus dan pembayaran:\n" +
    bazaarReceiptUrl(eventId, token) +
    "\n\nSurvei setelah kegiatan:\n" +
    bazaarReceiptUrl(eventId, token, true) +
    "\n";
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "bukti-pendaftaran-bazar.txt";
  a.click();
  URL.revokeObjectURL(url);
}
