import { z } from "zod";
import {
  ROOM_CATEGORIES,
  ROOM_STATUSES,
} from "../../../src/lib/jamaahRoomModel";
import { validInteractionInstant } from "../../../src/lib/interactionModel";
export {
  ROOM_CATEGORIES,
  ROOM_STATUSES,
  containsContactDetail,
} from "../../../src/lib/jamaahRoomModel";
export const roomInstant = z
  .string()
  .datetime({ offset: true })
  .refine(validInteractionInstant, "Tanggal dan waktu tidak valid.");
export const roomSubmissionSchema = z
  .object({
    category: z.enum(ROOM_CATEGORIES),
    eventId: z.string().uuid().nullable().optional(),
    name: z.string().trim().max(120).nullable().optional(),
    email: z
      .union([z.string().trim().email().max(254), z.literal("")])
      .nullable()
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{9,20}$/, "Nomor telepon tidak valid")
      .refine(
        (value) => value.replace(/\D/g, "").length >= 9,
        "Nomor telepon terlalu pendek",
      )
      .nullable()
      .optional()
      .or(z.literal("")),
    subject: z.string().trim().min(5, "Judul minimal 5 karakter").max(160),
    message: z.string().trim().min(20, "Isi minimal 20 karakter").max(4000),
    wantsReply: z.boolean().default(false),
    publicationConsent: z.boolean().default(false),
    anonymousPublication: z.boolean().default(true),
    website: z.string().max(200).default(""),
    submissionId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.wantsReply && !value.email && !value.phone)
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Isi email atau nomor telepon agar tim YTS dapat membalas.",
      });
    if (
      value.publicationConsent &&
      !["cerita", "pengalaman"].includes(value.category)
    )
      ctx.addIssue({
        code: "custom",
        path: ["publicationConsent"],
        message: "Izin publikasi hanya tersedia untuk cerita atau pengalaman.",
      });
  });
export const roomUpdateSchema = z
  .object({
    status: z.enum(ROOM_STATUSES).optional(),
    internalNote: z.string().trim().max(3000).nullable().optional(),
    response: z.string().trim().max(3000).nullable().optional(),
    publicTitle: z.string().trim().max(160).nullable().optional(),
    publicText: z.string().trim().max(4000).nullable().optional(),
    published: z.boolean().optional(),
    personId: z.string().uuid().nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    expectedUpdatedAt: roomInstant.optional(),
    reason: z.string().trim().min(3).max(500).optional(),
    replyChannel: z
      .enum([
        "whatsapp",
        "phone_call",
        "in_person",
        "telegram",
        "email",
        "other",
      ])
      .optional(),
    responseOccurredAt: roomInstant.optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => !["reason", "expectedUpdatedAt"].includes(key),
      ),
    "Tidak ada perubahan.",
  );
export const roomReasonSchema = z.object({
  reason: z.string().trim().min(3, "Isi alasan minimal 3 karakter.").max(500),
  expectedUpdatedAt: roomInstant.optional(),
});
export const roomTaskSchema = z.object({
  title: z.string().trim().min(3).max(300),
  dueAt: roomInstant,
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  taskType: z
    .enum(["whatsapp", "telepon", "kunjungan", "administrasi"])
    .default("whatsapp"),
  ownerUserId: z.string().uuid().optional(),
  expectedUpdatedAt: roomInstant.optional(),
});
export const roomReplySchema = z.object({
  response: z.string().trim().min(3, "Isi ringkasan tanggapan.").max(3000),
  replyChannel: z.enum([
    "whatsapp",
    "phone_call",
    "in_person",
    "telegram",
    "email",
    "other",
  ]),
  responseOccurredAt: roomInstant,
  expectedUpdatedAt: roomInstant.optional(),
});
export const roomBulkSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .max(25)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "ID pesan tidak boleh berulang.",
    ),
});
export function parseRoomDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00+07:00");
  return !Number.isFinite(+date) ||
    new Date(+date + 25200000).toISOString().slice(0, 10) !== value
    ? null
    : date;
}
