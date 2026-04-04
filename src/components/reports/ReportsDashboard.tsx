'use client';

import { Card } from '@/components/ui/card';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDot,
  ListTodo,
  TrendingUp,
} from 'lucide-react';
import type { Task } from '@/types/task';
import type { TaskResponse } from '@/lib/task-api';
import { formatTaskPriorityLabel } from '@/lib/task-priority-ui';
import { useMemo } from 'react';
import {
  createdVsCompletedDaily,
  countOverdueRaw,
  countUnestimated,
  listBreakdown,
  mappedByTaskId,
  projectBreakdown,
  taskTypeDistribution,
} from '@/lib/report-analytics';
import { isTaskCompleted } from '@/lib/overview-task-utils';
import { statusVisualBucketFromGroup } from '@/lib/task-status-ui';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Line,
} from 'recharts';

const STATUS_FILL = {
  done: '#22c55e',
  doing: '#f97316',
  todo: '#94a3b8',
};

const PRIORITY_FILL: Record<'urgent' | 'high' | 'medium' | 'low', string> = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#64748b',
};

const TYPE_COLOR: Record<string, string> = {
  epic: '#7c3aed',
  story: '#0891b2',
  task: '#004ba8',
  bug: '#dc2626',
  subtask: '#64748b',
};

type Props = {
  variant: 'project' | 'workspace';
  /** project: scoped to project/list; workspace: entire workspace */
  title: string;
  raw: TaskResponse[];
  mapped: Task[];
  listCount?: number | null;
  /** Workspace only: project count for context */
  workspaceProjectCount?: number;
};

export default function ReportsDashboard({
  variant,
  title,
  raw,
  mapped,
  listCount,
  workspaceProjectCount,
}: Props) {
  const byId = useMemo(() => mappedByTaskId(mapped), [mapped]);

  const totalTasks = mapped.length;
  const completedTasks = mapped.filter((t) => isTaskCompleted(t)).length;
  const inProgressTasks = mapped.filter(
    (t) => statusVisualBucketFromGroup(t.statusGroup ?? '') === 'in-progress',
  ).length;
  const todoTasks = mapped.filter((t) => statusVisualBucketFromGroup(t.statusGroup ?? '') === 'todo').length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tasksByPriority = {
    urgent: mapped.filter((t) => t.priority === 'urgent').length,
    high: mapped.filter((t) => t.priority === 'high').length,
    medium: mapped.filter((t) => t.priority === 'medium' || t.priority === 'normal').length,
    low: mapped.filter((t) => t.priority === 'low').length,
  };

  const overdue = countOverdueRaw(raw);
  const unestimated = countUnestimated(raw);

  const throughput = useMemo(() => createdVsCompletedDaily(raw, 14), [raw]);
  const created14 = useMemo(
    () => throughput.reduce((a, x) => a + x.created, 0),
    [throughput],
  );
  const completed14 = useMemo(
    () => throughput.reduce((a, x) => a + x.completed, 0),
    [throughput],
  );

  const statusChartData = useMemo(
    () => [
      { name: 'Done', value: completedTasks, fill: STATUS_FILL.done },
      { name: 'In progress', value: inProgressTasks, fill: STATUS_FILL.doing },
      { name: 'To do', value: todoTasks, fill: STATUS_FILL.todo },
    ],
    [completedTasks, inProgressTasks, todoTasks],
  );

  const priorityChartData = useMemo(
    () => [
      {
        name: formatTaskPriorityLabel('urgent'),
        full: `Priority · ${formatTaskPriorityLabel('urgent')}`,
        value: tasksByPriority.urgent,
        fill: PRIORITY_FILL.urgent,
      },
      {
        name: formatTaskPriorityLabel('high'),
        full: `Priority · ${formatTaskPriorityLabel('high')}`,
        value: tasksByPriority.high,
        fill: PRIORITY_FILL.high,
      },
      {
        name: formatTaskPriorityLabel('medium'),
        full: `Priority · ${formatTaskPriorityLabel('medium')}`,
        value: tasksByPriority.medium,
        fill: PRIORITY_FILL.medium,
      },
      {
        name: formatTaskPriorityLabel('low'),
        full: `Priority · ${formatTaskPriorityLabel('low')}`,
        value: tasksByPriority.low,
        fill: PRIORITY_FILL.low,
      },
    ],
    [tasksByPriority],
  );

  const typeData = useMemo(() => taskTypeDistribution(raw), [raw]);
  const listData = useMemo(
    () => (variant === 'project' ? listBreakdown(raw, byId) : []),
    [variant, raw, byId],
  );
  const projectData = useMemo(
    () => (variant === 'workspace' ? projectBreakdown(raw, byId) : []),
    [variant, raw, byId],
  );

  const projectBarData = useMemo(() => {
    if (variant !== 'workspace' || !projectData.length) return [];
    return projectData.map((p) => ({
      short: p.name.length > 24 ? `${p.name.slice(0, 22)}…` : p.name,
      full: p.name,
      tyLe: p.pct,
      done: p.done,
      tong: p.total,
    }));
  }, [variant, projectData]);

  const executiveKpis = [
    {
      label: 'Completion rate',
      value: `${completionPct}%`,
      hint: `${completedTasks}/${totalTasks} tasks`,
      icon: CheckCircle2,
      tone: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Work in progress',
      value: String(inProgressTasks),
      hint: 'Active items in progress',
      icon: CircleDot,
      tone: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Overdue',
      value: String(overdue),
      hint: 'Open, past due',
      icon: AlertTriangle,
      tone: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      label: '14-day throughput',
      value: `${completed14} done`,
      hint: `${created14} created`,
      icon: TrendingUp,
      tone: 'text-[#004ba8]',
      bg: 'bg-blue-50',
    },
    {
      label: 'Unestimated',
      value: String(unestimated),
      hint: 'No estimate logged',
      icon: ListTodo,
      tone: 'text-slate-600',
      bg: 'bg-slate-100',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004ba8]/10">
              <BarChart3 className="h-5 w-5 text-[#004ba8]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#004ba8]">
                {variant === 'project' ? 'Project report' : 'Workspace report'}
              </p>
              <h2 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h2>
              {variant === 'project' && listCount != null ? (
                <p className="mt-2 text-xs text-gray-500">{listCount} lists in project · current filters</p>
              ) : null}
              {variant === 'workspace' && workspaceProjectCount != null ? (
                <p className="mt-2 text-xs text-gray-500">
                  {workspaceProjectCount} projects in workspace
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {totalTasks === 0 ? (
        <Card className="p-10 text-center text-gray-600">
          No tasks in this scope — not enough data for charts.
        </Card>
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Executive metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {executiveKpis.map((k) => (
                <Card key={k.label} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">{k.label}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{k.value}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{k.hint}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${k.bg}`}>
                      <k.icon className={`h-4 w-4 ${k.tone}`} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Card className="p-6">
            <h3 className="mb-1 font-semibold text-gray-900">Throughput — created vs completed</h3>
            <p className="mb-4 text-sm text-gray-500">
              Last 14 days by task creation and completion dates
            </p>
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={throughput} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                          <div className="font-medium text-gray-900">{label}</div>
                          {payload.map((p) => (
                            <div key={String(p.name)} className="text-gray-600">
                              {p.name}: {p.value}
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Created"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Workflow status</h3>
              <p className="mb-4 text-sm text-gray-500">
                Rolled up to To do, In progress, and Done.
              </p>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData.filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={64}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {statusChartData
                        .filter((d) => d.value > 0)
                        .map((entry, index) => (
                          <Cell key={`st-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0];
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                            <div className="font-medium text-gray-900">{String(row.name)}</div>
                            <div className="text-gray-600">{row.value} task</div>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Priority</h3>
              <p className="mb-4 text-sm text-gray-500">Volume by priority level.</p>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityChartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof priorityChartData)[0];
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                            <div className="font-medium text-gray-900">{row.full}</div>
                            <div className="text-gray-600">{row.value} task</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {priorityChartData.map((entry, index) => (
                        <Cell key={`pr-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {typeData.length > 0 ? (
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-gray-900">Work type</h3>
              <p className="mb-4 text-sm text-gray-500">
                Epic / Story / Task / Bug / Subtask
              </p>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={typeData.map((t) => ({
                      ...t,
                      fill: TYPE_COLOR[t.type] ?? '#64748b',
                    }))}
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" horizontal />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof typeData)[0] & { fill: string };
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                            <div className="font-medium text-gray-900">{row.label}</div>
                            <div className="text-gray-600">{row.count} task</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {typeData.map((t) => (
                        <Cell key={t.type} fill={TYPE_COLOR[t.type] ?? '#64748b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          {variant === 'project' && listData.length > 0 ? (
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-gray-900">By list</h3>
              <p className="mb-4 text-sm text-gray-500">
                Workload and completion rate per list.
              </p>
              <div
                className="w-full min-w-0"
                style={{ height: Math.min(400, Math.max(200, listData.length * 40)) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={listData.map((r) => ({
                      ...r,
                      short: r.name.length > 26 ? `${r.name.slice(0, 24)}…` : r.name,
                    }))}
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" horizontal />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="short" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof listData)[0] & { short: string };
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                            <div className="font-medium text-gray-900">{row.name}</div>
                            <div className="text-gray-600">
                              {row.pct}% done ({row.done}/{row.total} tasks)
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="pct" fill="#004ba8" radius={[0, 4, 4, 0]} name="%" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}

          {variant === 'workspace' && projectBarData.length > 0 ? (
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-gray-900">By project</h3>
              <p className="mb-4 text-sm text-gray-500">
                Completion rate per project
              </p>
              <div
                className="w-full min-w-0"
                style={{ height: Math.min(520, Math.max(220, projectBarData.length * 44)) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={projectBarData}
                    margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" horizontal />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="short" width={128} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof projectBarData)[0];
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                            <div className="font-medium text-gray-900">{row.full}</div>
                            <div className="text-gray-600">
                              {row.tyLe}% done ({row.done}/{row.tong} tasks)
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="tyLe" fill="#004ba8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
