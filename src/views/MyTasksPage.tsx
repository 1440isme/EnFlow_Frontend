'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flag } from 'lucide-react';
import { listTasks } from '@/lib/task-api';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function MyTasksPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listTasks()
      .then((all) => {
        if (!mounted) return;
        // Try to match by full name or email
        const my = all.filter(
          (t) => t.assignee === profile.fullName || t.assignee === profile.email
        );
        setTasks(my);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Lỗi khi tải tasks');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profile]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">My Task</h1>
        <p className="text-gray-600">Tất cả task được phân công cho bạn</p>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-gray-600">Đang tải...</Card>
      ) : error ? (
        <Card className="p-12 text-center text-red-600">{error}</Card>
      ) : tasks.length === 0 ? (
        <Card className="p-12 text-center text-gray-600">
          Chưa có task được giao. Kết nối API (theo user hiện tại) để hiển thị danh sách.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/app/tasks/${task.id}`)}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={
                      task.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : task.status === 'in-progress'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                    }
                  >
                    {task.status === 'completed'
                      ? 'Hoàn thành'
                      : task.status === 'in-progress'
                        ? 'Đang làm'
                        : 'Chưa làm'}
                  </Badge>
                  {task.tags.slice(0, 2).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Flag className="w-4 h-4" />
                    <span className="capitalize">{task.priority}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(task.dueDate).toLocaleDateString('vi-VN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
