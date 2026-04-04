'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, Flag, Folder, Tag, MessageSquare, Paperclip } from 'lucide-react';
import type { Priority, Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getTaskById } from '@/lib/task-api';
import { getStatusById } from '@/lib/status-api';
import type { StatusesResponse } from '@/types/api';
import { formatTaskPriorityLabel } from '@/lib/task-priority-ui';

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  normal: 'bg-green-100 text-green-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusBadgeClasses: Record<string, string> = {
  'to do': 'bg-gray-100 text-gray-700',
  'in progress': 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  review: 'bg-blue-100 text-blue-700',
  testing: 'bg-purple-100 text-purple-700',
  deploy: 'bg-indigo-100 text-indigo-700',
  backlog: 'bg-slate-100 text-slate-700',
  idea: 'bg-emerald-100 text-emerald-700',
};

function normalizeStatusGroup(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function getStatusBadgeClass(statusGroup?: string) {
  return statusBadgeClasses[normalizeStatusGroup(statusGroup)] ?? 'bg-gray-100 text-gray-700';
}

function getStatusLabel(statusGroup?: string) {
  return statusGroup?.trim() || 'Không xác định';
}

function TaskDetailBody({
  task,
  statusLabel,
  statusBadgeClass,
}: {
  task: Task;
  statusLabel: string;
  statusBadgeClass: string;
}) {
  const router = useRouter();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2">
        <ArrowLeft className="w-4 h-4" />
        Quay lại
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-semibold text-gray-900">{task.title}</h1>
                <Badge
                  variant="secondary"
                  className={statusBadgeClass}
                >
                  {statusLabel}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Mô tả</h3>
            <p className="text-gray-700 leading-relaxed">{task.description}</p>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Bình luận
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Chưa có bình luận. Tải từ API và render danh sách tại đây.
            </p>

            <Separator className="my-4" />

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" aria-hidden />
              <div className="flex-1">
                <Textarea
                  placeholder="Thêm bình luận..."
                  className="mb-2 bg-input-background"
                />
                <Button className="bg-[#004ba8] hover:bg-[#003d8a]">Gửi bình luận</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Thông tin</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Người thực hiện</div>
                  <div className="flex items-center gap-2">
                    <img
                      src={task.assigneeAvatar}
                      alt={task.assignee}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="font-medium text-gray-900">{task.assignee}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Deadline</div>
                  <div className="font-medium text-gray-900">
                    {new Date(task.dueDate).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Flag className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Priority</div>
                  <Badge className={priorityColors[task.priority]}>
                    {formatTaskPriorityLabel(task.priority)}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Folder className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Dự án</div>
                  <div className="font-medium text-gray-900">{task.project}</div>
                </div>
              </div>

              <Separator />

              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Hành động</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Paperclip className="w-4 h-4" />
                Thêm file đính kèm
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <User className="w-4 h-4" />
                Thay đổi người thực hiện
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calendar className="w-4 h-4" />
                Thay đổi deadline
              </Button>
              <Separator className="my-2" />
              <Button variant="destructive" className="w-full">
                Xóa task
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Lịch sử hoạt động</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[#004ba8] rounded-full mt-1.5"></div>
                <div>
                  <div className="text-gray-900">Task được tạo</div>
                  <div className="text-gray-500 text-xs">
                    {new Date(task.createdAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
              <p className="text-gray-500 text-xs pl-4">
                Các sự kiện tiếp theo lấy từ API (audit log / activity).
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string | undefined;
  const [task, setTask] = useState<Task | null>(null);
  const [status, setStatus] = useState<StatusesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTask() {
      if (!id) {
        setLoading(false);
        setError('Thiếu id task trong URL.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const loadedTask = await getTaskById(Number(id));
        if (!mounted) return;
        setTask(loadedTask);

        if (loadedTask.statusId) {
          const loadedStatus = await getStatusById(loadedTask.statusId);
          if (!mounted) return;
          setStatus(loadedStatus);
        } else {
          setStatus(null);
        }
      } catch (err) {
        if (!mounted) return;
        setTask(null);
        setStatus(null);
        setError(err instanceof Error ? err.message : 'Không tải được task.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTask();

    return () => {
      mounted = false;
    };
  }, [id]);

  const statusLabel = useMemo(() => getStatusLabel(status?.statusGroup), [status]);
  const statusBadgeClass = useMemo(() => getStatusBadgeClass(status?.statusGroup), [status]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Đang tải task...</h2>
          <p className="text-gray-600 mb-4">Vui lòng chờ trong giây lát.</p>
          <Button onClick={() => router.push('/app/projects')}>Quay lại Project</Button>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Không tải được task</h2>
          <p className="text-gray-600 mb-4">
            {error || (id ? `Không tìm thấy task với id: ${id}` : 'Thiếu id task trong URL.')}
          </p>
          <Button onClick={() => router.push('/app/projects')}>Quay lại Project</Button>
        </div>
      </div>
    );
  }

  return (
    <TaskDetailBody task={task} statusLabel={statusLabel} statusBadgeClass={statusBadgeClass} />
  );
}
