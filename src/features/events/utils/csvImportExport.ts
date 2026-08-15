/**
 * CSV Import & Export Utilities for Event Registrations & Participants
 */

export interface ParsedParticipantRow {
  rowNumber: number;
  fullName: string;
  phone: string;
  gender: 'ikhwan' | 'akhwat';
  age?: number | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  ticketCode?: string | null;
  status: 'registered' | 'attended';
  vehicleType: 'none' | 'motorcycle' | 'car';
  vehiclePlateNumber?: string | null;
  registrationData?: Record<string, any>;
  validationStatus: 'valid' | 'warning' | 'error';
  validationMessage?: string;
  isDuplicateInFile?: boolean;
}

/**
 * Downloads a pre-formatted CSV template for participant batch import
 */
export function downloadParticipantCsvTemplate() {
  const headers = [
    'Nama Lengkap',
    'WhatsApp',
    'Jenis Kelamin',
    'Umur',
    'Provinsi',
    'Kabupaten/Kota',
    'Kecamatan',
    'Alamat Lengkap',
    'Kode Registrasi / Tiket',
    'Status Presensi',
    'Kendaraan',
    'Plat Nomor',
    'Catatan / Mahram',
  ];

  const sampleRows = [
    [
      '"Fulan bin Fulan"',
      '"081234567890"',
      '"Laki-laki"',
      '32',
      '"JAWA BARAT"',
      '"KOTA BANDUNG"',
      '"COBLONG"',
      '"Jl. Dago No. 12"',
      '"TIKET-TS-001"',
      '"Belum Check In"',
      '"Motor"',
      '"D 1234 ABC"',
      '""',
    ],
    [
      '"Fulanah binti Fulan"',
      '"6281987654321"',
      '"Perempuan"',
      '28',
      '"JAWA BARAT"',
      '"KOTA CIMAHI"',
      '"CIMAHI UTARA"',
      '"Jl. Pesantren No. 5"',
      '"TIKET-TS-002"',
      '"Sudah Check In"',
      '"Mobil"',
      '"D 5678 XYZ"',
      '"Mahram: Fulan (081234567890)"',
    ],
    [
      '"Ahmad Abdullah"',
      '"085712345678"',
      '"Ikhwan"',
      '45',
      '"DKI JAKARTA"',
      '"JAKARTA SELATAN"',
      '"TEBET"',
      '"Tebet Barat Dalam"',
      '""',
      '"Belum Check In"',
      '"Tanpa Kendaraan"',
      '""',
      '""',
    ],
  ];

  const csvContent = [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'Template_Import_Peserta_Kajian.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust CSV parser handling quotes, comma/semicolon separators, and line breaks
 */
export function parseCsvText(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  // Determine separator (comma or semicolon)
  const firstLine = cleanText.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF after CR
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((val) => val !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((val) => val !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes CSV headers and transforms rows into structured participant items with validation
 */
export function processParticipantCsvData(rawRows: string[][]): {
  parsedRows: ParsedParticipantRow[];
  totalValid: number;
  totalWarnings: number;
  totalErrors: number;
} {
  if (rawRows.length < 2 || !rawRows[0]) {
    return { parsedRows: [], totalValid: 0, totalWarnings: 0, totalErrors: 0 };
  }

  const rawHeaders = rawRows[0].map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
  const dataRows = rawRows.slice(1);

  // Map header indexes
  const getIndex = (possibleNames: string[]) => {
    return rawHeaders.findIndex((h) => possibleNames.some((p) => h.includes(p.toLowerCase())));
  };

  const nameIdx = getIndex(['nama lengkap', 'nama', 'full name', 'fullname', 'peserta']);
  const phoneIdx = getIndex(['whatsapp', 'wa', 'telepon', 'phone', 'no hp', 'nomor hp', 'no telp', 'no wa']);
  const genderIdx = getIndex(['jenis kelamin', 'gender', 'ikhwan/akhwat', 'kelamin']);
  const ageIdx = getIndex(['umur', 'usia', 'age']);
  const provinceIdx = getIndex(['provinsi', 'prov']);
  const cityIdx = getIndex(['kabupaten/kota', 'kabupaten', 'kota', 'city', 'domisili']);
  const districtIdx = getIndex(['kecamatan', 'kec']);
  const addressIdx = getIndex(['alamat lengkap', 'alamat', 'address']);
  const ticketIdx = getIndex(['kode registrasi', 'barcode', 'no tiket', 'tiket', 'ticket code', 'ticket']);
  const statusIdx = getIndex(['status check in', 'status presensi', 'status presensi', 'kehadiran', 'status']);
  const vehicleIdx = getIndex(['kendaraan', 'tipe kendaraan', 'vehicle']);
  const plateIdx = getIndex(['plat nomor', 'no plat', 'plat', 'plate']);
  const mahramNameIdx = getIndex(['nama mahram', 'mahram']);
  const mahramWaIdx = getIndex(['whatsapp mahram', 'wa mahram']);

  const seenPhones = new Set<string>();
  const parsedRows: ParsedParticipantRow[] = [];

  let totalValid = 0;
  let totalWarnings = 0;
  let totalErrors = 0;

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for 1-based index, +1 for header
    if (!row.some((cell) => cell.trim().length > 0)) return;

    const rawName = (nameIdx !== -1 ? row[nameIdx] : '') || '';
    const rawPhone = (phoneIdx !== -1 ? row[phoneIdx] : '') || '';
    const rawGender = (genderIdx !== -1 ? row[genderIdx] : '') || '';
    const rawAge = (ageIdx !== -1 ? row[ageIdx] : '') || '';
    const rawProvince = (provinceIdx !== -1 ? row[provinceIdx] : '') || '';
    const rawCity = (cityIdx !== -1 ? row[cityIdx] : '') || '';
    const rawDistrict = (districtIdx !== -1 ? row[districtIdx] : '') || '';
    const rawAddress = (addressIdx !== -1 ? row[addressIdx] : '') || '';
    const rawTicket = (ticketIdx !== -1 ? row[ticketIdx] : '') || '';
    const rawStatus = (statusIdx !== -1 ? row[statusIdx] : '') || '';
    const rawVehicle = (vehicleIdx !== -1 ? row[vehicleIdx] : '') || '';
    const rawPlate = (plateIdx !== -1 ? row[plateIdx] : '') || '';
    const rawMahramName = (mahramNameIdx !== -1 ? row[mahramNameIdx] : '') || '';
    const rawMahramWa = (mahramWaIdx !== -1 ? row[mahramWaIdx] : '') || '';

    // Gender normalize
    const genderLower = rawGender.toLowerCase();
    const isAkhwat =
      genderLower.includes('akhwat') ||
      genderLower.includes('perempuan') ||
      genderLower.includes('wanita') ||
      genderLower === 'p' ||
      genderLower === 'f';
    const gender: 'ikhwan' | 'akhwat' = isAkhwat ? 'akhwat' : 'ikhwan';

    // Status normalize
    const statusLower = rawStatus.toLowerCase();
    const isAttended =
      statusLower.includes('sudah check in') ||
      statusLower.includes('sudah') ||
      statusLower.includes('hadir') ||
      statusLower === 'attended';
    const status: 'registered' | 'attended' = isAttended ? 'attended' : 'registered';

    // Vehicle normalize
    const vehicleLower = rawVehicle.toLowerCase();
    let vehicleType: 'none' | 'motorcycle' | 'car' = 'none';
    if (vehicleLower.includes('mobil') || vehicleLower.includes('car')) {
      vehicleType = 'car';
    } else if (vehicleLower.includes('motor') || vehicleLower.includes('bike')) {
      vehicleType = 'motorcycle';
    }

    // Phone cleanup for duplicate check
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const isDuplicate = cleanPhone ? seenPhones.has(cleanPhone) : false;
    if (cleanPhone) seenPhones.add(cleanPhone);

    // Validation
    let validationStatus: 'valid' | 'warning' | 'error' = 'valid';
    let validationMessage = 'Data valid dan siap diimpor';

    if (!rawName.trim()) {
      validationStatus = 'error';
      validationMessage = 'Nama peserta tidak boleh kosong';
      totalErrors++;
    } else if (!rawPhone.trim() || cleanPhone.length < 7) {
      validationStatus = 'error';
      validationMessage = 'Nomor WhatsApp tidak valid';
      totalErrors++;
    } else if (isDuplicate) {
      validationStatus = 'warning';
      validationMessage = 'Duplikat internal: No. WhatsApp muncul lebih dari 1x di file ini';
      totalWarnings++;
    } else {
      totalValid++;
    }

    const regData: Record<string, any> = {};
    if (rawAge) regData.age = parseInt(rawAge, 10) || rawAge;
    if (rawMahramName) regData.mahramName = rawMahramName;
    if (rawMahramWa) regData.mahramPhone = rawMahramWa;
    if (rawAddress) regData.address = rawAddress;

    parsedRows.push({
      rowNumber,
      fullName: rawName.trim(),
      phone: rawPhone.trim(),
      gender,
      age: parseInt(rawAge, 10) || null,
      province: rawProvince.trim() || null,
      city: rawCity.trim() || null,
      district: rawDistrict.trim() || null,
      address: rawAddress.trim() || null,
      ticketCode: rawTicket.trim() || null,
      status,
      vehicleType,
      vehiclePlateNumber: rawPlate.trim() || null,
      registrationData: Object.keys(regData).length > 0 ? regData : undefined,
      validationStatus,
      validationMessage,
      isDuplicateInFile: isDuplicate,
    });
  });

  return { parsedRows, totalValid, totalWarnings, totalErrors };
}
