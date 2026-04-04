/** Đếm subtask trực tiếp (một cấp) theo parentTaskId. */
export function countDirectSubtasksByParentId(
  tasks: readonly { taskId: number; parentTaskId: number | null }[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const t of tasks) {
    const pid = t.parentTaskId;
    if (pid == null) continue;
    map.set(pid, (map.get(pid) ?? 0) + 1);
  }
  return map;
}

export function isRootTaskForListView(parentTaskId: number | null | undefined): boolean {
  return parentTaskId == null;
}
