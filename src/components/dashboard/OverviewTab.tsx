import { CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import type { Task, Project } from '@/types/task';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';

const tasks: Task[] = [];
const projects: Project[] = [];

export default function OverviewTab() {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const todoTasks = tasks.filter((t) => t.status === 'todo').length;
  const highPriorityTasks = tasks.filter(
    (t) => t.priority === 'high' || t.priority === 'urgent'
  ).length;

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const stats = [
    {
      title: 'Tổng số Task',
      value: totalTasks,
      icon: CheckCircle2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Đang thực hiện',
      value: inProgressTasks,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Hoàn thành',
      value: completedTasks,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Ưu tiên cao',
      value: highPriorityTasks,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tiến độ hoàn thành</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Tổng thể</span>
                <span className="font-medium text-gray-900">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div className="pt-4 border-t space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">✓ Hoàn thành</span>
                <span className="font-medium">{completedTasks} tasks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">→ Đang làm</span>
                <span className="font-medium">{inProgressTasks} tasks</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">○ Chưa bắt đầu</span>
                <span className="font-medium">{todoTasks} tasks</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Dự án đang hoạt động</h3>
          <div className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-sm text-gray-600">
                Chưa có dự án. Kết nối API để tải danh sách dự án.
              </p>
            ) : (
              projects.map((project) => (
                <div key={project.id} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color }}
                  ></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{project.name}</span>
                      <span className="text-sm text-gray-600">{project.tasksCount} tasks</span>
                    </div>
                    <p className="text-sm text-gray-600">{project.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Hoạt động gần đây</h3>
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-600">
              Chưa có hoạt động. Kết nối API để hiển thị task gần đây.
            </p>
          ) : (
            tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 pb-4 border-b last:border-b-0 last:pb-0"
              >
                <img
                  src={task.assigneeAvatar}
                  alt={task.assignee}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-sm text-gray-600">
                        {task.assignee} • {task.project}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        task.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'in-progress'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {task.status === 'done'
                        ? 'Hoàn thành'
                        : task.status === 'in-progress'
                          ? 'Đang làm'
                          : 'Chưa làm'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
