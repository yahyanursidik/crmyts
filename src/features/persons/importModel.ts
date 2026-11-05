import { parseCsvText } from '@/features/events/utils/csvImportExport';

/** Read quoted CSV without silently discarding invalid rows or shifting columns. */
export function parsePersonCsv(text: string) {
  if ((text.replace(/""/g, '').match(/"/g) || []).length % 2 !== 0)
    throw new Error('Tanda kutip CSV belum ditutup. Periksa kembali data.');
  const [header, ...rows] = parseCsvText(text);
  if (!header || !rows.length)
    throw new Error('Tempelkan judul kolom dan minimal satu baris jamaah.');
  if (rows.length > 1000) throw new Error('Maksimal 1.000 baris per impor.');
  const headers = header.map((cell) =>
    cell.toLowerCase().replace(/[\s_-]/g, ''),
  );
  const column = (aliases: string[], label: string, required = false) => {
    const matches = headers.flatMap((name, index) =>
      aliases.includes(name) ? [index] : [],
    );
    if (matches.length > 1)
      throw new Error(`Kolom ${label} berulang. Gunakan satu kolom.`);
    if (required && !matches.length)
      throw new Error(`Kolom ${label} belum ditemukan.`);
    return matches[0] ?? -1;
  };
  const name = column(
    ['nama', 'namalengkap', 'fullname', 'name'],
    'Nama',
    true,
  );
  const phone = column(
    [
      'nohp',
      'nomorhp',
      'phone',
      'phonee164',
      'whatsapp',
      'telepon',
      'notelp',
      'nomorwa',
    ],
    'No_HP',
    true,
  );
  const email = column(['email', 'surel'], 'Email');
  const city = column(
    [
      'kota',
      'kabupatenkota',
      'kotakabupaten',
      'city',
      'cityregency',
      'domisili',
    ],
    'Kota',
  );
  const gender = column(['gender', 'jeniskelamin', 'kelamin'], 'Gender');
  return rows.map((row, index) => {
    if (row.length > header.length)
      throw new Error(
        `Baris ${index + 2} memiliki kolom berlebih. Gunakan tanda kutip untuk nilai yang mengandung koma.`,
      );
    return {
      fullName: row[name] || '',
      phone: row[phone] || '',
      email: row[email] || null,
      cityRegency: row[city] || null,
      gender: row[gender] || null,
      sourceCode: 'CSV_IMPORT_HUB',
    };
  });
}
