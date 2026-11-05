import type { DashboardResponse } from './types';

export const OPEN_TASK_STATUSES = ['pending', 'in_progress', 'waiting'] as const;

/** Count each open task once; overdue is a subset, not another queue. */
export function openTaskCount(data: DashboardResponse): number {
  return data.charts.taskCompletion.reduce((total, item) =>
    OPEN_TASK_STATUSES.some((status) => status === item.status) ? total + item.count : total, 0);
}

export function eventPanelLink(id: string, panel: 'participants' | 'settings' = 'participants'): string {
  return `/events?${new URLSearchParams({ eventId: id, panel })}`;
}

export const dashboardLinks = {
  newPerson: '/people?action=create', newEvent: '/events?action=create',
  newTask: '/tasks?action=create', newDonation: '/donations?action=create',
  newInteraction: '/interactions?action=create', newWaqf: '/waqf?action=create',
  unverifiedDonations: '/donations?status=unverified',
  overdueTasks: '/tasks?overdue=true',
} as const;

export function monthlyDonationsLink(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const month = `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
  return `/donations?${new URLSearchParams({ status: 'verified', month })}`;
}

export interface DashboardOperations {
  generatedAt: string;
  upcomingCount: number;
  upcomingEvents: Array<{
    id: string; title: string; startAt: string; endAt: string | null;
    speaker: string | null; locationName: string | null;
    deliveryMode: string; status: string; quota: number | null;
    isRegistrationOpen: boolean; registered: number; attended: number;
  }>;
  paymentReviews: Array<{ id: string; title: string; count: number }>;
}
