import { parseCsvText } from "../events/utils/csvImportExport";
const fields = [
  "brandName",
  "businessCategory",
  "picName",
  "picPhone",
  "picEmail",
  "instagram",
  "address",
  "productDescription",
];
export function parseBazaarCsv(text: string) {
  let quoted = false;
  for (let i = 0; i < text.length; i++)
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    }
  if (quoted) throw new Error("Tanda kutip CSV belum ditutup.");
  const [header, ...rows] = parseCsvText(text);
  if (!header || !rows.length)
    throw new Error("Tambahkan header dan minimal satu baris tenant.");
  const columns = header.map((value) =>
    fields.find((field) => field.toLowerCase() === value.trim().toLowerCase()),
  );
  if (
    columns.some((value) => !value) ||
    new Set(columns).size !== columns.length
  )
    throw new Error(
      "Header CSV tidak dikenal atau berulang. Gunakan template yang tersedia.",
    );
  if (
    !["brandName", "picName", "picPhone"].every((field) =>
      columns.includes(field),
    )
  )
    throw new Error("Header brandName, picName, dan picPhone wajib tersedia.");
  if (rows.length > 500) throw new Error("Maksimal 500 baris per impor.");
  return rows.map((values, index) => {
    if (values.length !== columns.length)
      throw new Error(
        "Jumlah kolom pada baris " + (index + 2) + " tidak sesuai header.",
      );
    const row = Object.fromEntries(
      columns.map((key, i) => [key!, values[i]?.trim() || ""]),
    );
    row.businessCategory ||= "kuliner";
    if (!row.picEmail) delete row.picEmail;
    return row;
  });
}
export const bazaarCsvTemplate =
  "brandName,businessCategory,picName,picPhone,picEmail,instagram,address,productDescription\r\n";
