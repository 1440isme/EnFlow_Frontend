'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Priority, Task } from '@/types/task';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

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
  'todo': 'Chưa làm',
  'in-progress': 'Đang làm',
  'done': 'Hoàn thành',
};

export default function TaskListTab() {
  const router = useRouter();
  const [tasks] = useState<Task[]>([]);

  const handleViewTask = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Task</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Ưu tiên</TableHead>
            <TableHead>Người thực hiện</TableHead>
            <TableHead>Dự án</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Chưa có task. Kết nối API để tải danh sách.
              </TableCell>
            </TableRow>
          ) : null}
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => handleViewTask(task.id)}
            >
              <TableCell>
                <div>
                  <div className="font-medium text-gray-900">{task.title}</div>
                  <div className="text-sm text-gray-500 line-clamp-1">{task.description}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    task.status === 'done'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : task.status === 'in-progress'
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-100'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                  }
                >
                  {statusLabels[task.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={priorityColors[task.priority]}>
                  {priorityLabels[task.priority]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <img
                    src={task.assigneeAvatar}
                    alt={task.assignee}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm">{task.assignee}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">{task.project}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-gray-600">
                  {new Date(task.dueDate).toLocaleDateString('vi-VN')}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleViewTask(task.id);
                    }}>
                      <Eye className="mr-2 h-4 w-4" />
                      Xem chi tiết
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                      Chỉnh sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                      Sao chép
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => e.stopPropagation()}
                      className="text-red-600"
                    >
                      Xóa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
