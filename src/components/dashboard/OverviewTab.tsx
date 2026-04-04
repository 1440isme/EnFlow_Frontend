'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { Task } from '@/types/task';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { useEffect, useMemo, useState } from 'react';
import { getTaskAssignees, getTasksByList, listTasks } from '@/lib/task-api';
import { getProjectById, type ProjectResponse } from '@/lib/project-api';
import { isTaskCompleted, sortTasksByRecencyDesc } from '@/lib/overview-task-utils';
import { statusAccentHex, statusBadgePresentation } from '@/lib/task-status-ui';
import { cn } from '@/components/ui/utils';

type Props = {
  projectId?: number;
  listId?: number | null;
  listCount?: number;
};

export default function OverviewTab({ projectId, listId, listCount }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectDetail, setProjectDetail] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentEnriched, setRecentEnriched] = useState<Task[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const tasksPromise = listId ? getTasksByList(listId) : listTasks(projectId);
    const projectPromise =
      projectId != null && Number.isFinite(projectId) && projectId > 0
        ? getProjectById(projectId).catch(() => null)
        : Promise.resolve(null);

    Promise.all([tasksPromise, projectPromise])
      .then(([t, p]) => {
        if (!mounted) return;
        setTasks(t || []);
        setProjectDetail(p);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Không tải được tổng quan');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [projectId, listId]);

  const sortedByRecency = useMemo(() => sortTasksByRecencyDesc(tasks), [tasks]);

  useEffect(() => {
    let cancelled = false;
    const top = sortedByRecency.slice(0, 5);
    if (top.length === 0) {
      setRecentEnriched([]);
      return;
    }

    Promise.all(
      top.map(async (t) => {
        try {
          const assignees = await getTaskAssignees(Number(t.id));
          const primary = assignees.find((a) => a.isPrimary) ?? assignees[0];
          const name = primary?.fullName?.trim() || primary?.username?.trim() || '';
          return { ...t, assignee: name };
        } catch {
          return t;
        }
      }),
    ).then((rows) => {
      if (!cancelled) setRecentEnriched(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [sortedByRecency]);

  if (loading) {
    return <Card className="p-6">Đang tải tổng quan...</Card>;
  }

  if (error) {
    return <Card className="p-6 text-red-600">{error}</Card>;
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => isTaskCompleted(t)).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const scopeLabel = listId ? 'theo list đang chọn' : 'toàn bộ dự án';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Tổng quan nhanh</h2>

      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Dự án này</h3>
        {projectDetail ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-900 text-lg">{projectDetail.name}</span>
              {projectDetail.projectKey ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {projectDetail.projectKey}
                </span>
              ) : null}
              {projectDetail.archived ? (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                  Đã lưu trữ
                </span>
              ) : null}
            </div>
            {projectDetail.description?.trim() ? (
              <p className="text-sm text-gray-600 leading-relaxed">{projectDetail.description}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">Chưa có mô tả dự án.</p>
            )}
            <div className="pt-3 border-t space-y-2">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-gray-600">Tiến độ hoàn thành </span>
                <span className="font-semibold tabular-nums text-gray-900">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2.5" />
              <p className="text-xs text-gray-500">
                {completedTasks}/{totalTasks} task đã hoàn thành
                {totalTasks === 0 ? ' · Chưa có task trong phạm vi này' : ''}
              </p>
            </div>
            {listCount != null ? (
              <div className="pt-2 border-t text-sm flex justify-between gap-4">
                <span className="text-gray-600">Số danh sách (list)</span>
                <span className="font-medium text-gray-900">{listCount}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-600">Không tải được thông tin dự án.</p>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Hoạt động gần đây</h3>
        <p className="text-sm text-gray-500 mb-4">Cập nhật mới nhất (tối đa 5 task).</p>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          {recentEnriched.length === 0 ? (
            <p className="p-4 text-sm text-gray-600">Chưa có task trong phạm vi này.</p>
          ) : (
            recentEnriched.map((task) => {
              const label =
                task.projectDisplayName?.trim() ||
                (task.project ? `Dự án #${task.project}` : '');
              const showAssignee = task.assignee.trim().length > 0;
              const statusBadge = statusBadgePresentation(
                task.statusGroup ?? 'to_do',
                task.statusColor,
              );
              const rowAccentHex = statusAccentHex(
                task.statusGroup ?? 'to_do',
                task.statusColor,
              );
              return (
                <Link
                  key={task.id}
                  href={`/app/tasks/${task.id}`}
                  className="flex items-center gap-3 px-3 py-3 pr-2 hover:bg-gray-50/80 transition-colors group"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: rowAccentHex }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-[#004ba8] truncate transition-colors">
                        {task.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        {showAssignee ? (
                          <>
                            {task.assignee}
                            {label ? ` · ${label}` : null}
                          </>
                        ) : (
                          <>{label || 'Task'}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 max-w-[10rem] truncate rounded-full px-2 py-1 text-xs font-semibold',
                      statusBadge.className,
                    )}
                    style={statusBadge.style}
                  >
                    {String(task.status)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#004ba8] transition-colors" aria-hidden />
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
