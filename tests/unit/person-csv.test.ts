import { describe, expect, it } from 'vitest';
import { parsePersonCsv } from '../../src/features/persons/importModel';

describe('People CSV input', () => {
  it('preserves quoted commas, escaped quotes, BOM and CRLF', () => {
    const rows = parsePersonCsv(
      '\uFEFFNama,No_HP,Email,Kota,Gender\r\n"Ahmad, \"\"Abu Fulan\"\"",081234567890,a@example.test,"Bandung, Jawa Barat",ikhwan\r\n',
    );
    expect(rows[0]).toMatchObject({
      fullName: 'Ahmad, "Abu Fulan"',
      phone: '081234567890',
      email: 'a@example.test',
      cityRegency: 'Bandung, Jawa Barat',
    });
  });
  it('matches reordered semicolon headers', () => {
    expect(
      parsePersonCsv(
        'Email;Gender;Nama Lengkap;WhatsApp;Kota\na@example.test;ikhwan;Ahmad;081234567890;Bandung',
      )[0],
    ).toMatchObject({
      fullName: 'Ahmad',
      phone: '081234567890',
      email: 'a@example.test',
    });
  });
  it('keeps incomplete rows for validation instead of silently dropping them', () => {
    expect(parsePersonCsv('Nama,No_HP\nAhmad,\n,081234567890')).toHaveLength(2);
  });
  it('rejects missing or repeated required headers', () => {
    expect(() => parsePersonCsv('Nama,Email\nAhmad,a@example.test')).toThrow(
      'No_HP',
    );
    expect(() =>
      parsePersonCsv('Nama,Name,Phone\nAhmad,Fulan,081234567890'),
    ).toThrow('berulang');
  });
  it('rejects broken quotes and extra columns before preview', () => {
    expect(() => parsePersonCsv('Nama,No_HP\n"Ahmad,081234567890')).toThrow(
      'kutip',
    );
    expect(() =>
      parsePersonCsv('Nama,No_HP\nAhmad,081234567890,Bandung'),
    ).toThrow('berlebih');
  });
  it('bounds import size', () => {
    expect(() =>
      parsePersonCsv(
        'Nama,No_HP\n' +
          Array.from({ length: 1001 }, () => 'Ahmad,081234567890').join('\n'),
      ),
    ).toThrow('1.000');
  });
});
