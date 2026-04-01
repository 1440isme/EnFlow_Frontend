'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Task, Priority } from '@/types/task';
import { Badge } from '../ui/badge';
import { Calendar } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { getStatusesByProject } from '@/lib/status-api';
import { listTasks, updateTask } from '@/lib/task-api';
import type { StatusesResponse } from '@/types/api';

const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  normal: 'bg-green-100 text-green-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityLabels: Record<Priority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  normal: 'Bình thường',
  high: 'Cao',
  urgent: 'Khẩn cấp',
};

interface TaskCardProps {
  task: Task;
  onTaskClick: (taskId: string) => void;
}

type DragTaskItem = {
  id: string;
  currentStatus: string;
};

type TaskWithStatusMeta = Task & {
  statusId?: number;
  statusGroup?: string;
};

function normalizeStatusKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function taskBelongsToStatus(task: Task, status: StatusesResponse): boolean {
  const taskData = task as TaskWithStatusMeta;
  // Use statusId as the primary way to map
  if (taskData.statusId === status.statusId) return true;
  
  // Fallback to name match for legacy/import reasons
  const taskStatusName = normalizeStatusKey(task.status);
  const statusName = normalizeStatusKey(status.name);
  if (taskStatusName && statusName && taskStatusName === statusName) return true;

  // Fallback to group matching if IDs/names don't match but groups do
  const taskGroup = normalizeStatusKey(taskData.statusGroup);
  const statusGroup = normalizeStatusKey(status.statusGroup);
  if (taskGroup && statusGroup && taskGroup === statusGroup) return true;

  return false;
}

function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id, currentStatus: String(task.status) },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      onClick={() => onTaskClick(task.id)}
      className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={priorityColors[task.priority]}>
            {priorityLabels[task.priority]}
          </Badge>
          {task.tags.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <img
              src={task.assigneeAvatar}
              alt={task.assignee}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-xs">{task.assignee.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString('vi-VN', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  statusId: number;
  title: string;
  color?: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onDrop: (taskId: string, newStatusId: number) => void;
}

function Column({ statusId, title, color, tasks, onTaskClick, onDrop }: ColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item: DragTaskItem) => {
      // Cast statusId to number for comparison
      if (normalizeStatusKey(item.currentStatus) !== normalizeStatusKey(statusId)) {
        onDrop(item.id, statusId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const headerColor = color || '#d1d5db'; // default gray

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             {/* color dot indicator */}
             <span className="w-3 h-3 rounded-full" style={{ backgroundColor: headerColor }}></span>
             <h3 className="font-semibold text-gray-900">{title}</h3>
          </div>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={(node) => {
          drop(node);
        }}
        className={`space-y-3 min-h-[500px] p-3 rounded-lg border-2 border-dashed transition-colors ${
          isOver ? 'border-[#004ba8] bg-blue-50' : 'border-gray-200 bg-gray-50/40'
        }`}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoardTab() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchKanbanData() {
      if (!projectId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [statusesData, tasksData] = await Promise.all([
          getStatusesByProject(Number(projectId)),
          listTasks(Number(projectId)),
        ]);

        if (!mounted) return;

        setStatuses([...statusesData].sort((a, b) => a.position - b.position));
        setTasks(tasksData || []);
      } catch (error) {
        console.error('Failed to load Kanban data:', error);
        if (!mounted) return;
        setStatuses([]);
        setTasks([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchKanbanData();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const handleTaskClick = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  const handleDrop = async (taskId: string, newStatusId: number) => {
    // 1. Optimistic update
    const previousTasks = [...tasks];
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, statusId: newStatusId, status: String(newStatusId) as any } : task
      )
    );

    try {
      // 2. Call API to update backend
      await updateTask(Number(taskId), { statusId: newStatusId });
    } catch (error) {
      console.error('Lỗi khi cập nhật status task:', error);
      // 3. Rollback on failure
      setTasks(previousTasks);
    }
  };

  if (loading) {
     return <div className="p-8 text-gray-500">Đang tải status va task tu API...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex gap-6 overflow-x-auto pb-4">
         {statuses.length > 0 ? (
            statuses.map(status => {
               const columnTasks = tasks.filter((task) => task.statusId === status.statusId);
               return (
                 <Column
                   key={status.statusId}
                   statusId={status.statusId}
                   title={status.name}
                   color={status.color}
                   tasks={columnTasks}
                   onTaskClick={handleTaskClick}
                   onDrop={handleDrop}
                 />
               );
            })
         ) : (
            // Fallback if no statuses API available or empty
            <>
               <Column
                 statusId={100}
                 title="📋 To Do"
                 tasks={tasks.filter((t) => t.status === 'todo' || t.statusId === 100)}
                 onTaskClick={handleTaskClick}
                 onDrop={handleDrop}
               />
               <Column
                 statusId={101}
                 title="🚀 In Progress"
                 tasks={tasks.filter((t) => t.status === 'in-progress' || t.statusId === 101)}
                 onTaskClick={handleTaskClick}
                 onDrop={handleDrop}
               />
               <Column
                 statusId={102}
                 title="✅ Completed"
                 tasks={tasks.filter((t) => t.status === 'completed' || t.statusId === 102)}
                 onTaskClick={handleTaskClick}
                 onDrop={handleDrop}
               />
            </>
         )}
      </div>
    </DndProvider>
  );
}
