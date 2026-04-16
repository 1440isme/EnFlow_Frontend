import type { Task } from "@/types/task";

/** Display order for filters/grouping (urgent → low). API values stay `Task['priority']`. */
export const TASK_PRIORITY_DISPLAY_ORDER: Task["priority"][] = [
  "urgent",
  "high",
  "medium",
  "normal",
  "low",
];

const PRIORITY_LABEL_EN: Record<Task["priority"], string> = {
  low: "Low",
  medium: "Medium",
  normal: "Medium",
  high: "High",
  urgent: "Urgent",
};

/**
 * Unified English labels for UI (badges, filters, board, etc.).
 * Backend may return `normal`; mapped to `Medium` like `medium`.
 */
export function formatTaskPriorityLabel(priority: Task["priority"]): string {
  return PRIORITY_LABEL_EN[priority] ?? String(priority);
}
