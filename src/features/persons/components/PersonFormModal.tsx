import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { useGetIdentity } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { UserIdentity } from '@/lib/authProvider';
import { normalizePhoneE164, isValidE164 } from '@/lib/phone';
import { CitySuggestInput } from '@/components/common/CitySuggestInput';
import { ENGAGEMENT_LABELS, ROLE_LABELS } from '../model';
import type { PersonOptions } from '../types';
import { PeopleDialog } from './PeopleDialog';
import '../people.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any | null;
}
interface Duplicate {
  id: string;
  fullName: string;
  isActive?: boolean;
}
const SOURCES: Record<string, string> = {
  direct_input: 'Input staf',
  kajian_akbar: 'Kajian / tabligh',
  web_yts: 'Portal yayasan',
  wa_inbound: 'WhatsApp',
  referral: 'Rekomendasi jamaah',
  donasi_infaq: 'Donasi',
  wakaf_inquiry: 'Konsultasi wakaf',
};
const CHANNELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Telepon',
  telegram: 'Telegram',
  email: 'Email',
  in_person: 'Tatap muka',
};
export function PersonFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: Props) {
  const { data: identity } = useGetIdentity<UserIdentity>();
  const id = useId();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    gender: '',
    cityRegency: '',
    province: '',
    district: '',
    occupation: '',
    educationLevel: '',
    sourceCode: 'direct_input',
    engagementStatus: 'baru',
    preferredChannel: 'whatsapp',
    ownerUserId: '',
  });
  const [roles, setRoles] = useState<string[]>(['jamaah']);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(initialData?.id);
  const options = useQuery({
    queryKey: ['persons', 'options'],
    queryFn: () => apiClient<PersonOptions>('/persons/options'),
    enabled: isOpen,
    staleTime: 60000,
  });
  const change = (key: keyof typeof form, value: string) => {
    setForm((old) => ({ ...old, [key]: value }));
    setError('');
  };
  useEffect(() => {
    if (!isOpen) return;
    setForm({
      fullName: initialData?.fullName || '',
      phone: initialData?.phoneE164 || '',
      email: initialData?.email || '',
      gender: initialData?.gender || '',
      cityRegency: initialData?.cityRegency || '',
      province: initialData?.province || '',
      district: initialData?.district || '',
      occupation: initialData?.occupation || '',
      educationLevel: initialData?.educationLevel || '',
      sourceCode: initialData?.sourceCode || 'direct_input',
      engagementStatus: initialData?.engagementStatus || 'baru',
      preferredChannel: initialData?.preferredChannel || 'whatsapp',
      ownerUserId: editing ? initialData?.owner?.id || '' : identity?.id || '',
    });
    setRoles(initialData?.roles || ['jamaah']);
    setTagIds((initialData?.tags || []).map((tag: any) => tag.id));
    setDuplicates([]);
    setError('');
  }, [isOpen, initialData, identity?.id]);
  useEffect(() => {
    if (!isOpen || (!form.phone && !form.email)) {
      setDuplicates([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const query = new URLSearchParams({
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.email ? { email: form.email } : {}),
          ...(initialData?.id ? { excludeId: initialData.id } : {}),
        });
        const response = await apiClient<{ candidates: Duplicate[] }>(
          `/persons/check-duplicate?${query}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setDuplicates(response.data.candidates);
      } catch {
        if (!controller.signal.aborted) setDuplicates([]);
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, form.phone, form.email, initialData?.id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      (!editing || form.fullName !== initialData.fullName) &&
      form.fullName.trim().length < 2
    ) {
      setError('Isi nama lengkap minimal 2 karakter.');
      return;
    }
    if (
      (!editing || form.phone !== (initialData.phoneE164 || '')) &&
      form.phone.trim() &&
      (/[a-z]/i.test(form.phone) ||
        !isValidE164(normalizePhoneE164(form.phone)))
    ) {
      setError('Periksa nomor WhatsApp. Contoh: 081234567890.');
      return;
    }
    if (
      (!editing || form.email !== (initialData.email || '')) &&
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setError('Format email tidak valid.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        phoneE164: form.phone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        gender: form.gender || null,
        cityRegency: form.cityRegency.trim() || null,
        province: form.province.trim() || null,
        district: form.district.trim() || null,
        occupation: form.occupation.trim() || null,
        educationLevel: form.educationLevel.trim() || null,
        sourceCode: form.sourceCode,
        engagementStatus: form.engagementStatus,
        preferredChannel: form.preferredChannel,
        roleCodes: roles,
      };
      if (editing) {
        const base: Record<string, string> = {
          fullName: initialData.fullName || '',
          phone: initialData.phoneE164 || '',
          email: initialData.email || '',
          gender: initialData.gender || '',
          cityRegency: initialData.cityRegency || '',
          province: initialData.province || '',
          district: initialData.district || '',
          occupation: initialData.occupation || '',
          educationLevel: initialData.educationLevel || '',
          sourceCode: initialData.sourceCode || 'direct_input',
          engagementStatus: initialData.engagementStatus || 'baru',
          preferredChannel: initialData.preferredChannel || 'whatsapp',
        };
        for (const [key, initial] of Object.entries(base))
          if (form[key as keyof typeof form] === initial)
            delete payload[key === 'phone' ? 'phoneE164' : key];
        if (
          JSON.stringify([...roles].sort()) ===
          JSON.stringify([...(initialData.roles || [])].sort())
        )
          delete payload.roleCodes;
      }
      if (!editing || form.ownerUserId !== (initialData?.owner?.id || ''))
        payload.ownerUserId = form.ownerUserId || null;
      if (
        !editing ||
        JSON.stringify([...tagIds].sort()) !==
          JSON.stringify(
            (initialData?.tags || []).map((tag: any) => tag.id).sort(),
          )
      )
        payload.tagIds = tagIds;
      if (editing && !Object.keys(payload).length) {
        onClose();
        return;
      }
      await apiClient(editing ? `/persons/${initialData.id}` : '/persons', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess();
      onClose();
    } catch (failure) {
      setError((failure as Error).message || 'Jamaah belum dapat disimpan.');
    } finally {
      setSubmitting(false);
    }
  };
  const field = (
    key: keyof typeof form,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <div className="people-field">
      <label htmlFor={`${id}-${key}`}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={`${id}-${key}`}
        data-autofocus={key === 'fullName' ? true : undefined}
        type={type}
        value={form[key]}
        onChange={(event) => change(key, event.target.value)}
        required={required}
        disabled={submitting}
        maxLength={key === 'fullName' ? 160 : 254}
        autoComplete={
          key === 'fullName'
            ? 'name'
            : key === 'email'
              ? 'email'
              : key === 'phone'
                ? 'tel'
                : 'off'
        }
      />
    </div>
  );
  const select = (
    key: keyof typeof form,
    label: string,
    items: Record<string, string>,
  ) => (
    <div className="people-field">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      <select
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(event) => change(key, event.target.value)}
        disabled={submitting}
      >
        {Object.entries(items).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
  const toggle = (
    values: string[],
    value: string,
    set: (values: string[]) => void,
  ) =>
    set(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  const allTags = [
    ...(options.data?.data.tags || []),
    ...(initialData?.tags || []).filter(
      (tag: any) => !options.data?.data.tags.some((item) => item.id === tag.id),
    ),
  ];
  const ownerChoices: Record<string, string> = {
    '': 'Belum ada PIC',
    ...Object.fromEntries(
      (options.data?.data.staff || []).map((staff) => [
        staff.id,
        staff.fullName,
      ]),
    ),
    ...(initialData?.owner &&
    !options.data?.data.staff.some((staff) => staff.id === initialData.owner.id)
      ? {
          [initialData.owner.id]:
            `${initialData.owner.fullName}${options.isSuccess ? ' (tidak aktif)' : ''}`,
        }
      : {}),
  };
  return (
    <PeopleDialog
      open={isOpen}
      title={editing ? 'Edit profil jamaah' : 'Tambah jamaah'}
      onClose={onClose}
      busy={submitting}
      wide
    >
      <form onSubmit={submit} noValidate>
        <div className="people-form-body">
          {error && (
            <div className="people-notice is-error" role="alert">
              {error}
            </div>
          )}
          <div className="people-form-grid">
            {field('fullName', 'Nama lengkap', 'text', true)}
            {select('gender', 'Jenis kelamin', {
              '': 'Belum diisi',
              ikhwan: 'Ikhwan',
              akhwat: 'Akhwat',
            })}
            {field('phone', 'WhatsApp', 'tel')}
            {field('email', 'Email', 'email')}
            <div className="people-field">
              <label htmlFor={`${id}-city`}>Kota / kabupaten</label>
              <CitySuggestInput
                id={`${id}-city`}
                value={form.cityRegency}
                disabled={submitting}
                showPopularChips={false}
                className="people-input"
                onChange={(value) => {
                  const [city, province] = value
                    .split(',')
                    .map((part) => part.trim());
                  setForm((old) => ({
                    ...old,
                    cityRegency: city || value,
                    province: old.province || province || '',
                  }));
                }}
              />
            </div>
            {field('province', 'Provinsi')}
          </div>
          {(checking || duplicates.length > 0) && (
            <div className="people-duplicates mt-4" role="status">
              {checking ? (
                <span>
                  <Loader2 className="inline animate-spin" /> Memeriksa kontak…
                </span>
              ) : (
                <>
                  <p>
                    <TriangleAlert className="inline" /> Ada kontak serupa.
                    Periksa sebelum menyimpan.
                  </p>
                  {duplicates.map((person) => (
                    <Link key={person.id} to={`/people/${person.id}`}>
                      {person.fullName}
                      {person.isActive === false ? ' · Dalam arsip' : ''}
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
          <details className="people-form-details" open>
            <summary>Peran & penanggung jawab</summary>
            <div className="people-form-grid">
              {select('ownerUserId', 'PIC staf', ownerChoices)}
              {select('engagementStatus', 'Keterlibatan', ENGAGEMENT_LABELS)}
              <fieldset className="people-field span-all">
                <legend>Peran jamaah</legend>
                <div className="people-role-options">
                  {Object.entries({
                    ...ROLE_LABELS,
                    ...Object.fromEntries(
                      roles
                        .filter((role) => !ROLE_LABELS[role])
                        .map((role) => [role, role]),
                    ),
                  }).map(([role, label]) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={() => toggle(roles, role, setRoles)}
                        disabled={submitting}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {allTags.length > 0 && (
                <fieldset className="people-field span-all">
                  <legend>Tag</legend>
                  <div className="people-role-options">
                    {allTags.map((tag: any) => (
                      <label key={tag.id}>
                        <input
                          type="checkbox"
                          checked={tagIds.includes(tag.id)}
                          onChange={() => toggle(tagIds, tag.id, setTagIds)}
                          disabled={submitting}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
            {options.isError && (
              <p className="people-form-hint">
                Pilihan PIC/tag belum dapat diperbarui.{' '}
                <button
                  type="button"
                  className="people-inline-link"
                  onClick={() => void options.refetch()}
                >
                  Coba lagi
                </button>
              </p>
            )}
          </details>
          <details className="people-form-details">
            <summary>Profil lainnya</summary>
            <div className="people-form-grid">
              {field('district', 'Kecamatan')}
              {field('occupation', 'Pekerjaan')}
              {field('educationLevel', 'Pendidikan')}
              {select('sourceCode', 'Sumber kontak', {
                ...SOURCES,
                ...(form.sourceCode && !SOURCES[form.sourceCode]
                  ? { [form.sourceCode]: form.sourceCode }
                  : {}),
              })}
              {select('preferredChannel', 'Kanal pilihan', CHANNELS)}
            </div>
          </details>
        </div>
        <footer className="people-form-footer">
          <button
            className="people-button"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            className="people-button is-primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Check />}
            {submitting ? 'Menyimpan…' : 'Simpan jamaah'}
          </button>
        </footer>
      </form>
    </PeopleDialog>
  );
}
