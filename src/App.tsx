import { lazy, Suspense } from 'react';
import { LoadingState } from './components/common/LoadingState';
import { Refine, Authenticated } from '@refinedev/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { dataProvider } from './lib/dataProvider';
import { authProvider } from './lib/authProvider';
import { routerProvider, Outlet } from './lib/routerProvider';
import { ThemeProvider } from './lib/themeContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginRedirect, RouteAccess, NotFoundPage } from './components/common/RouteAccess';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const PersonsListPage = lazy(() => import('./features/persons/PersonsListPage').then((module) => ({ default: module.PersonsListPage })));
const PersonDetailPage = lazy(() => import('./features/persons/PersonDetailPage').then((module) => ({ default: module.PersonDetailPage })));
const EventsListPage = lazy(() => import('./features/events/EventsListPage').then((module) => ({ default: module.EventsListPage })));
const InteractionsListPage = lazy(() => import('./features/interactions/InteractionsListPage').then((module) => ({ default: module.InteractionsListPage })));
const TasksListPage = lazy(() => import('./features/tasks/TasksListPage').then((module) => ({ default: module.TasksListPage })));
const DonationsListPage = lazy(() => import('./features/donations/DonationsListPage').then((module) => ({ default: module.DonationsListPage })));
const WaqfPipelinePage = lazy(() => import('./features/waqf/WaqfPipelinePage').then((module) => ({ default: module.WaqfPipelinePage })));
const DataQualityPage = lazy(() => import('./features/data-quality/DataQualityPage').then((module) => ({ default: module.DataQualityPage })));
const AuditLogPage = lazy(() => import('./features/audit/AuditLogPage').then((module) => ({ default: module.AuditLogPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const AutomationPage = lazy(() => import('./features/automation/AutomationPage').then((module) => ({ default: module.AutomationPage })));
const DonorPipelinePage = lazy(() => import('./features/donors/DonorPipelinePage').then((module) => ({ default: module.DonorPipelinePage })));
const DonationsPortalPage = lazy(() => import('./features/public-portal/DonationsPortalPage').then((module) => ({ default: module.DonationsPortalPage })));
const EventsPortalPage = lazy(() => import('./features/public-portal/EventsPortalPage').then((module) => ({ default: module.EventsPortalPage })));
const StaffEventRegistrationPage = lazy(() => import('./features/public-portal/StaffEventRegistrationPage').then((module) => ({ default: module.StaffEventRegistrationPage })));
const BazaarCatalogPortalPage = lazy(() => import('./features/public-portal/BazaarCatalogPortalPage').then((module) => ({ default: module.BazaarCatalogPortalPage })));
const BazaarPortalPage = lazy(() => import('./features/public-portal/BazaarPortalPage').then((module) => ({ default: module.BazaarPortalPage })));
const BazaarSurveyPortalPage = lazy(() => import('./features/public-portal/BazaarSurveyPortalPage').then((module) => ({ default: module.BazaarSurveyPortalPage })));
const BazaarHubPage = lazy(() => import('./features/bazaar/BazaarHubPage').then((module) => ({ default: module.BazaarHubPage })));
const ParticipantPortalPage = lazy(() => import('./features/public-portal/ParticipantPortalPage').then((module) => ({ default: module.ParticipantPortalPage })));
const GateScannerPage = lazy(() => import('./features/gate/GateScannerPage').then((module) => ({ default: module.GateScannerPage })));
const JamaahRoomPage = lazy(() => import('./features/jamaah-room/JamaahRoomPage').then((module) => ({ default: module.JamaahRoomPage })));
const JamaahRoomInboxPage = lazy(() => import('./features/jamaah-room/JamaahRoomInboxPage').then((module) => ({ default: module.JamaahRoomInboxPage })));
const KajianRutinPage = lazy(() => import('./features/kajian-rutin/KajianRutinPage').then((module) => ({ default: module.KajianRutinPage })));
const KajianRutinPortalPage = lazy(() => import('./features/public-portal/KajianRutinPortalPage').then((module) => ({ default: module.KajianRutinPortalPage })));

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
              name: 'jamaah-room',
              list: '/ruang-jamaah/kelola',
            },
            {
              name: 'kajian-rutin',
              list: '/kajian-rutin',
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
              name: 'bazaar',
              list: '/bazaar',
            },
            {
              name: 'donors-pipeline',
              list: '/donors-pipeline',
            },
          ]}
        >
          <ErrorBoundary moduleName="Aplikasi">
            <Suspense fallback={<LoadingState message="Memuat halaman…" />}><Routes>
              <Route
                element={
                  <Authenticated key="authenticated-routes" fallback={<LoginRedirect />}>
                    <AppShell>
                      <RouteAccess><Outlet /></RouteAccess>
                    </AppShell>
                  </Authenticated>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="people" element={<PersonsListPage />} />
                <Route path="people/:id" element={<PersonDetailPage />} />
                <Route path="events" element={<EventsListPage />} />
                <Route path="bazaar" element={<BazaarHubPage />} />
                <Route path="interactions" element={<InteractionsListPage />} />
                <Route path="ruang-jamaah/kelola" element={<JamaahRoomInboxPage />} />
                <Route path="kajian-rutin" element={<KajianRutinPage />} />
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
              <Route path="/ruang-jamaah" element={<JamaahRoomPage />} />
              <Route path="/kajian/:id/staff/:token" element={<StaffEventRegistrationPage />} />
              <Route path="/kajian/:id" element={<EventsPortalPage />} />
              {/* Standalone Public Catalog Pages */}
              <Route path="/bazar" element={<BazaarCatalogPortalPage />} />
              <Route path="/bazar/:id" element={<BazaarCatalogPortalPage />} />
              <Route path="/bazar/:id/katalog" element={<BazaarCatalogPortalPage />} />
              <Route path="/kajian/:id/bazar" element={<BazaarCatalogPortalPage />} />
              <Route path="/kajian/:id/bazar/katalog" element={<BazaarCatalogPortalPage />} />
              <Route path="/event/:id/bazar" element={<BazaarCatalogPortalPage />} />
              <Route path="/daurah/:id/bazar" element={<BazaarCatalogPortalPage />} />

              {/* Standalone Registration & Status Check Pages */}
              <Route path="/bazar/:id/daftar" element={<BazaarPortalPage />} />
              <Route path="/bazar/:id/registrasi" element={<BazaarPortalPage />} />
              <Route path="/bazar/:id/form" element={<BazaarPortalPage />} />
              <Route path="/bazar/:id/status" element={<BazaarPortalPage />} />
              <Route path="/kajian/:id/bazar/daftar" element={<BazaarPortalPage />} />
              <Route path="/kajian/:id/bazar/status" element={<BazaarPortalPage />} />
              <Route path="/event/:id/bazar/daftar" element={<BazaarPortalPage />} />
              <Route path="/daurah/:id/bazar/daftar" element={<BazaarPortalPage />} />

              {/* Post-Event Survey Pages */}
              <Route path="/kajian/:id/bazar/survey" element={<BazaarSurveyPortalPage />} />
              <Route path="/kajian/:id/bazar/survei" element={<BazaarSurveyPortalPage />} />
              <Route path="/bazar/:id/survey" element={<BazaarSurveyPortalPage />} />
              <Route path="/bazar/:id/survei" element={<BazaarSurveyPortalPage />} />
              <Route path="/event/:id/bazar/survey" element={<BazaarSurveyPortalPage />} />
              <Route path="/daurah/:id/bazar/survey" element={<BazaarSurveyPortalPage />} />
              <Route path="/public/events/:id" element={<EventsPortalPage />} />
              <Route path="/peserta" element={<ParticipantPortalPage />} />
              <Route path="/peserta/kajian" element={<KajianRutinPortalPage />} />
              <Route path="/peserta/kajian/absen" element={<KajianRutinPortalPage />} />
              <Route path="/peserta/:eventId" element={<ParticipantPortalPage />} />
              <Route path="/tiket" element={<ParticipantPortalPage />} />
              <Route path="/cek-tiket" element={<ParticipantPortalPage />} />

              {/* Public Gate Scanner (No Login Required) */}
              <Route path="/gate" element={<GateScannerPage />} />
              <Route path="/gate/:id" element={<GateScannerPage />} />
              <Route path="/scanner" element={<GateScannerPage />} />
              <Route path="/scanner/:id" element={<GateScannerPage />} />
              <Route path="/presensi" element={<GateScannerPage />} />
              <Route path="/presensi/:id" element={<GateScannerPage />} />

              <Route
                path="/login"
                element={
                  <Authenticated key="login-route" fallback={<LoginPage />}>
                    <Navigate to="/" replace />
                  </Authenticated>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes></Suspense>
          </ErrorBoundary>
        </Refine>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
