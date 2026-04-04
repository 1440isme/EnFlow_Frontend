'use client';

import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { fetchTasksForReports } from '@/lib/task-api';
import { listProjects } from '@/lib/project-api';
import ReportsDashboard from '@/components/reports/ReportsDashboard';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

export default function WorkspaceReportsPage() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getWorkspaceSnapshot().workspaceId : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof fetchTasksForReports>>['raw']>([]);
  const [mapped, setMapped] = useState<Awaited<ReturnType<typeof fetchTasksForReports>>['mapped']>(
    [],
  );
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    const sync = () => setActiveWorkspaceId(getWorkspaceSnapshot().workspaceId);
    sync();
    window.addEventListener('enflow-workspace-changed', sync);
    return () => window.removeEventListener('enflow-workspace-changed', sync);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [data, projects] = await Promise.all([
          fetchTasksForReports({ kind: 'workspace' }),
          listProjects(),
        ]);
        if (!mounted) return;
        setRaw(data.raw);
        setMapped(data.mapped);
        setProjectCount(projects.length);
      } catch (err: unknown) {
        console.error(err);
        if (mounted) setError(err instanceof Error ? err.message : 'Không tải được báo cáo workspace');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [activeWorkspaceId]);

  if (loading) {
    return (
      <div className="p-6">
        <Card className="p-6">Đang tải báo cáo workspace…</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 text-red-600">{error}</Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ReportsDashboard
        variant="workspace"
        title="Thống kê workspace"
        raw={raw}
        mapped={mapped}
        workspaceProjectCount={projectCount}
      />
    </div>
  );
}
