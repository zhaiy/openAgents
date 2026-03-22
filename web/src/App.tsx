import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import WorkflowsPage from './pages/WorkflowsPage';
import WorkflowRunPage from './pages/WorkflowRunPage';
import RunsPage from './pages/RunsPage';
import RunDetailPage from './pages/RunDetailPage';
import RunExecutionPage from './pages/RunExecutionPage';
import WorkflowOverviewPage from './pages/WorkflowOverviewPage';
import DiagnosticsPage from './pages/DiagnosticsPage';
import RunComparisonPage from './pages/RunComparisonPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/:workflowId" element={<WorkflowOverviewPage />} />
        <Route path="workflows/:workflowId/run" element={<WorkflowRunPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:runId" element={<RunDetailPage />} />
        <Route path="runs/:runId/execute" element={<RunExecutionPage />} />
        <Route path="runs/compare" element={<RunComparisonPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
