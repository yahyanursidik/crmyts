export interface DashboardResponse {
  kpis: {
    totalJamaah: number;
    aktifJamaah: number;
    rutinJamaah: number;
    dormanJamaah: number;
    overdueTasks: number;
    monthDonationsRupiah: number;
    unverifiedDonations: number;
    activeWaqfCases: number;
    agingWaqfCases: number;
    dataQualityIssues: number;
  };
  charts: {
    attendanceTrend: Array<{
      id: string;
      title: string;
      date: string;
      speaker: string;
      attendees: number;
    }>;
    engagementDistribution: Array<{
      status: string;
      count: number;
    }>;
    donationsByProgram: Array<{
      programId: string;
      programName: string;
      programCode: string;
      totalRupiah: number;
      count: number;
    }>;
    waqfStages: Array<{
      stage: string;
      caseCount: number;
      totalEstimatedRupiah: number;
    }>;
    taskCompletion: Array<{
      status: string;
      count: number;
    }>;
  };
  queues: {
    urgentTasks: Array<{
      id: string;
      title: string;
      ownerUserId?: string;
      personId?: string | null;
      personName?: string | null;
      personPhone?: string | null;
      priority: string;
      dueAt: string;
      isOverdue: boolean;
    }>;
    unverifiedDonations: Array<{
      id: string;
      personName: string;
      programName: string;
      amountRupiah: number;
      donationDate: string;
    }>;
    recentAuditLogs?: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId?: string | null;
      actorName: string;
      reason?: string | null;
      createdAt: string;
    }>;
  };
}

