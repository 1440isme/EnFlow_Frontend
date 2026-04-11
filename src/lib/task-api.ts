import { requestJson, ApiError } from "@/lib/http";
import type { Task } from "@/types/task";
import { getProjectsByWorkspace } from "@/lib/project-api";
import { getWorkspaceSnapshot } from "@/lib/workspace-storage";
import { formatStatusLabel } from "@/lib/task-status-ui";

const FALLBACK_AVATAR = "/placeholder.svg";

export type TaskStatusMeta = { label: string; statusGroup: string; color?: string | null };

function mapBackendPriorityToFrontend(
  priority: BackendTaskPriority,
): Task["priority"] {
  // Backend dùng `normal`, UI dùng `medium`.
  if (priority === "normal") return "medium";
  return priority as Task["priority"];
}

function taskResponseToTask(
  task: TaskResponse,
  statusById: Map<number, TaskStatusMeta>,
): Task {
  const meta = statusById.get(task.statusId);
  return {
    id: String(task.taskId),
    title: task.title,
    description: task.description ?? "",
    status: meta?.label ?? `Status #${task.statusId}`,
    statusGroup: meta?.statusGroup,
    statusColor: meta?.color ?? null,
    statusId: task.statusId,
    listId: task.listId,
    priority: mapBackendPriorityToFrontend(task.priority),
    assignee: "", // enrich qua getTaskAssignees khi cần (vd. Overview)
    assigneeAvatar: FALLBACK_AVATAR,
    project: String(task.projectId), // để match với ProjectsPage
    projectDisplayName: task.projectName?.trim() || undefined,
    dueDate: task.dueDate ?? "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    tags: [],
  };
}

async function buildStatusMetaByIdForListIds(
  listIds: number[],
): Promise<Map<number, TaskStatusMeta>> {
  const uniq = Array.from(new Set(listIds)).filter((id) => Number.isFinite(id));
  const statusResponses = await Promise.all(
    uniq.map(async (listId) => {
      try {
        return await getStatusesByList(listId);
      } catch {
        return [] as StatusResponse[];
      }
    }),
  );

  const byId = new Map<number, TaskStatusMeta>();
  statusResponses.flat().forEach((s) => {
    byId.set(s.statusId, {
      label: formatStatusLabel(s),
      statusGroup: String(s.statusGroup ?? ""),
      color: s.color ?? null,
    });
  });
  return byId;
}

export type BackendTaskPriority = "low" | "normal" | "high" | "urgent";
export type BackendTaskType = "epic" | "story" | "task" | "bug" | "subtask";
export type BackendStatusGroup =
  | "idea"
  | "backlog"
  | "to_do"
  | "in_progress"
  | "review"
  | "testing"
  | "deploy"
  | "completed";

export type TaskResponse = {
  taskId: number;
  projectId: number;
  projectName?: string | null;
  listId: number;
  listName?: string | null;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string | null;
  title: string;
  description: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  resolution: string | null;
  timeEstimateDays: number | null;
  timeSpentDays: number | null;
  points: number | null;
  position: number | null;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaskUpdateRequest = Partial<{
  listId: number;
  statusId: number;
  parentTaskId: number | null;
  reporterId: number;
  taskCode: string | null;
  title: string;
  description: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  resolution: string | null;
  timeEstimateDays: number | null;
  timeSpentDays: number | null;
  points: number | null;
  position: number | null;
  isPrivate: boolean;
  archived: boolean;
}>;

export type TaskTagResponse = {
  taskId: number;
  tagId: number;
  tagName: string;
  tagColor: string;
};

export type TaskAssigneeResponse = {
  taskId: number;
  userId: number;
  username: string;
  fullName: string;
  email: string;
  isPrimary: boolean;
  assignedAt: string;
};

export type CommentResponse = {
  commentId: number;
  taskId: number;
  userId: number;
  parentCommentId: number | null;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommentCreationRequest = {
  userId: number;
  parentCommentId?: number | null;
  content: string;
};

export type CommentUpdateRequest = {
  content: string;
};

export type AttachmentResponse = {
  attachmentId: number;
  taskId: number;
  uploadedBy: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  createdAt: string;
};

export type AttachmentCreationRequest = {
  uploadedBy: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
};

export type AttachmentUpdateRequest = Partial<{
  fileName: string;
  fileUrl: string;
  mimeType: string;
}>;

export type StatusResponse = {
  statusId: number;
  name: string;
  statusGroup: BackendStatusGroup;
  color: string | null;
  position: number | null;
  isDefault: boolean;
  listId: number;
  projectId: number;
};

export async function getTask(taskId: number): Promise<TaskResponse> {
  return requestJson<TaskResponse>("GET", `/enflow/tasks/${taskId}`, {
    auth: true,
  });
}

// Legacy UI helper expects Task shape (not raw TaskResponse).
export async function getTaskById(taskId: number): Promise<Task> {
  const task = await getTask(taskId);
  const metaMap = await buildStatusMetaByIdForListIds([task.listId]);
  const meta = metaMap.get(task.statusId);
  const fallbackGroup = task.completedAt
    ? "completed"
    : task.startDate
      ? "in_progress"
      : "to_do";
  const fallbackLabel = fallbackGroup.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: String(task.taskId),
    title: task.title,
    description: task.description ?? "",
    status: meta?.label ?? fallbackLabel,
    statusGroup: meta?.statusGroup ?? fallbackGroup,
    statusColor: meta?.color ?? null,
    statusId: task.statusId,
    listId: task.listId,
    priority: mapBackendPriorityToFrontend(task.priority),
    assignee: "User",
    assigneeAvatar: FALLBACK_AVATAR,
    project: String(task.projectId),
    projectDisplayName: task.projectName?.trim() || undefined,
    dueDate: task.dueDate ?? "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    tags: [],
  };
}

export async function getTaskTags(taskId: number): Promise<TaskTagResponse[]> {
  return requestJson<TaskTagResponse[]>(
    "GET",
    `/enflow/task-tags/tasks/${taskId}`,
    {
      auth: true,
    },
  );
}

export async function addTagToTask(
  taskId: number,
  tagId: number,
): Promise<TaskTagResponse> {
  return requestJson<TaskTagResponse>(
    "POST",
    `/enflow/task-tags/tasks/${taskId}`,
    {
      body: { tagId },
      auth: true,
    },
  );
}

export async function removeTagFromTask(
  taskId: number,
  tagId: number,
): Promise<void> {
  await requestJson<void>(
    "DELETE",
    `/enflow/task-tags/tasks/${taskId}/tags/${tagId}`,
    {
      auth: true,
    },
  );
}

export async function getTaskAssignees(
  taskId: number,
): Promise<TaskAssigneeResponse[]> {
  return requestJson<TaskAssigneeResponse[]>(
    "GET",
    `/enflow/task-assignees/tasks/${taskId}`,
    {
      auth: true,
    },
  );
}

export async function getTaskAssigneesBatch(
  taskIds: number[],
): Promise<Record<number, TaskAssigneeResponse[]>> {
  const ids = Array.from(new Set(taskIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (ids.length === 0) return {};
  const raw = await requestJson<Record<string, TaskAssigneeResponse[]>>(
    "POST",
    `/enflow/task-assignees/tasks/batch`,
    {
      auth: true,
      body: ids,
    },
  );
  const out: Record<number, TaskAssigneeResponse[]> = {};
  Object.entries(raw || {}).forEach(([k, v]) => {
    const n = Number(k);
    if (Number.isFinite(n)) out[n] = v ?? [];
  });
  return out;
}

export async function getCommentsByTask(taskId: number): Promise<CommentResponse[]> {
  return requestJson<CommentResponse[]>("GET", `/enflow/comments/tasks/${taskId}`, {
    auth: true,
  });
}

export async function createComment(
  taskId: number,
  body: CommentCreationRequest,
): Promise<CommentResponse> {
  return requestJson<CommentResponse>("POST", `/enflow/comments/tasks/${taskId}`, {
    body,
    auth: true,
  });
}

export async function updateComment(
  commentId: number,
  body: CommentUpdateRequest,
): Promise<CommentResponse> {
  return requestJson<CommentResponse>("PUT", `/enflow/comments/${commentId}`, {
    body,
    auth: true,
  });
}

export async function deleteComment(commentId: number): Promise<void> {
  await requestJson<void>("DELETE", `/enflow/comments/${commentId}`, {
    auth: true,
  });
}

export async function getAttachmentsByTask(taskId: number): Promise<AttachmentResponse[]> {
  return requestJson<AttachmentResponse[]>("GET", `/enflow/attachments/tasks/${taskId}`, {
    auth: true,
  });
}

export async function createAttachment(
  taskId: number,
  body: AttachmentCreationRequest,
): Promise<AttachmentResponse> {
  return requestJson<AttachmentResponse>("POST", `/enflow/attachments/tasks/${taskId}`, {
    body,
    auth: true,
  });
}

export async function updateAttachment(
  attachmentId: number,
  body: AttachmentUpdateRequest,
): Promise<AttachmentResponse> {
  return requestJson<AttachmentResponse>("PUT", `/enflow/attachments/${attachmentId}`, {
    body,
    auth: true,
  });
}

export async function deleteAttachment(attachmentId: number): Promise<void> {
  await requestJson<void>("DELETE", `/enflow/attachments/${attachmentId}`, {
    auth: true,
  });
}

export async function getStatusesByList(
  listId: number,
): Promise<StatusResponse[]> {
  return requestJson<StatusResponse[]>(
    "GET",
    `/enflow/statuses/lists/${listId}`,
    {
      auth: true,
    },
  );
}

export async function getTasksByList(listId: number): Promise<Task[]> {
  const [tasks, statusById] = await Promise.all([
    requestJson<TaskResponse[]>("GET", `/enflow/tasks/lists/${listId}`, {
      auth: true,
    }),
    buildStatusMetaByIdForListIds([listId]),
  ]);

  return (tasks ?? []).map((t) => taskResponseToTask(t, statusById));
}

/** Raw task payloads (mapper DashboardTask / filter). */
export async function listTaskResponsesByProject(
  projectId: number,
): Promise<TaskResponse[]> {
  return requestJson<TaskResponse[]>(
    "GET",
    `/enflow/tasks/projects/${projectId}`,
    { auth: true },
  );
}

export async function listTaskResponsesByList(
  listId: number,
): Promise<TaskResponse[]> {
  return requestJson<TaskResponse[]>("GET", `/enflow/tasks/lists/${listId}`, {
    auth: true,
  });
}

/** Phạm vi tải task thô + bản map UI cho màn báo cáo (tránh gọi API hai lần). */
export type ReportTaskScope =
  | { kind: "project"; projectId: number }
  | { kind: "list"; listId: number }
  | { kind: "workspace" };

export async function fetchTasksForReports(
  scope: ReportTaskScope,
): Promise<{ raw: TaskResponse[]; mapped: Task[] }> {
  let raw: TaskResponse[];
  if (scope.kind === "list") {
    raw = await requestJson<TaskResponse[]>(
      "GET",
      `/enflow/tasks/lists/${scope.listId}`,
      { auth: true },
    );
  } else if (scope.kind === "project") {
    raw = await requestJson<TaskResponse[]>(
      "GET",
      `/enflow/tasks/projects/${scope.projectId}`,
      { auth: true },
    );
  } else {
    const wsId = getWorkspaceSnapshot().workspaceId;
    if (!wsId) {
      return { raw: [], mapped: [] };
    }
    const projects = await getProjectsByWorkspace(wsId).catch(() => []);
    const chunks = await Promise.all(
      projects.map(async (p) => {
        try {
          return await requestJson<TaskResponse[]>(
            "GET",
            `/enflow/tasks/projects/${p.idProject}`,
            { auth: true },
          );
        } catch {
          return [];
        }
      }),
    );
    raw = chunks.flat();
  }

  const list = raw ?? [];
  const statusById = await buildStatusMetaByIdForListIds(list.map((t) => t.listId));
  const mapped = list.map((t) => taskResponseToTask(t, statusById));
  return { raw: list, mapped };
}

export async function listTasks(projectId?: number): Promise<Task[]> {
  if (projectId !== undefined && Number.isFinite(projectId)) {
    const tasks = await requestJson<TaskResponse[]>(
      "GET",
      `/enflow/tasks/projects/${projectId}`,
      {
        auth: true,
      },
    );
    const statusById = await buildStatusMetaByIdForListIds(
      (tasks ?? []).map((t) => t.listId),
    );
    return (tasks ?? []).map((t) => taskResponseToTask(t, statusById));
  }

  // Workspace scope: flatten tasks from all projects in current workspace.
  const wsId = getWorkspaceSnapshot().workspaceId;
  if (!wsId) return [];

  const projects = await getProjectsByWorkspace(wsId).catch(() => []);
  const tasksByProject = await Promise.all(
    projects.map(async (p) => {
      try {
        return await requestJson<TaskResponse[]>(
          "GET",
          `/enflow/tasks/projects/${p.idProject}`,
          {
            auth: true,
          },
        );
      } catch {
        return [];
      }
    }),
  );

  const flatTasks = tasksByProject.flat();
  const statusById = await buildStatusMetaByIdForListIds(
    flatTasks.map((t) => t.listId),
  );
  return flatTasks.map((t) => taskResponseToTask(t, statusById));
}

/** Scoped to tasks in projects that belong to the given workspace (see backend task → project → workspace). */
export async function getTasksAssignedToUser(
  userId: number,
  workspaceId: number,
): Promise<TaskAssigneeResponse[]> {
  const qs = new URLSearchParams({ workspaceId: String(workspaceId) });
  return requestJson<TaskAssigneeResponse[]>(
    "GET",
    `/enflow/task-assignees/users/${userId}?${qs}`,
    {
      auth: true,
    },
  );
}

export async function updateTask(
  taskId: number,
  body: TaskUpdateRequest,
): Promise<TaskResponse> {
  return requestJson<TaskResponse>("PUT", `/enflow/tasks/${taskId}`, {
    body,
    auth: true,
  });
}

export type ProjectListResponse = {
  listProjectId: number;
  name: string;
  description?: string | null;
  position?: number | null;
  isPrivate?: boolean;
  archived?: boolean;
  projectId: number;
};

export type TaskCreationRequest = {
  parentTaskId?: number | null;
  taskCode?: string | null;
  title: string;
  description?: string | null;
  taskType: BackendTaskType;
  priority: BackendTaskPriority;
  reporterId: number;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  resolution?: string | null;
  timeEstimateDays?: number | null;
  timeSpentDays?: number | null;
  points?: number | null;
  position?: number | null;
  isPrivate?: boolean;
  archived?: boolean;
};

export async function getProjectLists(
  projectId: number,
): Promise<ProjectListResponse[]> {
  return requestJson<ProjectListResponse[]>(
    "GET",
    `/enflow/lists/projects/${projectId}`,
    {
      auth: true,
    },
  );
}

export async function createTask(
  projectId: number,
  listId: number,
  statusId: number,
  body: TaskCreationRequest,
): Promise<TaskResponse> {
  return requestJson<TaskResponse>(
    "POST",
    `/enflow/tasks/projects/${projectId}/lists/${listId}/statuses/${statusId}`,
    { body, auth: true },
  );
}

export async function addTaskAssignee(
  taskId: number,
  body: { userId: number; isPrimary: boolean },
): Promise<TaskAssigneeResponse> {
  return requestJson<TaskAssigneeResponse>(
    "POST",
    `/enflow/task-assignees/tasks/${taskId}`,
    {
      body,
      auth: true,
    },
  );
}

export type TaskAssigneeUpdateRequest = {
  isPrimary?: boolean;
};

export async function updateTaskAssignee(
  taskId: number,
  userId: number,
  body: TaskAssigneeUpdateRequest,
): Promise<TaskAssigneeResponse> {
  return requestJson<TaskAssigneeResponse>(
    "PUT",
    `/enflow/task-assignees/tasks/${taskId}/users/${userId}`,
    { body, auth: true },
  );
}

export async function removeTaskAssignee(
  taskId: number,
  userId: number,
): Promise<void> {
  await requestJson<void>(
    "DELETE",
    `/enflow/task-assignees/tasks/${taskId}/users/${userId}`,
    {
      auth: true,
    },
  );
}

export async function deleteTask(taskId: number): Promise<void> {
  await requestJson<void>("DELETE", `/enflow/tasks/${taskId}`, { auth: true });
}

/** Xóa nhiều task; backend chỉ có DELETE từng id — dùng Promise.allSettled. */
export async function deleteTasksByIds(taskIds: number[]): Promise<{
  succeeded: number[];
  failed: { taskId: number; message: string }[];
}> {
  const results = await Promise.allSettled(taskIds.map((id) => deleteTask(id)));
  const succeeded: number[] = [];
  const failed: { taskId: number; message: string }[] = [];
  results.forEach((r, i) => {
    const id = taskIds[i];
    if (r.status === "fulfilled") succeeded.push(id);
    else {
      const reason = r.reason;
      failed.push({
        taskId: id,
        message: reason instanceof ApiError ? reason.message : String(reason),
      });
    }
  });
  return { succeeded, failed };
}
