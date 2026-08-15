import { Refine, Authenticated } from '@refinedev/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { dataProvider } from './lib/dataProvider';
import { authProvider } from './lib/authProvider';
import { routerProvider, Outlet } from './lib/routerProvider';
import { ThemeProvider } from './lib/themeContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LoginPage } from './features/auth/LoginPage';
import { PersonsListPage } from './features/persons/PersonsListPage';
import { PersonDetailPage } from './features/persons/PersonDetailPage';
import { EventsListPage } from './features/events/EventsListPage';
import { InteractionsListPage } from './features/interactions/InteractionsListPage';
import { TasksListPage } from './features/tasks/TasksListPage';
import { DonationsListPage } from './features/donations/DonationsListPage';
import { WaqfPipelinePage } from './features/waqf/WaqfPipelinePage';
import { DataQualityPage } from './features/data-quality/DataQualityPage';
import { AuditLogPage } from './features/audit/AuditLogPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AutomationPage } from './features/automation/AutomationPage';
import { DonorPipelinePage } from './features/donors/DonorPipelinePage';
import { DonationsPortalPage } from './features/public-portal/DonationsPortalPage';
import { EventsPortalPage } from './features/public-portal/EventsPortalPage';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Refine
          dataProvider={dataProvider}
          authProvider={authProvider}
          routerProvider={routerProvider}
          resources={[
            {
              name: 'dashboard',
              list: '/',
            },
            {
              name: 'people',
              list: '/people',
              show: '/people/:id',
            },
            {
              name: 'events',
              list: '/events',
            },
            {
              name: 'interactions',
              list: '/interactions',
            },
            {
              name: 'tasks',
              list: '/tasks',
            },
            {
              name: 'donations',
              list: '/donations',
            },
            {
              name: 'waqf',
              list: '/waqf',
            },
            {
              name: 'data-quality',
              list: '/data-quality',
            },
            {
              name: 'audit',
              list: '/audit',
            },
            {
              name: 'settings',
              list: '/settings',
            },
            {
              name: 'reports',
              list: '/reports',
            },
            {
              name: 'automation',
              list: '/automation',
            },
            {
              name: 'donors-pipeline',
              list: '/donors-pipeline',
            },
          ]}
        >
          <Routes>
            <Route
              element={
                <Authenticated key="authenticated-routes" fallback={<Navigate to="/login" replace />}>
                  <AppShell>
                    <Outlet />
                  </AppShell>
                </Authenticated>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="people" element={<PersonsListPage />} />
              <Route path="people/:id" element={<PersonDetailPage />} />
              <Route path="events" element={<EventsListPage />} />
              <Route path="interactions" element={<InteractionsListPage />} />
              <Route path="tasks" element={<TasksListPage />} />
              <Route path="donations" element={<DonationsListPage />} />
              <Route path="donors-pipeline" element={<DonorPipelinePage />} />
              <Route path="waqf" element={<WaqfPipelinePage />} />
              <Route path="data-quality" element={<DataQualityPage />} />
              <Route path="audit" element={<AuditLogPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="automation" element={<AutomationPage />} />
            </Route>

            {/* Public Landing Pages (Separated Portals) */}
            <Route path="/portal" element={<DonationsPortalPage />} />
            <Route path="/donasi" element={<DonationsPortalPage />} />
            <Route path="/berbagi" element={<DonationsPortalPage />} />
            <Route path="/kajian" element={<EventsPortalPage />} />
            <Route path="/event" element={<EventsPortalPage />} />
            <Route path="/daurah" element={<EventsPortalPage />} />

            <Route
              path="/login"
              element={
                <Authenticated key="login-route" fallback={<LoginPage />}>
                  <Navigate to="/" replace />
                </Authenticated>
              }
            />
          </Routes>
        </Refine>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
