import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { ErrorBoundary } from './components/ErrorBoundary';

import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ImportWizardPage } from './pages/ImportWizardPage';
import { RulesHardwarePage } from './pages/RulesHardwarePage';
import { AllocationWorkspacePage } from './pages/AllocationWorkspacePage';
import { ValidationTQsPage } from './pages/ValidationTQsPage';
import { UtilisationPage } from './pages/UtilisationPage';
import { ReportsPage } from './pages/ReportsPage';
import { RevisionManagerPage } from './pages/RevisionManagerPage';
import { SettingsPage } from './pages/SettingsPage';
import { DCSChatbot } from './components/DCSChatbot';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ProjectProvider>
        <BrowserRouter>
          <div className="flex h-full w-full overflow-hidden bg-slate-50 text-slate-900 font-sans">
            {/* Persistent Left Sidebar */}
            <Sidebar />

            {/* Main Workspace Column */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
              {/* Top Bar with Project / Revision Selectors and Global Actions */}
              <TopBar />

              {/* Scrollable Main Content Container */}
              <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
                <ErrorBoundary>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/import" element={<ImportWizardPage />} />
                    <Route path="/rules-hardware" element={<RulesHardwarePage />} />
                    <Route path="/allocation" element={<AllocationWorkspacePage />} />
                    <Route path="/utilisation" element={<UtilisationPage />} />
                    <Route path="/validation-tqs" element={<ValidationTQsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/revisions" element={<RevisionManagerPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </div>

          {/* Global Floating DeltaV Engineering AI Assistant Chatbot */}
          <DCSChatbot />
        </BrowserRouter>
      </ProjectProvider>
    </ErrorBoundary>
  );
};

export default App;
