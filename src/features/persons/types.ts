export interface PersonDetailData {
  id: string;
  isActive: boolean;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  gender?: 'ikhwan' | 'akhwat' | null;
  province?: string | null;
  cityRegency?: string | null;
  district?: string | null;
  occupation?: string | null;
  educationLevel?: string | null;
  sourceCode?: string | null;
  engagementStatus: string;
  preferredChannel: string;
  createdAt: string;
  owner?: { id: string; fullName: string; email?: string } | null;
  roles: string[];
  tags: Array<{ id: string; name: string; category: string }>;
  attendances: Array<{
    id: string;
    status: string;
    checkInAt: string | null;
    ticketCode?: string | null;
    event: {
      id: string;
      title: string;
      category: string;
      speaker: string;
      deliveryMode: string;
      startAt: string;
      locationName?: string;
    };
  }>;
  routineAttendance?: Array<{
    id: string;
    sessionId: string;
    seriesId: string;
    seriesTitle: string;
    speaker: string | null;
    sessionDate: string;
    startAt: string;
    checkInAt: string;
    source: string;
    status: string;
  }>;
  bazaarProfiles?: Array<{id:string;brandName:string;businessCategory:string;applications:Array<{id:string;status:string;checkedInAt?:string|null;bazaar?:{eventId:string;title:string};assignedBooth?:{code:string}|null}>}>;
  interactions: Array<{
    // Connected response records retain their original message in Ruang Jamaah.
    id: string;
    channel: string;
    summary: string;
    outcome?: string | null;
    sensitivityLevel: string;
    nextAction?: string | null;
    occurredAt: string;
    creator?: { id: string; fullName: string } | null;
  }>;
  roomEntries?: Array<{id:string;subject:string;status:string;createdAt:string}>;
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueAt: string;
    assignee?: { id: string; fullName: string } | null;
  }>;
  donations: Array<{
    id: string;
    amountRupiah: number;
    paymentMethod: string;
    donationDate: string;
    verificationStatus: string;
    program?: { name: string } | null;
    verifier?: { fullName: string } | null;
  }>;
  waqfCases: Array<{
    id: string;
    waqfType: string;
    estimatedValueRupiah?: number | null;
    currentStage: string;
    openedAt: string;
    notesSummary?: string | null;
  }>;
  sensitiveNotes: Array<{
    id: string;
    noteText: string;
    expiresAt?: string | null;
    sensitivityLevel: string;
    reason: string;
    createdAt: string;
    creator?: { fullName: string } | null;
  }>;
  metrics: {
    totalAttendances: number;
    totalInteractions: number;
    totalTasks: number;
    pendingTasksCount: number;
    totalDonationsCount: number;
    verifiedTotalDonationsRupiah: number;
    activeWaqfCasesCount: number;
  };
  timeline: Array<{
    id: string;
    type:
      | 'attendance'
      | 'interaction'
      | 'task'
      | 'donation'
      | 'waqf'
      | 'sensitive_note';
    date: string;
    title: string;
    description: string;
    status?: string;
    extra?: any;
  }>;
}

export interface PersonListItem {
  id: string;
  isActive: boolean;
  fullName: string;
  phoneE164?: string | null;
  email?: string | null;
  gender?: 'ikhwan' | 'akhwat' | null;
  province?: string | null;
  cityRegency?: string | null;
  engagementStatus: string;
  preferredChannel: string;
  createdAt: string;
  owner?: { id: string; fullName: string } | null;
  roles: string[];
  tags: Array<{ id: string; name: string; category: string }>;
  lastAttendance?: {
    eventTitle: string;
    startAt: string;
    eventId: string;
    source: string;
  } | null;
  attendanceCount?: number;
  nextTask?: {
    id: string;
    title: string;
    dueAt: string;
    priority: string;
    isOverdue: boolean;
  } | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface PersonOptions {
  staff: Array<{ id: string; fullName: string }>;
  tags: Array<{ id: string; name: string; category: string }>;
}
