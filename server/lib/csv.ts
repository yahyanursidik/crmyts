// Quoted RFC 4180 cells, with formula neutralization for spreadsheet applications.
export function csvCell(value: unknown): string {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function recordsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '\uFEFF"Keterangan"\r\n"Tidak ada data"\r\n';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return '\uFEFF' + [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}
