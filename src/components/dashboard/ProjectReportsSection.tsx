'use client';

import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { fetchTasksForReports } from '@/lib/task-api';
import ReportsDashboard from '@/components/reports/ReportsDashboard';

type Props = {
  projectId: number;
  listId: number | null;
  listCount: number;
};

export default function ProjectReportsSection({ projectId, listId, listCount }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<Awaited<ReturnType<typeof fetchTasksForReports>>['raw']>([]);
  const [mapped, setMapped] = useState<Awaited<ReturnType<typeof fetchTasksForReports>>['mapped']>(
    [],
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const data =
          listId != null && Number.isFinite(listId)
            ? await fetchTasksForReports({ kind: 'list', listId })
            : await fetchTasksForReports({ kind: 'project', projectId });
        if (!mounted) return;
        setRaw(data.raw);
        setMapped(data.mapped);
      } catch (err: unknown) {
        console.error(err);
        if (mounted) setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu báo cáo');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [projectId, listId]);

  if (loading) {
    return <Card className="p-6">Đang tải báo cáo...</Card>;
  }

  if (error) {
    return <Card className="p-6 text-red-600">{error}</Card>;
  }

  return (
    <ReportsDashboard
      variant="project"
      title="Thống kê & phân tích dự án"
      raw={raw}
      mapped={mapped}
      listCount={listCount}
    />
  );
}
