'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Priority, Task } from '@/types/task';
import { getTasksByList, listTasks } from '@/lib/task-api';
import { getListsByProject } from '@/lib/list-api';
import { getStatusesByProject } from '@/lib/status-api';
import type { ProjectListResponse, StatusesResponse } from '@/types/api';
import CreateListDialog from './CreateListDialog';
import RenameListDialog from './RenameListDialog';
import DeleteListDialog from './DeleteListDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ChevronDown, ChevronRight, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';


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
export type TaskListTabProps = {
  listId?: number | null;
};

export default function TaskListTab({ listId }: TaskListTabProps) {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [statuses, setStatuses] = useState<StatusesResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [collapsedLists, setCollapsedLists] = useState<Record<number, boolean>>({});
  const [selectedListForRename, setSelectedListForRename] = useState<ProjectListResponse | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedListForDelete, setSelectedListForDelete] = useState<ProjectListResponse | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const normalizeCollection = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];

    const raw = value as any;
    if (raw?.content && Array.isArray(raw.content)) return raw.content as T[];
    if (raw?.data && Array.isArray(raw.data)) return raw.data as T[];
    if (raw) return [raw as T];
    return [];
  };

  const fetchData = async () => {
    const projectNum = Number(projectId);
    const tasksPromise = listId ? getTasksByList(listId) : listTasks(projectNum);
    const listsPromise = projectId ? getListsByProject(projectNum) : Promise.resolve([] as ProjectListResponse[]);
    const statusesPromise = projectId ? getStatusesByProject(projectNum) : Promise.resolve([] as StatusesResponse[]);

    const [t, lData, sData] = await Promise.all([tasksPromise, listsPromise, statusesPromise]);

    return {
      tasks: t || [],
      lists: normalizeCollection<ProjectListResponse>(lData),
      statuses: normalizeCollection<StatusesResponse>(sData),
    };
  };

  const handleViewTask = (taskId: string) => {
    router.push(`/app/tasks/${taskId}`);
  };

  const handleToggleList = (listProjectId: number) => {
    setCollapsedLists((current) => ({
      ...current,
      [listProjectId]: !current[listProjectId],
    }));
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchData();
      setTasks(data.tasks);
      setLists(data.lists);
      setStatuses(data.statuses);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const isProjectScope = !listId;

  const handleListCreated = async () => {
    await refreshData();
    window.dispatchEvent(new Event('enflow:lists-changed'));
  };

  const handleRenameClick = (list: ProjectListResponse) => {
    setSelectedListForRename(list);
    setRenameDialogOpen(true);
  };

  const handleDeleteClick = (list: ProjectListResponse) => {
    setSelectedListForDelete(list);
    setDeleteDialogOpen(true);
  };

  const handleListUpdated = async () => {
    await refreshData();
    window.dispatchEvent(new Event('enflow:lists-changed'));
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchData()
      .then((data) => {
        if (!mounted) return;
        setTasks(data.tasks);
        setLists(data.lists);
        setStatuses(data.statuses);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(err);
        setError(err?.message || 'Lỗi khi tải dữ liệu');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [projectId, listId]);





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

  const displayedLists = listId ? lists.filter((list) => list.listProjectId === listId) : lists;

  return (
    <div className="space-y-6">
      <CreateListDialog
        open={createListOpen}
        onOpenChange={setCreateListOpen}
        projectId={Number(projectId)}
        lists={lists}
        onCreated={handleListCreated}
      />

      <RenameListDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        list={selectedListForRename}
        onUpdated={handleListUpdated}
      />

      <DeleteListDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        list={selectedListForDelete}
        onDeleted={handleListUpdated}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">

        </div>
        {isProjectScope ? (
          <Button type="button" className="gap-2 self-start sm:self-auto" onClick={() => setCreateListOpen(true)}>
            <Plus className="w-4 h-4" />
            Create List
          </Button>
        ) : null}
      </div>

      {displayedLists.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200 space-y-4">
          <div>{isProjectScope ? 'No lists have been created in this project yet.' : 'No lists found.'}</div>
          {isProjectScope ? (
            <Button type="button" onClick={() => setCreateListOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create List
            </Button>
          ) : null}
        </div>
      ) : null}

      {Array.isArray(displayedLists) && displayedLists.map((list) => {
        const listTasksArr = tasks.filter((t) => Number(t.listId) === list.listProjectId);
        const listStatuses = statuses
          .filter((status) => Number(status.listId) === list.listProjectId)
          .sort((a, b) => Number(a.position) - Number(b.position));
        const tasksByStatus = listTasksArr.reduce((acc, task) => {
          const statusKey = String(task.status);
          if (!acc[statusKey]) acc[statusKey] = [];
          acc[statusKey].push(task);
          return acc;
        }, {} as Record<string, Task[]>);
        const isCollapsed = Boolean(collapsedLists[list.listProjectId]);

        return (
          <div key={list.listProjectId} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-gray-900"
                  onClick={() => handleToggleList(list.listProjectId)}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? `Mở rộng list ${list.name}` : `Thu gọn list ${list.name}`}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <span className="w-2 h-6 bg-blue-500 rounded-sm"></span>
                <h2 className="text-lg font-bold text-slate-800 truncate">{list.name}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-accent hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004ba8]/30 ml-2 flex-shrink-0"
                    aria-label={`Tùy chọn cho list ${list.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRenameClick(list)} className="cursor-pointer">
                      <Pencil className="mr-2 h-4 w-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(list)}
                      className="cursor-pointer text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600">
                {listTasksArr.length} Tasks
              </span>
            </div>

            {!isCollapsed ? (
              <div className="p-6 space-y-8 bg-slate-50/30">
                {listStatuses.length > 0 ? (
                  listStatuses.map((status) => {
                    const statusKey1 = status.statusGroup;
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
                            {status.statusGroup}
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
                  [
                    { key: 'todo', label: 'TO DO' },
                    { key: 'in-progress', label: 'IN PROGRESS' },
                    { key: 'completed', label: 'COMPLETED' },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                          {key === 'todo' && <span className="w-2 h-2 rounded-full bg-gray-400"></span>}
                          {key === 'in-progress' && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                          {key === 'completed' && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                          {label}
                        </h3>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {(tasksByStatus[key] || []).length}
                        </span>
                      </div>
                      {renderTaskTable(tasksByStatus[key] || [])}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
