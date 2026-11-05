export interface RoomRow {
  id: string;
  reference: string;
  category: string;
  eventId: string | null;
  eventTitle: string | null;
  personId: string | null;
  ownerUserId: string | null;
  person: { id: string; fullName: string; isActive: boolean } | null;
  owner: { id: string; fullName: string } | null;
  name: string | null;
  subject: string;
  preview: string;
  wantsReply: boolean;
  status: string;
  publicationConsent: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasOpenTasks: boolean;
  canManage: boolean;
}
export interface RoomEntry extends RoomRow {
  email: string | null;
  phone: string | null;
  message: string;
  anonymousPublication: boolean;
  internalNote: string | null;
  response: string | null;
  publicTitle: string | null;
  publicText: string | null;
  replyChannel: string | null;
  responseRecordedAt: string | null;
  archiveReason: string | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string;
    ownerUserId: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    content: string | null;
    details: Record<string, any> | null;
    createdAt: string;
    occurredAt: string;
    actor: { fullName: string } | null;
    interactionId: string | null;
    taskId: string | null;
  }>;
}
export interface RoomResult {
  items: RoomRow[];
  summary: Array<{ status: string; count: number }>;
  eventOptions: Array<{ id: string; title: string }>;
  staffOptions: Array<{ id: string; fullName: string }>;
  me: string;
}
export const roomTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const ROOM_TASK_LABELS: Record<string, string> = {
  pending: "Menunggu",
  in_progress: "Dikerjakan",
  waiting: "Menunggu kabar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
