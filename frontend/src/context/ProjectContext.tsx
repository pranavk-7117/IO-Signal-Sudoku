import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, Revision } from '../types';
import { api } from '../services/api';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  revisions: Revision[];
  currentRevision: Revision | null;
  loading: boolean;
  error: string | null;
  setCurrentProjectById: (id: number) => void;
  setCurrentRevisionById: (id: number) => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshRevisions: () => Promise<void>;
  resetToDemo: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [currentRevision, setCurrentRevision] = useState<Revision | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const list = await api.getProjects();
      setProjects(list);
      if (list.length > 0) {
        // Select active or first
        const activeProj = currentProject ? list.find(p => p.id === currentProject.id) || list[0] : list[0];
        setCurrentProject(activeProj);
      } else {
        setCurrentProject(null);
        setRevisions([]);
        setCurrentRevision(null);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error connecting to backend API');
    } finally {
      setLoading(false);
    }
  };

  const loadRevisions = async (projectId: number) => {
    try {
      const revs = await api.getRevisions(projectId);
      setRevisions(revs);
      const active = revs.find(r => r.is_active) || revs[0] || null;
      setCurrentRevision(active);
    } catch (err: any) {
      console.error('Failed to load revisions', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadRevisions(currentProject.id);
    }
  }, [currentProject?.id]);

  const setCurrentProjectById = (id: number) => {
    const found = projects.find(p => p.id === id);
    if (found) {
      setCurrentProject(found);
    }
  };

  const setCurrentRevisionById = async (id: number) => {
    if (!currentProject) return;
    try {
      await api.switchRevision(currentProject.id, id);
      await loadRevisions(currentProject.id);
      await loadProjects();
    } catch (err: any) {
      console.error('Error switching revision', err);
    }
  };

  const resetToDemo = async () => {
    try {
      setLoading(true);
      await api.seedDemo();
      await loadProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to seed demo data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProjectContext.Provider value={{
      projects,
      currentProject,
      revisions,
      currentRevision,
      loading,
      error,
      setCurrentProjectById,
      setCurrentRevisionById,
      refreshProjects: loadProjects,
      refreshRevisions: () => (currentProject ? loadRevisions(currentProject.id) : Promise.resolve()),
      resetToDemo
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
  return ctx;
};
