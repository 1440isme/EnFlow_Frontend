'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Calendar, User, Flag, Folder, Tag, MessageSquare, Paperclip } from 'lucide-react';
import type { Priority, Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<Priority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp',
};

const statusLabels = {
  todo: 'Chưa làm',
  'in-progress': 'Đang làm',
  done: 'Hoàn thành',
};

function TaskDetailBody({ task }: { task: Task }) {
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
                  className={
                    task.status === 'done'
                      ? 'bg-green-100 text-green-700'
                      : task.status === 'in-progress'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-700'
                  }
                >
                  {statusLabels[task.status]}
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
                  <div className="text-sm text-gray-600 mb-1">Độ ưu tiên</div>
                  <Badge className={priorityColors[task.priority]}>
                    {priorityLabels[task.priority]}
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
  const [task] = useState<Task | undefined>(undefined);

  if (!task) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Chưa tải được task</h2>
          <p className="text-gray-600 mb-4">
            {id
              ? `Gọi API với id: ${id} để lấy chi tiết task.`
              : 'Thiếu id task trong URL.'}
          </p>
          <Button onClick={() => router.push('/app/projects')}>Quay lại Project</Button>
        </div>
      </div>
    );
  }

  return <TaskDetailBody task={task} />;
}
