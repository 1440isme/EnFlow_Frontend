"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  Ellipsis,
  FileUp,
  Filter,
  Flag,
  Link2,
  Plus,
  Search,
  SendHorizonal,
  SmilePlus,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, parseErrorMessage } from "@/lib/http";
import {
  getTask,
  getTaskAssignees,
  getTaskTags,
  type TaskAssigneeResponse,
  type TaskPriority,
  type TaskResponse,
  type TaskTagResponse,
} from "@/lib/task-api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TimelineItem = {
  id: string;
  user: string;
  action: string;
  timestamp: string;
};

const timelineItems: TimelineItem[] = [
  {
    id: "1",
    user: "EnFlow",
    action: "loaded latest task details from the backend",
    timestamp: "Now",
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Chưa có";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Chưa có";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDays(value: number | null | undefined) {
  if (value == null) return "Chưa có";
  return `${value} ngày`;
}

function getPriorityLabel(priority: TaskPriority | null | undefined) {
  switch (priority) {
    case "low":
      return "Thấp";
    case "high":
      return "Cao";
    case "urgent":
      return "Khẩn cấp";
    case "normal":
    default:
      return "Bình thường";
  }
}

function getPriorityClass(priority: TaskPriority | null | undefined) {
  switch (priority) {
    case "low":
      return "bg-slate-100 text-slate-700";
    case "high":
      return "bg-amber-100 text-amber-700";
    case "urgent":
      return "bg-rose-100 text-rose-700";
    case "normal":
    default:
      return "bg-sky-100 text-sky-700";
  }
}

function getStatusLabel(task: TaskResponse | null) {
  if (!task) return "Loading";
  if (task.archived) return "Archived";
  if (task.completedAt) return "Done";
  return "In Progress";
}

function getStatusClass(task: TaskResponse | null) {
  if (!task) {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (task.archived) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (task.completedAt) {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  return "border-sky-200 bg-sky-100 text-sky-700";
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="text-right text-sm font-medium text-slate-800">
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
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#E5E7EB] pt-6">
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

export default function TaskDetailPage({ taskId }: { taskId: string }) {
  const parsedTaskId = Number(taskId);
  const [task, setTask] = useState<TaskResponse | null>(null);
  const [taskTags, setTaskTags] = useState<TaskTagResponse[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskAssigneeResponse[]>(
    [],
  );
  const [comment, setComment] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [fieldRows, setFieldRows] = useState<
    Array<{ id: string; label: string; value: string }>
  >([]);
  const [subtasks, setSubtasks] = useState<
    Array<{ id: string; title: string; done: boolean }>
  >([]);
  const [checklist, setChecklist] = useState<
    Array<{ id: string; title: string; checked: boolean }>
  >([]);
  const [isAddingField, setIsAddingField] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fieldInputRef = useRef<HTMLInputElement | null>(null);
  const subtaskInputRef = useRef<HTMLInputElement | null>(null);
  const checklistInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (task) {
      setFieldRows([
        {
          id: "reporter",
          label: "Reporter ID",
          value: String(task.reporterId ?? "Chưa có"),
        },
        {
          id: "type",
          label: "Task Type",
          value: task.taskType ?? "Chưa có",
        },
        {
          id: "estimate",
          label: "Time Estimate",
          value: formatDays(task.timeEstimateDays),
        },
        {
          id: "points",
          label: "Points",
          value: task.points != null ? String(task.points) : "Chưa có",
        },
      ]);

      setSubtasks(
        task.parentTaskId
          ? [
              {
                id: `parent-${task.parentTaskId}`,
                title: `Liên kết với task cha #${task.parentTaskId}`,
                done: false,
              },
            ]
          : [],
      );
      setChecklist([
        {
          id: "description-check",
          title: "Review task description",
          checked: Boolean(task.description),
        },
      ]);
    }
  }, [task]);

  useEffect(() => {
    if (!Number.isFinite(parsedTaskId) || parsedTaskId <= 0) {
      setError("Task ID không hợp lệ.");
      setIsLoading(false);
      return;
    }

    let ignore = false;

    async function loadTaskDetail() {
      setIsLoading(true);
      setError(null);

      try {
        const [taskData, tagsData, assigneesData] = await Promise.all([
          getTask(parsedTaskId),
          getTaskTags(parsedTaskId),
          getTaskAssignees(parsedTaskId),
        ]);

        if (ignore) return;

        setTask(taskData);
        setTaskTags(tagsData);
        setTaskAssignees(assigneesData);
        setDescriptionDraft(taskData.description ?? "");
      } catch (err) {
        if (ignore) return;
        const message =
          err instanceof ApiError
            ? err.message
            : parseErrorMessage(err) || "Không tải được chi tiết task.";
        setError(message);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadTaskDetail();

    return () => {
      ignore = true;
    };
  }, [parsedTaskId]);

  const primaryAssignee = useMemo(
    () =>
      taskAssignees.find((item) => item.isPrimary) ?? taskAssignees[0] ?? null,
    [taskAssignees],
  );

  useEffect(() => {
    if (isAddingField) {
      fieldInputRef.current?.focus();
    }
  }, [isAddingField]);

  useEffect(() => {
    if (isAddingSubtask) {
      subtaskInputRef.current?.focus();
    }
  }, [isAddingSubtask]);

  useEffect(() => {
    if (isAddingChecklistItem) {
      checklistInputRef.current?.focus();
    }
  }, [isAddingChecklistItem]);

  useEffect(() => {
    if (isEditingDescription) {
      const textarea = descriptionInputRef.current;
      if (!textarea) return;
      textarea.focus();
      const length = textarea.value.length;
      textarea.setSelectionRange(length, length);
    }
  }, [isEditingDescription]);

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const appendFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setAttachments((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const deduped = incoming.filter(
        (file) =>
          !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
      );
      return [...prev, ...deduped];
    });
  };

  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;

    setFieldRows((prev) => [
      ...prev,
      { id: `field-${Date.now()}`, label, value: "Chưa có giá trị" },
    ]);
    setNewFieldLabel("");
    setIsAddingField(false);
  };

  const addSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;

    setSubtasks((prev) => [
      ...prev,
      { id: `subtask-${Date.now()}`, title, done: false },
    ]);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };

  const addChecklistItem = () => {
    const title = newChecklistTitle.trim();
    if (!title) return;

    setChecklist((prev) => [
      ...prev,
      { id: `check-${Date.now()}`, title, checked: false },
    ]);
    setNewChecklistTitle("");
    setIsAddingChecklistItem(false);
  };

  const closeFieldComposer = () => {
    if (newFieldLabel.trim()) {
      addField();
      return;
    }
    setNewFieldLabel("");
    setIsAddingField(false);
  };

  const closeSubtaskComposer = () => {
    if (newSubtaskTitle.trim()) {
      addSubtask();
      return;
    }
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };

  const closeChecklistComposer = () => {
    if (newChecklistTitle.trim()) {
      addChecklistItem();
      return;
    }
    setNewChecklistTitle("");
    setIsAddingChecklistItem(false);
  };

  const closeDescriptionEditor = () => {
    setDescriptionDraft((prev) => prev.trim());
    setIsEditingDescription(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-[#F9FAFB] p-4 md:p-6">
      <div className="mx-auto grid h-full max-w-[1600px] gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <div className="min-h-0 rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="h-full overflow-y-auto">
            <div className="border-b border-[#E5E7EB] px-5 py-4 md:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Project {task?.projectId ?? "--"}</span>
                    <ChevronRight className="h-4 w-4" />
                    <span>Task Detail</span>
                    <Badge
                      variant="outline"
                      className="ml-2 rounded-md border-[#E5E7EB] bg-slate-50 text-slate-600"
                    >
                      {task?.taskCode ?? `TASK-${taskId}`}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="mr-2">
                    Created {task ? formatDate(task.createdAt) : "Loading..."}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-[#E5E7EB] bg-white"
                  >
                    Share
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg border-[#E5E7EB] bg-white"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg border-[#E5E7EB] bg-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-5 py-6 md:px-8 md:py-8">
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                    {isLoading
                      ? "Đang tải task..."
                      : (task?.title ?? "Không có tiêu đề")}
                  </div>
                </div>

                <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                  <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-1">
                      <InfoRow
                        label="Status"
                        value={
                          <Badge
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClass(task)}`}
                          >
                            {getStatusLabel(task)}
                          </Badge>
                        }
                      />
                      <InfoRow
                        label="Dates"
                        icon={<CalendarDays className="h-4 w-4" />}
                        value={
                          task
                            ? `Bắt đầu: ${formatDate(task.startDate)} / Hạn: ${formatDate(task.dueDate)}`
                            : "Đang tải"
                        }
                      />
                      <InfoRow
                        label="Track time"
                        icon={<Clock3 className="h-4 w-4" />}
                        value={
                          task ? formatDays(task.timeSpentDays) : "Đang tải"
                        }
                      />
                      <InfoRow
                        label="Relationships"
                        icon={<Link2 className="h-4 w-4" />}
                        value={
                          task?.parentTaskId
                            ? `Subtask của task #${task.parentTaskId}`
                            : "Task độc lập"
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <InfoRow
                        label="Assignees"
                        value={
                          taskAssignees.length > 0 ? (
                            <div className="flex justify-end -space-x-2">
                              {taskAssignees.map((assignee, index) => (
                                <Avatar
                                  key={`${assignee.taskId}-${assignee.userId}`}
                                  className="h-9 w-9 border-2 border-white shadow-sm"
                                >
                                  <AvatarFallback
                                    className={
                                      assignee.isPrimary || index === 0
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-slate-200 text-slate-700"
                                    }
                                  >
                                    {initials(
                                      assignee.fullName || assignee.username,
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          ) : (
                            "Chưa có assignee"
                          )
                        }
                      />
                      <InfoRow
                        label="Priority"
                        icon={<Flag className="h-4 w-4" />}
                        value={
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${getPriorityClass(task?.priority)}`}
                          >
                            <Flag className="h-3.5 w-3.5" />
                            {getPriorityLabel(task?.priority)}
                          </span>
                        }
                      />
                      <InfoRow
                        label="Tags"
                        value={
                          taskTags.length > 0 ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {taskTags.map((tag) => (
                                <span
                                  key={`${tag.taskId}-${tag.tagId}`}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                                >
                                  {tag.tagName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "Chưa có tag"
                          )
                        }
                      />
                    </div>
                  </div>
                </section>

                <Section title="Description">
                  <div className="rounded-lg px-2 py-2 text-sm text-slate-600">
                    {isEditingDescription ? (
                      <Textarea
                        ref={descriptionInputRef}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        onBlur={closeDescriptionEditor}
                        placeholder="Describe the expected behavior, requirements, design notes, and acceptance criteria..."
                        className="min-h-[120px] rounded-xl border-[#E5E7EB] bg-white text-sm leading-6 text-slate-700 shadow-none focus-visible:ring-0"
                      />
                    ) : descriptionDraft.trim() ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingDescription(true)}
                        className="block w-full text-left"
                      >
                        <p className="whitespace-pre-wrap leading-6 text-slate-700">
                          {descriptionDraft}
                        </p>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingDescription(true)}
                        className="font-medium text-slate-400 transition hover:text-slate-600"
                      >
                        + Add description
                      </button>
                    )}
                  </div>
                </Section>

                <Section title="Fields">
                  <div className="space-y-2">
                    {fieldRows.map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                      >
                        <div className="text-slate-500">{field.label}</div>
                        <div className="font-medium capitalize text-slate-800">
                          {field.value}
                        </div>
                      </div>
                    ))}

                    {isAddingField ? (
                      <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            ref={fieldInputRef}
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            placeholder="Tên field mới"
                            className="bg-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addField();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setNewFieldLabel("");
                                setIsAddingField(false);
                              }
                            }}
                            onBlur={closeFieldComposer}
                          />
                          <Button
                            type="button"
                            className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                            onClick={addField}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setIsAddingField(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add field
                    </button>
                  </div>
                </Section>

                <Section title="Subtasks">
                  <div className="space-y-3">
                    {subtasks.map((subtask) => (
                      <label
                        key={subtask.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          onChange={() =>
                            setSubtasks((prev) =>
                              prev.map((item) =>
                                item.id === subtask.id
                                  ? { ...item, done: !item.done }
                                  : item,
                              ),
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span
                          className={
                            subtask.done
                              ? "text-slate-400 line-through"
                              : "text-slate-700"
                          }
                        >
                          {subtask.title}
                        </span>
                      </label>
                    ))}

                    {isAddingSubtask ? (
                      <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            ref={subtaskInputRef}
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Nhập tên subtask"
                            className="bg-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addSubtask();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setNewSubtaskTitle("");
                                setIsAddingSubtask(false);
                              }
                            }}
                            onBlur={closeSubtaskComposer}
                          />
                          <Button
                            type="button"
                            className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                            onClick={addSubtask}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setIsAddingSubtask(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add subtask
                    </button>
                  </div>
                </Section>

                <Section title="Checklist">
                  <div className="space-y-3">
                    {checklist.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() =>
                            setChecklist((prev) =>
                              prev.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, checked: !entry.checked }
                                  : entry,
                              ),
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span
                          className={
                            item.checked
                              ? "text-slate-400 line-through"
                              : "text-slate-700"
                          }
                        >
                          {item.title}
                        </span>
                      </label>
                    ))}

                    {isAddingChecklistItem ? (
                      <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            ref={checklistInputRef}
                            value={newChecklistTitle}
                            onChange={(e) =>
                              setNewChecklistTitle(e.target.value)
                            }
                            placeholder="Nhập checklist item"
                            className="bg-white"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addChecklistItem();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setNewChecklistTitle("");
                                setIsAddingChecklistItem(false);
                              }
                            }}
                            onBlur={closeChecklistComposer}
                          />
                          <Button
                            type="button"
                            className="bg-[#2563EB] hover:bg-[#1D4ED8]"
                            onClick={addChecklistItem}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setIsAddingChecklistItem(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add checklist item
                    </button>
                  </div>
                </Section>

                {/*
                <Section title="Task Metadata">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Reporter ID
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {task?.reporterId ?? "Chưa có"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Type
                      </div>
                      <div className="mt-1 text-sm font-medium capitalize text-slate-800">
                        {task?.taskType ?? "Chưa có"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Estimate
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {formatDays(task?.timeEstimateDays)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Points
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {task?.points ?? "Chưa có"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Last Updated
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {formatDateTime(task?.updatedAt)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Primary Assignee
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {primaryAssignee?.fullName ?? "Chưa có"}
                      </div>
                    </div>
                  </div>
                </Section>
                */}

                <Section title="Attachment">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => appendFiles(e.target.files)}
                  />
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFiles(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingFiles(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFiles(false);
                        appendFiles(e.dataTransfer.files);
                      }}
                      className={`w-full rounded-xl border border-dashed px-4 py-5 text-left text-sm transition ${
                        isDraggingFiles
                          ? "border-[#7C3AED] bg-violet-50 text-violet-700"
                          : "border-[#E5E7EB] bg-slate-50 text-slate-500"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <FileUp className="h-4 w-4" />
                        Add Attachment
                      </span>
                      <div className="mt-1 text-xs">
                        Kéo file vào đây để upload hoặc bấm để chọn file.
                      </div>
                    </button>

                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">
                                {file.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatFileSize(file.size)}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500"
                              onClick={() =>
                                setAttachments((prev) =>
                                  prev.filter(
                                    (item) =>
                                      !(
                                        item.name === file.name &&
                                        item.size === file.size &&
                                        item.lastModified === file.lastModified
                                      ),
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Section>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="border-b border-[#E5E7EB] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Activity
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-500"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-500"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-slate-500"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {timelineItems.map((item, index) => (
                  <div key={item.id} className="relative pl-11">
                    {index !== timelineItems.length - 1 ? (
                      <div className="absolute left-[15px] top-9 h-[calc(100%+14px)] w-px bg-[#E5E7EB]" />
                    ) : null}
                    <Avatar className="absolute left-0 top-0 h-8 w-8">
                      <AvatarFallback className="bg-slate-100 text-slate-700">
                        {initials(item.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {item.user}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.timestamp}
                        </div>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.action}
                      </p>
                    </div>
                  </div>
                ))}

                {taskAssignees.length > 0 ? (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Assignees
                    </div>
                    <div className="mt-3 space-y-3">
                      {taskAssignees.map((assignee) => (
                        <div
                          key={`${assignee.taskId}-${assignee.userId}-activity`}
                          className="flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-800">
                              {assignee.fullName}
                            </div>
                            <div className="text-xs text-slate-500">
                              @{assignee.username} · {assignee.email}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            {assignee.isPrimary ? "Primary" : "Assignee"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#E5E7EB] p-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[12px] border-none bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <FileUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <SmilePlus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <AtSign className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button className="h-8 rounded-lg bg-[#2563EB] px-3 hover:bg-[#1D4ED8]">
                    <SendHorizonal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
