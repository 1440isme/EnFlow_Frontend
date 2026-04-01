'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Priority, Task, Status } from '@/types/task';
import { listTasks } from '@/lib/task-api';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByProject } from '@/lib/status-api';
import type { ProjectListResponse, StatusesResponse } from '@/types/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';


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



export default function TaskListTab() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleViewTask = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const fetchPromises = [listTasks(Number(projectId))];
    if (projectId) {
      fetchPromises.push(getListsByProject(Number(projectId)));
      fetchPromises.push(getStatusesByProject(Number(projectId)));
    } else {
      fetchPromises.push(Promise.resolve([]));
      fetchPromises.push(Promise.resolve([]));
    }

    Promise.all(fetchPromises)
      .then(([t, lData, sData]) => {
        if (!mounted) return;
        setTasks(t || []);

        let parsedLists = [];
        const rawList = lData as any;
        if (Array.isArray(rawList)) {
          parsedLists = rawList;
        } else if (rawList?.content && Array.isArray(rawList.content)) {
          parsedLists = rawList.content;
        } else if (rawList?.data && Array.isArray(rawList.data)) {
          parsedLists = rawList.data;
        } else if (rawList) {
          parsedLists = [rawList];
        }
        setLists(parsedLists);

        let parsedStatuses = [];
        const rawStatus = sData as any;
        if (Array.isArray(rawStatus)) {
          parsedStatuses = rawStatus;
        } else if (rawStatus?.content && Array.isArray(rawStatus.content)) {
          parsedStatuses = rawStatus.content;
        } else if (rawStatus?.data && Array.isArray(rawStatus.data)) {
          parsedStatuses = rawStatus.data;
        } else if (rawStatus) {
          parsedStatuses = [rawStatus];
        }
        setStatuses(parsedStatuses);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Lỗi khi tải dữ liệu');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [projectId]);





  const renderTaskTable = (groupTasks: Task[]) => {
    if (groupTasks.length === 0) {
      return (
        <div className="text-center p-6 text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg bg-gray-50">
          Không có task nào.
        </div>
      );
    }
    return (
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] bg-gray-50/50">Name</TableHead>
              <TableHead className="bg-gray-50/50">Assignment</TableHead>
              <TableHead className="bg-gray-50/50">Due Date</TableHead>
              <TableHead className="bg-gray-50/50">Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupTasks.map((task) => (
              <TableRow
                key={task.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleViewTask(task.id)}
              >
                <TableCell>
                  <div>
                    <div className="font-medium text-gray-900">{task.title}</div>
                    <div className="text-sm text-gray-500 line-clamp-1">{task.description}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {task.assigneeAvatar ? (
                      <img
                        src={task.assigneeAvatar}
                        alt={task.assignee}
                        className="w-8 h-8 rounded-full border border-gray-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                        {task.assignee?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium">{task.assignee}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">
                    {new Date(task.dueDate).toLocaleDateString('vi-VN')}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={priorityColors[task.priority]}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Đang tải...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600 font-medium">{error}</div>;
  }

  if (lists.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
        Dự án (Chưa có dữ liệu danh sách)
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Array.isArray(lists) && lists.map((list) => {
        const listTasksArr = tasks.filter((t) => t.project === String(list.listProjectId));
        const tasksByStatus = listTasksArr.reduce((acc, task) => {
          const statusKey = String(task.status);
          if (!acc[statusKey]) acc[statusKey] = [];
          acc[statusKey].push(task);
          return acc;
        }, {} as Record<string, Task[]>);

        return (
          <div key={list.listProjectId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-sm"></span>
                {list.name}
              </h2>
              <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600">
                {listTasksArr.length} Tasks
              </span>
            </div>

            <div className="p-6 space-y-8 bg-slate-50/30">
              {statuses.length > 0 ? (
                statuses.map((status) => {
                  const statusKey1 = status.name;
                  const statusKey2 = String(status.statusId);
                  const groupTasks = [...(tasksByStatus[statusKey1] || []), ...(tasksByStatus[statusKey2] || [])];
                  return (
                    <div key={status.statusId} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: status.color || '#ccc' }}
                          ></span>
                          {status.name}
                        </h3>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {groupTasks.length}
                        </span>
                      </div>
                      {renderTaskTable(groupTasks)}
                    </div>
                  );
                })
              ) : (
                ['todo', 'in-progress', 'completed'].map((statusStr) => (
                  <div key={statusStr} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                        {statusStr === 'todo' && <span className="w-2 h-2 rounded-full bg-gray-400"></span>}
                        {statusStr === 'in-progress' && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                        {statusStr === 'completed' && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                        {statusStr}
                      </h3>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {(tasksByStatus[statusStr] || []).length}
                      </span>
                    </div>
                    {renderTaskTable(tasksByStatus[statusStr] || [])}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
