import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './store/auth'
import { ManagerLayout } from './components/layout/ManagerLayout'
import { SupervisorLayout } from './components/layout/SupervisorLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage as ManagerDashboard } from './pages/manager/DashboardPage'
import { ProjectsPage } from './pages/manager/ProjectsPage'
import { NewProjectPage } from './pages/manager/NewProjectPage'
import { ScheduleExplorerPage } from './pages/manager/ScheduleExplorerPage'
import { AssignmentsPage } from './pages/manager/AssignmentsPage'
import { ReconciliationPage } from './pages/manager/ReconciliationPage'
import { DelaysPage } from './pages/manager/DelaysPage'
import { MessagesPage } from './pages/manager/MessagesPage'
import { AuditPage } from './pages/manager/AuditPage'
import { InsightsPage } from './pages/manager/InsightsPage'
import { SupervisorDashboardPage } from './pages/supervisor/DashboardPage'
import { MyWorkPage } from './pages/supervisor/MyWorkPage'
import { ReportPage } from './pages/supervisor/ReportPage'
import { HistoryPage } from './pages/supervisor/HistoryPage'
import { ChatPage } from './pages/supervisor/ChatPage'
import { WorkerLayout } from './components/layout/WorkerLayout'
import { WorkerDashboardPage } from './pages/worker/DashboardPage'
import { Toaster } from './components/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, refetchOnWindowFocus: false, refetchInterval: 1000 * 15 },
  },
})

function RootRedirect() {
  const userId = useAuth((s) => s.userId)
  const role = useAuth((s) => s.role)
  if (!userId) return <Navigate to="/login" replace />
  return <Navigate to={role === 'manager' ? '/m/dashboard' : role === 'supervisor' ? '/s/dashboard' : '/w/dashboard'} replace />
}

function RequireRole({ role }: { role: 'manager' | 'supervisor' | 'worker' }) {
  const userId = useAuth((s) => s.userId)
  const userRole = useAuth((s) => s.role)
  if (!userId || !userRole) return <Navigate to="/login" replace />
  if (userRole !== role) return <Navigate to={userRole === 'manager' ? '/m/dashboard' : userRole === 'supervisor' ? '/s/dashboard' : '/w/dashboard'} replace />
  return <Outlet />
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />
          <Route element={<RequireRole role="manager" />}>
            <Route path="/m" element={<ManagerLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ManagerDashboard />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/new" element={<NewProjectPage />} />
              <Route path="schedule" element={<ScheduleExplorerPage />} />
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="delays" element={<DelaysPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="insights" element={<InsightsPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="supervisor" />}>
            <Route path="/s" element={<SupervisorLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<SupervisorDashboardPage />} />
              <Route path="work" element={<MyWorkPage />} />
              <Route path="report" element={<ReportPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="chat" element={<ChatPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="worker" />}>
            <Route path="/w" element={<WorkerLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<WorkerDashboardPage />} />
            </Route>
          </Route>
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        <Toaster />
      </HashRouter>
    </QueryClientProvider>
  )
}
