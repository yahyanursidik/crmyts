export interface InteractionItem {
  id: string;
  personId: string;
  eventId?: string | null;
  channel: string;
  summary: string;
  outcome?: string | null;
  sensitivityLevel: string;
  occurredAt: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  ownerUserId: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
  canManage: boolean;
  person?: {
    id: string;
    fullName: string;
    phoneE164?: string | null;
    isActive: boolean;
  } | null;
  event?: { id: string; title: string; startAt: string } | null;
  owner?: { id: string; fullName: string } | null;
  creator?: { id: string; fullName: string } | null;
  followUps: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueAt: string;
  }>;
}
export interface InteractionOptions {
  staff: Array<{ id: string; fullName: string }>;
  events: Array<{ id: string; title: string; startAt: string }>;
  canEvents: boolean;
}
