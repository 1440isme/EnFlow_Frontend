import { Card } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, Users, Target } from 'lucide-react';
import type { Task, Project } from '@/types/task';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { getTasksByList, listTasks } from '@/lib/task-api';
import { listProjects } from '@/lib/project-api';

type Props = {
  /** Ẩn khối so sánh nhiều dự án; đổi KPI cuối cho phù hợp một dự án */
  projectScoped?: boolean;
  projectId?: number;
  listId?: number | null;
};

export default function ProjectReportsSection({ projectScoped, projectId, listId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      listId ? getTasksByList(listId) : listTasks(projectId),
      listProjects(),
    ])
      .then(([t, p]) => {
        if (!mounted) return;
        setTasks(t || []);
        setProjects(p || []);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Lỗi khi tải dữ liệu báo cáo');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
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

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const todoTasks = tasks.filter((t) => t.status === 'todo').length;

  const tasksByPriority = {
    urgent: tasks.filter((t) => t.priority === 'urgent').length,
    high: tasks.filter((t) => t.priority === 'high').length,
    medium: tasks.filter((t) => t.priority === 'medium').length,
    low: tasks.filter((t) => t.priority === 'low').length,
  };

  const pct = (n: number) => (totalTasks > 0 ? (n / totalTasks) * 100 : 0);
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Báo cáo & thống kê</h2>
        <p className="text-sm text-gray-600">
          Phân tích hiệu suất trong phạm vi dự án (dữ liệu từ API sau khi tích hợp)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Tổng số Tasks</p>
            <p className="text-3xl font-semibold text-gray-900">{totalTasks}</p>
            <p className="text-sm text-gray-500">Theo bộ lọc dự án</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Hoàn thành</p>
            <p className="text-3xl font-semibold text-gray-900">{completedTasks}</p>
            <p className="text-sm text-gray-600">{completionPct}% tỷ lệ hoàn thành</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <PieChart className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Đang thực hiện</p>
            <p className="text-3xl font-semibold text-gray-900">{inProgressTasks}</p>
            <p className="text-sm text-gray-600">Tasks đang xử lý</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              {projectScoped ? (
                <Target className="w-6 h-6 text-purple-600" />
              ) : (
                <Users className="w-6 h-6 text-purple-600" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              {projectScoped ? 'Chỉ số dự án' : 'Số dự án'}
            </p>
            <p className="text-3xl font-semibold text-gray-900">
              {projectScoped ? '—' : projects.length}
            </p>
            <p className="text-sm text-gray-600">
              {projectScoped ? 'Kết nối API để hiển thị' : 'Đang hoạt động'}
            </p>
          </div>
        </Card>
      </div>

      {totalTasks === 0 ? (
        <Card className="p-8 text-center text-gray-600">
          Chưa có dữ liệu báo cáo cho dự án này. Kết nối API để tải tasks.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Phân bổ trạng thái Tasks</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">✓ Hoàn thành</span>
                    <span className="font-medium">{completedTasks} tasks</span>
                  </div>
                  <Progress
                    value={pct(completedTasks)}
                    className="h-3 [&>div]:bg-green-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">→ Đang làm</span>
                    <span className="font-medium">{inProgressTasks} tasks</span>
                  </div>
                  <Progress
                    value={pct(inProgressTasks)}
                    className="h-3 [&>div]:bg-orange-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">○ Chưa bắt đầu</span>
                    <span className="font-medium">{todoTasks} tasks</span>
                  </div>
                  <Progress value={pct(todoTasks)} className="h-3 [&>div]:bg-gray-500" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Phân bổ theo độ ưu tiên</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">🔴 Khẩn cấp</span>
                    <span className="font-medium">{tasksByPriority.urgent} tasks</span>
                  </div>
                  <Progress
                    value={pct(tasksByPriority.urgent)}
                    className="h-3 [&>div]:bg-red-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">🟠 Cao</span>
                    <span className="font-medium">{tasksByPriority.high} tasks</span>
                  </div>
                  <Progress
                    value={pct(tasksByPriority.high)}
                    className="h-3 [&>div]:bg-orange-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">🔵 Trung bình</span>
                    <span className="font-medium">{tasksByPriority.medium} tasks</span>
                  </div>
                  <Progress
                    value={pct(tasksByPriority.medium)}
                    className="h-3 [&>div]:bg-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">⚪ Thấp</span>
                    <span className="font-medium">{tasksByPriority.low} tasks</span>
                  </div>
                  <Progress
                    value={pct(tasksByPriority.low)}
                    className="h-3 [&>div]:bg-gray-500"
                  />
                </div>
              </div>
            </Card>
          </div>

          {!projectScoped ? (
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Hiệu suất theo dự án</h3>
              <div className="space-y-6">
                {projects.map((project) => {
                  const projectTasks = tasks.filter((t) => t.project === project.id);
                  const completedProjectTasks = projectTasks.filter(
                    (t) => t.status === 'completed'
                  ).length;
                  const progress =
                    projectTasks.length > 0
                      ? Math.round((completedProjectTasks / projectTasks.length) * 100)
                      : 0;

                  return (
                    <div key={project.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium text-gray-900">{project.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {completedProjectTasks}/{projectTasks.length} tasks
                        </div>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
