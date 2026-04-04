"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleDotDashed,
  CheckCircle2,
  ChevronRight,
  Clock3,
  AtSign,
  Bell,
  FileUp,
  Flag,
  FolderKanban,
  GitBranch,
  Link2,
  Loader2,
  Paperclip,
  MessageCirclePlus,
  SendHorizonal,
  Sparkles,
  MoreHorizontal,
  PencilLine,
  Plus,
  Save,
  Tag,
  Trash2,
  UserRound,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/utils";
import type { WorkspaceMemberOption } from "@/components/tasks/TaskAssigneeCell";
import { TaskAssigneeCell } from "@/components/tasks/TaskAssigneeCell";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import type { UserResponse } from "@/types/api";
import type { DashboardTask } from "@/types/dashboard-task";
import {
  assigneeUserIdsFromRows,
  taskAssigneeRowsToDisplay,
} from "@/lib/task-assignee-utils";
import {
  addTaskAssignee,
  createAttachment,
  createComment,
  deleteAttachment,
  deleteComment,
  deleteTask,
  getAttachmentsByTask,
  getCommentsByTask,
  getTask,
  getTaskAssignees,
  getTaskTags,
  getStatusesByList,
  listTaskResponsesByProject,
  removeTaskAssignee,
  type BackendStatusGroup,
  type AttachmentResponse,
  type CommentResponse,
  type StatusResponse,
  type TaskAssigneeResponse,
  type TaskResponse,
  type TaskTagResponse,
  type TaskUpdateRequest,
  updateTask,
} from "@/lib/task-api";
import {
  mapBackendPriority,
  mapBackendStatusGroup,
  mapFrontendPriorityToBackend,
  pickPrimaryAssignee,
} from "@/lib/dashboard-task-mapper";
import { ApiError, parseErrorMessage } from "@/lib/http";
import { formatTaskPriorityLabel } from "@/lib/task-priority-ui";
import {
  normalizeBackendStatusGroupKey,
  statusBadgeTone,
} from "@/lib/task-status-ui";
import { getCurrentUser, getUserById } from "@/lib/user-api";
import { getProjectById } from "@/lib/project-api";
import { listWorkspaceMembers } from "@/lib/workspace-api";

type TaskDetailPageProps = {
  taskId: string;
};

type CommentItem = {
  id: number;
  userId: number;
  author: string;
  body: string;
  createdAt: string;
  isEdited: boolean;
};

type AttachmentItem = {
  id: number;
  uploadedBy: number;
  uploaderName: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  createdAt: string;
};

type ActivityItem = {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  kind: "system" | "comment";
};

type SubtaskRow = {
  task: TaskResponse;
  assignees: TaskAssigneeResponse[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Chua co";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Chua co";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateCompact(value: string | null | undefined) {
  if (!value) return "Empty";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "Now";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} d`;
  return formatDateTime(value);
}

function withAlpha(color: string | null | undefined, alpha: number) {
  if (!color) return undefined;
  const value = color.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/;
  const longHex = /^#([0-9a-fA-F]{6})$/;

  if (shortHex.test(value)) {
    const [, raw] = value.match(shortHex) ?? [];
    if (!raw) return undefined;
    const expanded = raw
      .split("")
      .map((part) => part + part)
      .join("");
    const r = Number.parseInt(expanded.slice(0, 2), 16);
    const g = Number.parseInt(expanded.slice(2, 4), 16);
    const b = Number.parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (longHex.test(value)) {
    const [, raw] = value.match(longHex) ?? [];
    if (!raw) return undefined;
    const r = Number.parseInt(raw.slice(0, 2), 16);
    const g = Number.parseInt(raw.slice(2, 4), 16);
    const b = Number.parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return undefined;
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toBackendDueDate(value: string) {
  return value ? `${value}T23:59:59` : null;
}

function formatDays(value: number | null | undefined) {
  if (value == null) return "Chua co";
  return `${value} ngay`;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Cannot read file."));
    reader.readAsDataURL(file);
  });
}

function formatBackendGroupLabel(value: string) {
  const key = normalizeBackendStatusGroupKey(value);
  if (key === "to_do") return "To do";
  return key
    .split("_")
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function formatStatusOptionLabel(status: StatusResponse) {
  const rawName = (status as { name?: string | null }).name;
  if (typeof rawName === "string" && rawName.trim()) return rawName.trim();
  return formatBackendGroupLabel(status.statusGroup);
}

function getTaskVisualStatus(task: TaskResponse, statusGroup?: string) {
  if (task.archived) return "Archived";
  if (statusGroup) return formatBackendGroupLabel(statusGroup);
  if (task.completedAt) return "Completed";
  if (task.startDate) return "In progress";
  return "To do";
}

function buildProgress(task: TaskResponse, statusGroup?: string) {
  if (task.archived) return 0;
  const status = statusGroup ? normalizeBackendStatusGroupKey(statusGroup) : "";
  if (status === "completed" || task.completedAt) return 100;
  if (["deploy", "testing", "review"].includes(status)) return 85;
  if (status === "in_progress") return 60;
  if (task.startDate) return 35;
  return 0;
}

function statusGroupToTaskStatus(group?: BackendStatusGroup | string) {
  return mapBackendStatusGroup(String(group ?? ""));
}

function isTaskDone(group?: string, completedAt?: string | null) {
  return (
    normalizeBackendStatusGroupKey(String(group ?? "")) === "completed" ||
    Boolean(completedAt)
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="min-w-0 text-right text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 md:text-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const router = useRouter();
  const parsedTaskId = Number(taskId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const userCacheRef = useRef<Map<number, UserResponse | null>>(new Map());

  const [task, setTask] = useState<TaskResponse | null>(null);
  const [taskTags, setTaskTags] = useState<TaskTagResponse[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskAssigneeResponse[]>(
    [],
  );
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusResponse[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberOption[]
  >([]);
  const [viewer, setViewer] = useState<UserResponse | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [subtaskBusyId, setSubtaskBusyId] = useState<number | null>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [createSubtaskOpen, setCreateSubtaskOpen] = useState(false);

  const currentStatus = useMemo(
    () =>
      statusOptions.find((status) => status.statusId === task?.statusId) ??
      null,
    [statusOptions, task?.statusId],
  );

  const progressValue = useMemo(
    () => (task ? buildProgress(task, currentStatus?.statusGroup) : 0),
    [currentStatus?.statusGroup, task],
  );

  const detailTask = useMemo<DashboardTask | null>(() => {
    if (!task) return null;
    const assigneeRows = taskAssigneeRowsToDisplay(
      taskAssignees,
      userCacheRef.current,
    );
    const primary = pickPrimaryAssignee(taskAssignees, viewer?.userId ?? 0);
    return {
      id: String(task.taskId),
      taskId: task.taskId,
      title: task.title,
      description: task.description ?? "",
      status: statusGroupToTaskStatus(currentStatus?.statusGroup),
      priority: mapBackendPriority(task.priority),
      assignee:
        primary?.fullName?.trim() ||
        primary?.username ||
        viewer?.fullName?.trim() ||
        viewer?.username ||
        "User",
      assigneeAvatar: "/placeholder.svg",
      project: task.projectName?.trim() || `Project #${task.projectId}`,
      projectId: task.projectId,
      list: task.listName?.trim() || `List #${task.listId}`,
      listId: task.listId,
      statusId: task.statusId,
      reporterId: task.reporterId,
      parentTaskId: task.parentTaskId,
      startDate: task.startDate ?? "",
      completedAt: task.completedAt ?? "",
      dueDate: task.dueDate ?? "",
      createdAt: task.createdAt,
      tags: taskTags.map((tag) => tag.tagName),
      taskType: task.taskType,
      timeEstimateDays: task.timeEstimateDays,
      updatedAt: task.updatedAt,
      assigneesDisplay: assigneeRows,
    };
  }, [currentStatus?.statusGroup, task, taskAssignees, taskTags, viewer]);

  const mapCommentItems = useCallback(
    (rows: CommentResponse[]): CommentItem[] =>
      rows
        .filter((row) => !row.isDeleted)
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime(),
        )
        .map((row) => {
          const user = userCacheRef.current.get(row.userId);
          return {
            id: row.commentId,
            userId: row.userId,
            author:
              user?.fullName?.trim() || user?.username || `User #${row.userId}`,
            body: row.content,
            createdAt: row.createdAt,
            isEdited: Boolean(row.isEdited),
          };
        }),
    [],
  );

  const mapAttachmentItems = useCallback(
    (rows: AttachmentResponse[]): AttachmentItem[] =>
      rows
        .slice()
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .map((row) => {
          const user = userCacheRef.current.get(row.uploadedBy);
          return {
            id: row.attachmentId,
            uploadedBy: row.uploadedBy,
            uploaderName:
              user?.fullName?.trim() ||
              user?.username ||
              `User #${row.uploadedBy}`,
            fileName: row.fileName,
            fileUrl: row.fileUrl,
            mimeType: row.mimeType,
            createdAt: row.createdAt,
          };
        }),
    [],
  );

  const completedSubtasksCount = useMemo(
    () =>
      subtasks.filter((item) =>
        isTaskDone(
          statusOptions.find((status) => status.statusId === item.task.statusId)
            ?.statusGroup,
          item.task.completedAt,
        ),
      ).length,
    [statusOptions, subtasks],
  );

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      {
        id: `task-created-${task?.taskId ?? "unknown"}`,
        author:
          userCacheRef.current.get(task?.reporterId ?? -1)?.fullName?.trim() ||
          userCacheRef.current.get(task?.reporterId ?? -1)?.username ||
          "Someone",
        content: `created this task`,
        createdAt: task?.createdAt ?? new Date().toISOString(),
        kind: "system",
      },
      ...subtasks.map((subtask) => ({
        id: `subtask-created-${subtask.task.taskId}`,
        author:
          userCacheRef.current.get(subtask.task.reporterId)?.fullName?.trim() ||
          userCacheRef.current.get(subtask.task.reporterId)?.username ||
          "Someone",
        content: `created subtask: ${subtask.task.title}`,
        createdAt: subtask.task.createdAt,
        kind: "system" as const,
      })),
    ];

    return items.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }, [subtasks, task]);

  const loadWorkspaceMembers = useCallback(
    async (workspaceId: number, knownUserIds: number[]) => {
      const members = await listWorkspaceMembers(workspaceId).catch(() => []);
      const candidateIds = Array.from(
        new Set([...members.map((member) => member.userId), ...knownUserIds]),
      );
      const cache = userCacheRef.current;

      await Promise.all(
        candidateIds.map(async (userId) => {
          if (cache.has(userId)) return;
          try {
            const user = await getUserById(userId);
            cache.set(userId, user);
          } catch {
            cache.set(userId, null);
          }
        }),
      );

      const options: WorkspaceMemberOption[] = candidateIds
        .map((userId) => {
          const user = cache.get(userId);
          return {
            userId,
            displayName:
              user?.fullName?.trim() || user?.username || `User #${userId}`,
            email: user?.email ?? "",
            avatarUrl: user?.avatarUrl ?? null,
          };
        })
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        );

      setWorkspaceMembers(options);
    },
    [],
  );

  const refreshTaskAssignees = useCallback(
    async (currentTask: TaskResponse, currentViewer: UserResponse | null) => {
      const assignees = await getTaskAssignees(currentTask.taskId).catch(
        () => [],
      );
      const cache = userCacheRef.current;

      if (currentViewer) {
        cache.set(currentViewer.userId, currentViewer);
      }

      await Promise.all(
        assignees.map(async (assignee) => {
          if (cache.has(assignee.userId)) return;
          try {
            const user = await getUserById(assignee.userId);
            cache.set(assignee.userId, user);
          } catch {
            cache.set(assignee.userId, null);
          }
        }),
      );

      setTaskAssignees(assignees);
    },
    [],
  );

  const loadSubtasks = useCallback(
    async (currentTask: TaskResponse, currentViewer: UserResponse | null) => {
      const allProjectTasks = await listTaskResponsesByProject(
        currentTask.projectId,
      ).catch(() => []);
      const directSubtasks = allProjectTasks.filter(
        (item) => item.parentTaskId === currentTask.taskId,
      );

      const rows = await Promise.all(
        directSubtasks.map(async (subtask) => ({
          task: subtask,
          assignees: await getTaskAssignees(subtask.taskId).catch(() => []),
        })),
      );

      const cache = userCacheRef.current;
      if (currentViewer) {
        cache.set(currentViewer.userId, currentViewer);
      }

      const candidateUserIds = Array.from(
        new Set(
          rows.flatMap((row) =>
            row.assignees.map((assignee) => assignee.userId),
          ),
        ),
      );

      await Promise.all(
        candidateUserIds.map(async (userId) => {
          if (cache.has(userId)) return;
          try {
            const user = await getUserById(userId);
            cache.set(userId, user);
          } catch {
            cache.set(userId, null);
          }
        }),
      );

      setSubtasks(
        rows.sort((left, right) => {
          const leftPosition = left.task.position ?? Number.MAX_SAFE_INTEGER;
          const rightPosition = right.task.position ?? Number.MAX_SAFE_INTEGER;
          if (leftPosition !== rightPosition)
            return leftPosition - rightPosition;
          return left.task.taskId - right.task.taskId;
        }),
      );
    },
    [],
  );

  const loadTaskDetail = useCallback(async () => {
    if (!Number.isFinite(parsedTaskId) || parsedTaskId <= 0) {
      setError("Task ID khong hop le.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const currentViewer = await getCurrentUser().catch(() => null);
      if (currentViewer) {
        userCacheRef.current.set(currentViewer.userId, currentViewer);
      }

      const loadedTask = await getTask(parsedTaskId);
      const [tags, assignees, statuses, commentRows, attachmentRows] =
        await Promise.all([
          getTaskTags(parsedTaskId).catch(() => []),
          getTaskAssignees(parsedTaskId).catch(() => []),
          getStatusesByList(loadedTask.listId).catch(() => []),
          getCommentsByTask(parsedTaskId).catch(() => []),
          getAttachmentsByTask(parsedTaskId).catch(() => []),
        ]);

      const knownUserIds = Array.from(
        new Set([
          loadedTask.reporterId,
          ...assigneeUserIdsFromRows(assignees),
          ...commentRows.map((item) => item.userId),
          ...attachmentRows.map((item) => item.uploadedBy),
        ]),
      );
      await Promise.all(
        knownUserIds.map(async (userId) => {
          if (userCacheRef.current.has(userId)) return;
          try {
            const user = await getUserById(userId);
            userCacheRef.current.set(userId, user);
          } catch {
            userCacheRef.current.set(userId, null);
          }
        }),
      );

      if (currentViewer) {
        setViewer(currentViewer);
      }

      setTask(loadedTask);
      setTaskTags(tags);
      setTaskAssignees(assignees);
      setComments(mapCommentItems(commentRows));
      setAttachments(mapAttachmentItems(attachmentRows));
      await loadSubtasks(loadedTask, currentViewer);
      setStatusOptions(statuses);
      setTitleDraft(loadedTask.title);
      setDescriptionDraft(loadedTask.description ?? "");
      setDueDateDraft(toDateInputValue(loadedTask.dueDate));

      try {
        const project = await getProjectById(loadedTask.projectId);
        await loadWorkspaceMembers(project.workspaceId, knownUserIds);
      } catch {
        setWorkspaceMembers([]);
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : parseErrorMessage(err) || "Khong tai duoc chi tiet task.";
      setError(message);
      setTask(null);
      setTaskTags([]);
      setTaskAssignees([]);
      setComments([]);
      setAttachments([]);
      setStatusOptions([]);
      setWorkspaceMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    loadSubtasks,
    loadWorkspaceMembers,
    mapAttachmentItems,
    mapCommentItems,
    parsedTaskId,
  ]);

  useEffect(() => {
    void loadTaskDetail();
  }, [loadTaskDetail]);

  useEffect(() => {
    if (!isEditingDescription) return;
    const textarea = descriptionInputRef.current;
    if (!textarea) return;
    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }, [isEditingDescription]);

  useEffect(() => {
    const textarea = commentInputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 52), 180)}px`;
  }, [commentDraft]);

  const persistTask = useCallback(
    async (patch: TaskUpdateRequest, successMessage: string) => {
      if (!task) return;
      setIsSaving(true);
      setError(null);
      setSaveMessage(null);

      try {
        const updated = await updateTask(task.taskId, patch);
        setTask(updated);
        setTitleDraft(updated.title);
        setDescriptionDraft(updated.description ?? "");
        setDueDateDraft(toDateInputValue(updated.dueDate));
        setSaveMessage(successMessage);

        if (patch.listId && patch.listId !== task.listId) {
          const nextStatuses = await getStatusesByList(updated.listId).catch(
            () => [],
          );
          setStatusOptions(nextStatuses);
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong cap nhat duoc task.";
        setError(message);
      } finally {
        setIsSaving(false);
      }
    },
    [task],
  );

  const handleStatusChange = useCallback(
    async (nextStatusId: number) => {
      if (!task) return;
      const nextStatus = statusOptions.find(
        (item) => item.statusId === nextStatusId,
      );
      const nextGroup = normalizeBackendStatusGroupKey(
        nextStatus?.statusGroup ?? "",
      );
      await persistTask(
        {
          statusId: nextStatusId,
          completedAt:
            nextGroup === "completed"
              ? (task.completedAt ?? new Date().toISOString())
              : null,
        },
        "Da cap nhat trang thai task.",
      );
    },
    [persistTask, statusOptions, task],
  );

  const handlePriorityChange = useCallback(
    async (value: string) => {
      await persistTask(
        {
          priority: mapFrontendPriorityToBackend(
            value as DashboardTask["priority"],
          ),
        },
        "Da cap nhat priority.",
      );
    },
    [persistTask],
  );

  const handleDueDateSave = useCallback(async () => {
    await persistTask(
      { dueDate: toBackendDueDate(dueDateDraft) },
      "Da cap nhat due date.",
    );
  }, [dueDateDraft, persistTask]);

  const handleDescriptionSave = useCallback(async () => {
    await persistTask(
      { description: descriptionDraft.trim() || null },
      "Da cap nhat description.",
    );
    setIsEditingDescription(false);
  }, [descriptionDraft, persistTask]);

  const handleDescriptionBlur = useCallback(() => {
    const nextValue = descriptionDraft.trim();
    const currentValue = task?.description?.trim() ?? "";

    if (!nextValue) {
      setDescriptionDraft(task?.description ?? "");
      setIsEditingDescription(false);
      return;
    }

    if (nextValue === currentValue) {
      setIsEditingDescription(false);
      return;
    }

    void handleDescriptionSave();
  }, [descriptionDraft, handleDescriptionSave, task]);

  const handleTitleSave = useCallback(async () => {
    if (!titleDraft.trim()) return;
    await persistTask(
      { title: titleDraft.trim() },
      "Da cap nhat tieu de task.",
    );
  }, [persistTask, titleDraft]);

  const handleTitleBlur = useCallback(() => {
    const nextValue = titleDraft.trim();
    const currentValue = task?.title?.trim() ?? "";

    if (!nextValue) {
      setTitleDraft(task?.title ?? "");
      return;
    }

    if (nextValue === currentValue) {
      return;
    }

    void handleTitleSave();
  }, [handleTitleSave, task, titleDraft]);

  const handleToggleArchive = useCallback(async () => {
    if (!task) return;
    await persistTask(
      { archived: !task.archived },
      task.archived ? "Da bo luu tru task." : "Da luu tru task.",
    );
  }, [persistTask, task]);

  const handleDeleteTask = useCallback(async () => {
    if (!task || isDeleting) return;
    const confirmed = window.confirm(
      `Xoa task "${task.title}"? Hanh dong nay khong the hoan tac.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteTask(task.taskId);
      router.push("/app/my-tasks");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : parseErrorMessage(err) || "Khong xoa duoc task.";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, router, task]);

  const subtaskCompletionRatioLabel = `${completedSubtasksCount}/${subtasks.length}`;

  const handleSubtaskUpdate = useCallback(
    async (subtaskId: number, patch: TaskUpdateRequest) => {
      if (!task) return;
      setSubtaskBusyId(subtaskId);
      setError(null);
      try {
        await updateTask(subtaskId, patch);
        await loadSubtasks(task, viewer);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong cap nhat duoc subtask.";
        setError(message);
      } finally {
        setSubtaskBusyId(null);
      }
    },
    [loadSubtasks, task, viewer],
  );

  const handleAddSubtaskAssignee = useCallback(
    async (subtaskId: number, userId: number, existingCount: number) => {
      if (!task) return;
      setSubtaskBusyId(subtaskId);
      setError(null);
      try {
        await addTaskAssignee(subtaskId, {
          userId,
          isPrimary: existingCount === 0,
        });
        await loadSubtasks(task, viewer);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong them duoc assignee cho subtask.";
        setError(message);
      } finally {
        setSubtaskBusyId(null);
      }
    },
    [loadSubtasks, task, viewer],
  );

  const handleRemoveSubtaskAssignee = useCallback(
    async (subtaskId: number, userId: number) => {
      if (!task) return;
      setSubtaskBusyId(subtaskId);
      setError(null);
      try {
        await removeTaskAssignee(subtaskId, userId);
        await loadSubtasks(task, viewer);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong xoa duoc assignee cua subtask.";
        setError(message);
      } finally {
        setSubtaskBusyId(null);
      }
    },
    [loadSubtasks, task, viewer],
  );

  const handleAddAssignee = useCallback(
    async (userId: number) => {
      if (!task || !detailTask) return;
      setAssigneeBusy(true);
      setError(null);
      try {
        const isFirstAssignee = taskAssignees.length === 0;
        await addTaskAssignee(task.taskId, {
          userId,
          isPrimary: isFirstAssignee,
        });
        await refreshTaskAssignees(task, viewer);
        setSaveMessage("Da them assignee.");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong them duoc assignee.";
        setError(message);
      } finally {
        setAssigneeBusy(false);
      }
    },
    [detailTask, refreshTaskAssignees, task, taskAssignees.length, viewer],
  );

  const handleRemoveAssignee = useCallback(
    async (userId: number) => {
      if (!task || !detailTask) return;
      setAssigneeBusy(true);
      setError(null);
      try {
        await removeTaskAssignee(task.taskId, userId);
        await refreshTaskAssignees(task, viewer);
        setSaveMessage("Da cap nhat assignee.");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong xoa duoc assignee.";
        setError(message);
      } finally {
        setAssigneeBusy(false);
      }
    },
    [detailTask, refreshTaskAssignees, task, viewer],
  );

  const appendFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !task || !viewer) return;
      setAttachmentBusy(true);
      setError(null);
      try {
        const createdRows = await Promise.all(
          Array.from(files).map(async (file) => {
            const fileUrl = await readFileAsDataUrl(file);
            return createAttachment(task.taskId, {
              uploadedBy: viewer.userId,
              fileName: file.name,
              fileUrl,
              mimeType: file.type || "application/octet-stream",
            });
          }),
        );

        const nextUser = userCacheRef.current.get(viewer.userId) ?? viewer;
        userCacheRef.current.set(viewer.userId, nextUser);
        setAttachments((prev) => [
          ...mapAttachmentItems(createdRows),
          ...prev.filter(
            (existing) =>
              !createdRows.some(
                (created) => created.attachmentId === existing.id,
              ),
          ),
        ]);
        setSaveMessage("Da them attachment.");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Khong them duoc attachment.";
        setError(message);
      } finally {
        setAttachmentBusy(false);
      }
    },
    [mapAttachmentItems, task, viewer],
  );

  const handleDeleteAttachment = useCallback(async (attachmentId: number) => {
    setAttachmentBusy(true);
    setError(null);
    try {
      await deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
      setSaveMessage("Da xoa attachment.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : parseErrorMessage(err) || "Khong xoa duoc attachment.";
      setError(message);
    } finally {
      setAttachmentBusy(false);
    }
  }, []);

  const handleAddComment = useCallback(async () => {
    if (!commentDraft.trim() || !task || !viewer) return;
    setCommentBusy(true);
    setError(null);
    try {
      const created = await createComment(task.taskId, {
        userId: viewer.userId,
        parentCommentId: null,
        content: commentDraft.trim(),
      });
      userCacheRef.current.set(viewer.userId, viewer);
      setComments((prev) => [...prev, ...mapCommentItems([created])]);
      setCommentDraft("");
      setSaveMessage("Da them comment.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : parseErrorMessage(err) || "Khong them duoc comment.";
      setError(message);
    } finally {
      setCommentBusy(false);
    }
  }, [commentDraft, mapCommentItems, task, viewer]);

  const handleDeleteComment = useCallback(async (commentId: number) => {
    setCommentBusy(true);
    setError(null);
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((item) => item.id !== commentId));
      setSaveMessage("Da xoa comment.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : parseErrorMessage(err) || "Khong xoa duoc comment.";
      setError(message);
    } finally {
      setCommentBusy(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8FAFC] p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Task Detail...
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#F8FAFC] p-6">
        <Card className="w-full max-w-lg border-slate-200 p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Not found Task
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error ??
              "Task maybe deleted or you don't have permission to view it."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
            <Button
              className="bg-[#0057B8] hover:bg-[#00489A]"
              onClick={() => router.push("/app/my-tasks")}
            >
              Back to My Tasks
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] p-4 md:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  className="h-8 px-0 text-slate-500 hover:bg-transparent hover:text-slate-800"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>
                    {task.projectName?.trim() || `Project #${task.projectId}`}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                  <span>{task.listName?.trim() || `List #${task.listId}`}</span>
                  <ChevronRight className="h-4 w-4" />
                  <span>Task Detail</span>
                  <Badge
                    variant="outline"
                    className="ml-1 rounded-md border-slate-200 bg-slate-50 text-slate-600"
                  >
                    {task.taskCode ?? `TASK-${task.taskId}`}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-slate-200"
                  onClick={handleToggleArchive}
                  disabled={isSaving}
                >
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  {task.archived ? "Unarchive" : "Archive"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 md:px-8 md:py-8">
            <div className="space-y-4">
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold",
                      statusBadgeTone(currentStatus?.statusGroup ?? "to_do"),
                    )}
                  >
                    {getTaskVisualStatus(task, currentStatus?.statusGroup)}
                  </Badge>
                  {task.archived ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-slate-200 bg-slate-100 text-slate-600"
                    >
                      Archived
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={handleTitleBlur}
                    className="h-auto rounded-xl border border-transparent bg-transparent px-2 py-2 text-3xl font-bold tracking-tight text-slate-950 shadow-none transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:border-slate-200 focus-visible:bg-slate-50 focus-visible:ring-0 md:text-4xl"
                  />
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
                  <div className="space-y-5">
                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                        <span>Status</span>
                      </div>
                      <div className="min-w-0">
                        <Select
                          value={String(task.statusId)}
                          onValueChange={(value) =>
                            void handleStatusChange(Number(value))
                          }
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem
                                key={status.statusId}
                                value={String(status.statusId)}
                              >
                                {formatStatusOptionLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span>Dates</span>
                      </div>
                      <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 rounded-xl px-1 py-1 text-sm text-slate-500">
                        <span className="font-medium text-slate-600">
                          {formatDateCompact(task.createdAt)}
                        </span>
                        <span className="text-slate-300">-&gt;</span>
                        <Input
                          type="date"
                          value={dueDateDraft}
                          onChange={(event) =>
                            setDueDateDraft(event.target.value)
                          }
                          onBlur={() => {
                            if (
                              dueDateDraft !== toDateInputValue(task.dueDate)
                            ) {
                              void handleDueDateSave();
                            }
                          }}
                          className="h-9 w-[140px] rounded-xl border-rose-200 bg-rose-50/40 px-3 text-rose-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <FolderKanban className="h-4 w-4 text-slate-400" />
                        <span>Location</span>
                      </div>
                      <div className="min-h-10 min-w-0 rounded-xl px-1 py-2 text-sm text-slate-500">
                        {task.projectName?.trim() ||
                          `Project #${task.projectId}`}
                        <span className="mx-2 text-slate-300">/</span>
                        {task.listName?.trim() || `List #${task.listId}`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        <span>Assignees</span>
                      </div>
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2">
                        {detailTask ? (
                          <TaskAssigneeCell
                            task={detailTask}
                            members={workspaceMembers}
                            busy={assigneeBusy}
                            onAdd={handleAddAssignee}
                            onRemove={handleRemoveAssignee}
                          />
                        ) : (
                          <div className="px-2 py-1 text-sm text-slate-500">
                            Empty
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <Flag className="h-4 w-4 text-slate-400" />
                        <span>Priority</span>
                      </div>
                      <div className="min-w-0">
                        <Select
                          value={detailTask?.priority ?? "medium"}
                          onValueChange={(value) =>
                            void handlePriorityChange(value)
                          }
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-4">
                      <div className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-900">
                        <Tag className="h-4 w-4 text-slate-400" />
                        <span>Tags</span>
                      </div>
                      <div className="flex min-h-10 min-w-0 flex-wrap gap-2 rounded-xl px-1 py-2 text-sm text-slate-500">
                        {taskTags.length > 0 ? (
                          taskTags.map((tag) => (
                            <Badge
                              key={tag.tagId}
                              variant="outline"
                              className="rounded-md text-xs font-medium"
                              style={{
                                color: tag.tagColor || undefined,
                                borderColor:
                                  withAlpha(tag.tagColor, 0.45) ??
                                  tag.tagColor ??
                                  undefined,
                                backgroundColor:
                                  withAlpha(tag.tagColor, 0.12) ?? undefined,
                              }}
                            >
                              {tag.tagName}
                            </Badge>
                          ))
                        ) : (
                          <span>Empty</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <Section title="Description">
                {isEditingDescription ? (
                  <Textarea
                    ref={descriptionInputRef}
                    value={descriptionDraft}
                    onChange={(event) =>
                      setDescriptionDraft(event.target.value)
                    }
                    onBlur={handleDescriptionBlur}
                    rows={6}
                    className="resize-none border-slate-200 bg-white"
                  />
                ) : !descriptionDraft.trim() ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingDescription(true)}
                    className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-left text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    + Add description
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDescription(true)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left text-sm leading-7 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {descriptionDraft.trim()}
                  </button>
                )}
              </Section>

              <Section
                title="Subtasks"
                action={
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="h-2 w-10 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-400 transition-all"
                          style={{
                            width:
                              subtasks.length > 0
                                ? `${(completedSubtasksCount / subtasks.length) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                      <span>{subtaskCompletionRatioLabel}</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#0057B8] hover:bg-[#00489A]"
                      onClick={() => setCreateSubtaskOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  </div>
                }
              >
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.15fr)_11rem_8rem_9rem] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    <div>Task</div>
                    <div>Assignees</div>
                    <div>Status</div>
                    <div>Priority</div>
                    <div>Due date</div>
                  </div>

                  {subtasks.length === 0 ? (
                    <div className="px-6 py-5 text-sm text-slate-500">
                      Add subtasks to break down your work into smaller,
                      manageable pieces.
                    </div>
                  ) : (
                    subtasks.map((subtaskRow) => {
                      const subtaskStatus = statusOptions.find(
                        (status) =>
                          status.statusId === subtaskRow.task.statusId,
                      );
                      const done = isTaskDone(
                        subtaskStatus?.statusGroup,
                        subtaskRow.task.completedAt,
                      );
                      const subtaskAssigneesDisplay = taskAssigneeRowsToDisplay(
                        subtaskRow.assignees,
                        userCacheRef.current,
                      );
                      const subtaskDashboardTask: DashboardTask = {
                        id: String(subtaskRow.task.taskId),
                        taskId: subtaskRow.task.taskId,
                        title: subtaskRow.task.title,
                        description: subtaskRow.task.description ?? "",
                        status: statusGroupToTaskStatus(subtaskStatus?.statusGroup),
                        priority: mapBackendPriority(subtaskRow.task.priority),
                        assignee:
                          pickPrimaryAssignee(
                            subtaskRow.assignees,
                            viewer?.userId ?? 0,
                          )?.fullName?.trim() ||
                          pickPrimaryAssignee(
                            subtaskRow.assignees,
                            viewer?.userId ?? 0,
                          )?.username ||
                          "",
                        assigneeAvatar: "/placeholder.svg",
                        project:
                          subtaskRow.task.projectName?.trim() ||
                          `Project #${subtaskRow.task.projectId}`,
                        projectId: subtaskRow.task.projectId,
                        list:
                          subtaskRow.task.listName?.trim() ||
                          `List #${subtaskRow.task.listId}`,
                        listId: subtaskRow.task.listId,
                        statusId: subtaskRow.task.statusId,
                        reporterId: subtaskRow.task.reporterId,
                        parentTaskId: subtaskRow.task.parentTaskId,
                        startDate: subtaskRow.task.startDate ?? "",
                        completedAt: subtaskRow.task.completedAt ?? "",
                        dueDate: subtaskRow.task.dueDate ?? "",
                        createdAt: subtaskRow.task.createdAt,
                        tags: [],
                        taskType: subtaskRow.task.taskType,
                        timeEstimateDays: subtaskRow.task.timeEstimateDays,
                        updatedAt: subtaskRow.task.updatedAt,
                        assigneesDisplay: subtaskAssigneesDisplay,
                      };

                      return (
                        <div
                          key={subtaskRow.task.taskId}
                          className="grid w-full grid-cols-[minmax(0,2.2fr)_minmax(0,1.15fr)_11rem_8rem_9rem] gap-4 border-b border-slate-100 px-6 py-4 text-left transition hover:bg-slate-50 last:border-b-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                "h-4 w-4 rounded-full border-2",
                                done
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-slate-300 bg-white",
                              )}
                            />
                            <Input
                              defaultValue={subtaskRow.task.title}
                              disabled={subtaskBusyId === subtaskRow.task.taskId}
                              onBlur={(event) => {
                                const nextTitle = event.target.value.trim();
                                const currentTitle = subtaskRow.task.title.trim();
                                if (!nextTitle) {
                                  void loadSubtasks(task, viewer);
                                  return;
                                }
                                if (nextTitle === currentTitle) return;
                                void handleSubtaskUpdate(subtaskRow.task.taskId, {
                                  title: nextTitle,
                                });
                              }}
                              className="h-9 border-none bg-transparent px-0 text-sm font-medium text-slate-900 shadow-none focus-visible:ring-0"
                            />
                          </div>
                          <div className="flex min-w-0 items-center">
                            <TaskAssigneeCell
                              task={subtaskDashboardTask}
                              members={workspaceMembers}
                              busy={subtaskBusyId === subtaskRow.task.taskId}
                              onAdd={(userId) =>
                                handleAddSubtaskAssignee(
                                  subtaskRow.task.taskId,
                                  userId,
                                  subtaskRow.assignees.length,
                                )
                              }
                              onRemove={(userId) =>
                                handleRemoveSubtaskAssignee(
                                  subtaskRow.task.taskId,
                                  userId,
                                )
                              }
                            />
                          </div>
                          <div className="flex items-center">
                            <Select
                              value={String(subtaskRow.task.statusId)}
                              onValueChange={(value) =>
                                void handleSubtaskUpdate(subtaskRow.task.taskId, {
                                  statusId: Number(value),
                                  completedAt:
                                    normalizeBackendStatusGroupKey(
                                      statusOptions.find(
                                        (status) =>
                                          status.statusId === Number(value),
                                      )?.statusGroup ?? "",
                                    ) === "completed"
                                      ? subtaskRow.task.completedAt ??
                                        new Date().toISOString()
                                      : null,
                                })
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-8 rounded-full border px-3 text-[11px] font-semibold shadow-none",
                                  statusBadgeTone(
                                    subtaskStatus?.statusGroup ?? "to_do",
                                  ),
                                )}
                                disabled={subtaskBusyId === subtaskRow.task.taskId}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem
                                    key={status.statusId}
                                    value={String(status.statusId)}
                                  >
                                    {formatStatusOptionLabel(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-sm text-slate-600">
                            <Select
                              value={mapBackendPriority(subtaskRow.task.priority)}
                              onValueChange={(value) =>
                                void handleSubtaskUpdate(subtaskRow.task.taskId, {
                                  priority: mapFrontendPriorityToBackend(
                                    value as DashboardTask["priority"],
                                  ),
                                })
                              }
                            >
                              <SelectTrigger
                                className="h-8 border-none bg-transparent px-0 text-sm font-medium shadow-none focus:ring-0"
                                disabled={subtaskBusyId === subtaskRow.task.taskId}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-sm text-slate-600">
                            <Input
                              type="date"
                              defaultValue={toDateInputValue(subtaskRow.task.dueDate)}
                              disabled={subtaskBusyId === subtaskRow.task.taskId}
                              onBlur={(event) => {
                                const nextDueDate = toBackendDueDate(
                                  event.target.value,
                                );
                                const currentDueDate = subtaskRow.task.dueDate ?? null;
                                if (nextDueDate === currentDueDate) return;
                                void handleSubtaskUpdate(subtaskRow.task.taskId, {
                                  dueDate: nextDueDate,
                                });
                              }}
                              className="h-8 border-slate-200 bg-slate-50/80 px-2 text-[12px]"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Section>

              <Section title="Attachments">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => appendFiles(event.target.files)}
                />
                <div className="space-y-4">
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-xl border border-dashed px-4 py-5 text-left text-sm transition",
                      fileDragActive
                        ? "border-[#0057B8] bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setFileDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setFileDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setFileDragActive(false);
                      appendFiles(event.dataTransfer.files);
                    }}
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <FileUp className="h-4 w-4" />
                      {attachmentBusy ? "Uploading..." : "Add attachment"}
                    </span>
                    <div className="mt-1 text-xs">
                      Attachments can be files or images. supports any file
                      type. Max size per file: 20MB. You can also drag and drop
                      files here.
                    </div>
                  </button>

                  {attachments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                      No attachments yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="min-w-0">
                            <a
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-medium text-slate-800 hover:text-[#0057B8]"
                            >
                              {attachment.fileName}
                            </a>
                            <div className="text-xs text-slate-500">
                              by {attachment.uploaderName} ·{" "}
                              {formatDateTime(attachment.createdAt)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500"
                            disabled={attachmentBusy}
                            onClick={() =>
                              void handleDeleteAttachment(attachment.id)
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>
          </div>
        </div>
        <div className="min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Activity & People
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Track assignee, comments, and status updates for this task.
              </p>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-5 py-5">
              <div className="space-y-5">
                <Card className="border-slate-200 p-4 shadow-none">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    Assignees
                  </div>
                  {taskAssignees.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No assignees assigned.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {taskAssignees.map((assignee) => {
                        const user = userCacheRef.current.get(assignee.userId);
                        const displayName =
                          user?.fullName?.trim() ||
                          assignee.fullName ||
                          assignee.username;
                        return (
                          <div
                            key={`${assignee.taskId}-${assignee.userId}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-10 w-10 border border-slate-200">
                                <AvatarImage
                                  src={user?.avatarUrl ?? undefined}
                                  alt={displayName}
                                />
                                <AvatarFallback className="bg-slate-100 text-slate-700">
                                  {initials(displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-900">
                                  {displayName}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                  @{assignee.username}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="border-slate-200 bg-slate-50 text-slate-600"
                            >
                              {assignee.isPrimary ? "Primary" : "Assignee"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="border-slate-200 p-4 shadow-none">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    Activity
                  </div>
                  {activityItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No activity yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {activityItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0"
                        >
                          <div className="flex min-w-0 items-center gap-3 text-slate-600">
                            <span className="text-base leading-none text-slate-300">
                              •
                            </span>
                            <span className="truncate">
                              <span className="font-medium text-slate-700">
                                {item.author}
                              </span>{" "}
                              <span className={item.kind === "comment" ? "text-slate-800" : ""}>
                                {item.content}
                              </span>
                            </span>
                          </div>
                          <div className="shrink-0 text-sm text-slate-400">
                            {formatDateTime(item.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="overflow-hidden border-slate-200 p-4 shadow-none">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    Comments
                  </div>
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-500">No comments yet.</p>
                  ) : (
                    <div className="h-[30rem] overflow-hidden">
                      <ScrollArea className="h-full pr-3">
                        <div className="space-y-3">
                          {comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="rounded-2xl border border-slate-200 bg-white"
                            >
                              <div className="px-4 py-3.5">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-9 w-9 border border-slate-200">
                                    <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                                      {initials(comment.author)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm font-semibold text-slate-900">
                                        {comment.author}
                                      </span>
                                      <span className="shrink-0 text-sm text-slate-400">
                                        {formatRelativeTime(comment.createdAt)}
                                      </span>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                                      {comment.body}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </Card>
              </div>
            </ScrollArea>

            <div className="border-t border-slate-200 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Textarea
                  ref={commentInputRef}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleAddComment();
                    }
                  }}
                  placeholder="Write a comment..."
                  className="min-h-[34px] resize-none overflow-hidden border-none bg-transparent px-0 py-0 text-[15px] text-slate-700 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                    {[
                      Sparkles,
                      CircleDotDashed,
                      Paperclip,
                      AtSign,
                      MessageCirclePlus,
                      Bell,
                      Video,
                      MoreHorizontal,
                    ].map((Icon, index) => (
                      <button
                        key={index}
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                    <div className="ml-1 flex items-center gap-1 text-sm text-slate-500">
                      <Bell className="h-4 w-4" />
                      <span>3</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    disabled={commentBusy || !commentDraft.trim()}
                    onClick={() => void handleAddComment()}
                  >
                    {commentBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={createSubtaskOpen}
        onOpenChange={setCreateSubtaskOpen}
        lockedProjectId={task.projectId}
        defaultListId={task.listId}
        parentTaskId={task.taskId}
        onCreated={async () => {
          await loadTaskDetail();
        }}
      />
    </div>
  );
}
