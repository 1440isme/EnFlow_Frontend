'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Task, Priority } from '@/types/task';
import type { ProjectListResponse, StatusesResponse } from '@/types/api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Plus } from 'lucide-react';
import CreateStatusDialog from './CreateStatusDialog';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByList, getStatusesByProject } from '@/lib/status-api';
import { getTasksByList, listTasks, updateTask } from '@/lib/task-api';

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

function normalizeCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const raw = value as { content?: T[]; data?: T[] } | null | undefined;
  if (raw?.content && Array.isArray(raw.content)) return raw.content;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  return value ? ([value] as T[]) : [];
}

function taskBelongsToStatus(task: Task, status: StatusesResponse): boolean {
  const taskData = task as TaskWithStatusMeta;
  // Use statusId as the primary way to map
  if (taskData.statusId === status.statusId) return true;

  // Fallback to display-name match for imported/legacy data
  const taskStatusName = normalizeStatusKey(task.status);
  const statusDisplayName = normalizeStatusKey(status.statusGroup);
  if (taskStatusName && statusDisplayName && taskStatusName === statusDisplayName) return true;

  const taskGroup = normalizeStatusKey(taskData.statusGroup);
  const statusGroup = normalizeStatusKey(status.statusGroup);
  return Boolean(taskGroup && statusGroup && taskGroup === statusGroup);
}

function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id, currentStatus: String(task.statusId ?? task.status) },
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

type AddStatusColumnProps = {
  onClick: () => void;
  disabled?: boolean;
};

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

function AddStatusColumn({ onClick, disabled }: AddStatusColumnProps) {
  return (
    <div className="flex-1 min-w-[300px]">
        <div className="mb-4 h-[30px]"> {/* 👈 thêm height */}
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full " />
                    <h3 ></h3>
                </div>
            </div>
        </div>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className="h-[500px] w-full border-2 border-dashed border-gray-200 bg-gray-50/40 text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-[#004ba8] flex flex-col gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm border border-gray-200">
          <Plus className="h-6 w-6" />
        </div>
        <div className="space-y-1 text-center">
          <div className="font-semibold"></div>
          <div className="text-xs text-gray-500"></div>
        </div>
      </Button>
    </div>
  );
}

type Props = {
  listId?: number | null;
};

export default function KanbanBoardTab({ listId }: Props) {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createStatusOpen, setCreateStatusOpen] = useState(false);

  const fetchKanbanData = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [statusesData, tasksData, listsData] = await Promise.all([
        listId ? getStatusesByList(listId) : getStatusesByProject(Number(projectId)),
        listId ? getTasksByList(listId) : listTasks(Number(projectId)),
        getListsByProject(Number(projectId)),
      ]);

      setStatuses([...normalizeCollection<StatusesResponse>(statusesData)].sort((a, b) => a.position - b.position));
      setTasks(normalizeCollection<Task>(tasksData));
      setLists([...normalizeCollection<ProjectListResponse>(listsData)].sort((a, b) => a.position - b.position));
    } catch (error) {
      console.error('Failed to load Kanban data:', error);
      setStatuses([]);
      setTasks([]);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, listId]);

  useEffect(() => {
    void fetchKanbanData();
  }, [fetchKanbanData]);

   const handleTaskClick = (taskId: string) => {
     router.push(`/app/tasks/${taskId}`);
   };

   const handleStatusCreated = async () => {
     await fetchKanbanData();
   };

   if (loading) {
      return <div className="p-8 text-gray-500">Đang tải status va task tu API...</div>;
   }

   const isListScope = Boolean(listId);
   const selectedListOptions = isListScope
     ? lists.filter((list) => list.listProjectId === listId)
     : lists;

   // Deduplicate statuses by statusGroup when in project scope
   let displayStatuses: StatusesResponse[] = [...statuses].sort((a, b) => a.position - b.position);
   if (!isListScope && displayStatuses.length > 0) {
     const seenGroups = new Set<string>();
     const uniqueByGroup: StatusesResponse[] = [];
     
     displayStatuses.forEach((status) => {
       const groupKey = String(status.statusGroup || '').trim();
       if (!seenGroups.has(groupKey)) {
         seenGroups.add(groupKey);
         uniqueByGroup.push(status);
       }
     });
     
     displayStatuses = uniqueByGroup;
   }

   // Build statusGroup -> first statusId mapping for drop handler
   const statusGroupMap = new Map<string, number>();
   displayStatuses.forEach((status) => {
     const groupKey = String(status.statusGroup || '').trim();
     if (!statusGroupMap.has(groupKey)) {
       statusGroupMap.set(groupKey, status.statusId);
     }
   });

   const handleDrop = async (taskId: string, displayedStatusId: number) => {
     // Find actual statusId from the displayed status column
     const displayedStatus = displayStatuses.find((s) => s.statusId === displayedStatusId);
     if (!displayedStatus) return;
     
     // In project scope, multiple statuses with same group could exist
     // Use the one from the display (first in group) but if need to drop to specific list status,
     // map back to any available status from that group
     const groupKey = String(displayedStatus.statusGroup || '').trim();
     const actualStatusIdToUse = statusGroupMap.get(groupKey) ?? displayedStatusId;

     // 1. Optimistic update
     const previousTasks = [...tasks];
     setTasks((prevTasks) =>
       prevTasks.map((task) =>
         task.id === taskId ? { ...task, statusId: actualStatusIdToUse, status: String(actualStatusIdToUse) as any } : task
       )
     );

     try {
       // 2. Call API to update backend
       await updateTask(Number(taskId), { statusId: actualStatusIdToUse });
     } catch (error) {
       console.error('Lỗi khi cập nhật status task:', error);
       // 3. Rollback on failure
       setTasks(previousTasks);
     }
   };


   return (
     <DndProvider backend={HTML5Backend}>

       <div className="flex gap-6 overflow-x-auto pb-4 items-stretch">
          {displayStatuses.length > 0 ? (
             <>
               {displayStatuses.map((status) => {
                  const columnTasks = tasks.filter((task) => taskBelongsToStatus(task, status));
                  return (
                    <Column
                      key={status.statusId}
                      statusId={status.statusId}
                      title={status.statusGroup}
                      color={status.color}
                      tasks={columnTasks}
                      onTaskClick={handleTaskClick}
                      onDrop={handleDrop}
                    />
                  );
               })}
               <AddStatusColumn onClick={() => setCreateStatusOpen(true)} disabled={!isListScope} />
             </>
          ) : (
             <div className="flex-1 min-w-[300px] rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
               This Project is empty
             </div>
          )}

      </div>

      <CreateStatusDialog
        open={createStatusOpen}
        onOpenChange={setCreateStatusOpen}
        projectId={Number(projectId)}
        lists={selectedListOptions}
        existingStatuses={statuses}
        onCreated={handleStatusCreated}
      />
    </DndProvider>
  );
}
