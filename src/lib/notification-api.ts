import { requestJson } from '@/lib/http';
import type { NotificationFeedResponse, NotificationResponse } from '@/types/api';

export async function listNotifications(
  workspaceId?: number | null
): Promise<NotificationFeedResponse> {
  const q =
    workspaceId != null && workspaceId > 0
      ? `?workspaceId=${encodeURIComponent(String(workspaceId))}`
      : '';
  return requestJson<NotificationFeedResponse>('GET', `/enflow/notifications${q}`, {
    auth: true,
  });
}

export async function markNotificationRead(
  notificationId: number
): Promise<NotificationResponse> {
  return requestJson<NotificationResponse>(
    'PATCH',
    `/enflow/notifications/${notificationId}/read`,
    { auth: true }
  );
}

export async function markAllNotificationsRead(
  workspaceId?: number | null
): Promise<void> {
  const q =
    workspaceId != null && workspaceId > 0
      ? `?workspaceId=${encodeURIComponent(String(workspaceId))}`
      : '';
  await requestJson<void>('POST', `/enflow/notifications/read-all${q}`, {
    auth: true,
  });
}
