import Link from 'next/link';
import type { Project, Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Folder, TrendingUp } from 'lucide-react';

const projects: Project[] = [];
const tasks: Task[] = [];

export default function ProjectsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Project</h1>
          <p className="text-gray-600">Chọn một dự án để mở dashboard riêng</p>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center text-gray-600">
          Chưa có dự án. Kết nối API để tải danh sách — mỗi dự án mở một dashboard (Overview,
          List, Board, Calendar).
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.project === project.name);
            const completedTasks = projectTasks.filter((t) => t.status === 'done').length;
            const progress =
              projectTasks.length > 0
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : 0;

            const dashboardHref = `/app/projects/${encodeURIComponent(project.id)}/dashboard?name=${encodeURIComponent(project.name)}`;

            return (
              <Link key={project.id} href={dashboardHref} className="block">
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${project.color}15` }}
                      >
                        <Folder className="w-6 h-6" style={{ color: project.color }} />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <TrendingUp className="w-4 h-4" />
                        {progress}%
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-600">{project.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tiến độ</span>
                        <span className="font-medium">
                          {completedTasks}/{projectTasks.length} tasks
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="flex items-center -space-x-2">
                      {projectTasks.slice(0, 4).map((task, idx) => (
                        <img
                          key={`${task.id}-${idx}`}
                          src={task.assigneeAvatar}
                          alt={task.assignee}
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                      ))}
                      {projectTasks.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            +{projectTasks.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
