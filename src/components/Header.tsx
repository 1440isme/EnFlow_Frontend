'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { clearAuthSession } from '@/lib/auth-session';
import { profileInitials } from '@/lib/user-profile';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notification-api';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';
import { ApiError } from '@/lib/http';
import type { NotificationFeedResponse, NotificationResponse } from '@/types/api';
import { cn } from '@/components/ui/utils';

function formatNotifTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true, locale: enUS });
  } catch {
    return '';
  }
}

export default function Header() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [feed, setFeed] = useState<NotificationFeedResponse | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const initials = profileInitials(profile);
  const displayName =
    profile.fullName.trim() || profile.email || 'User';

  const loadNotifications = useCallback(async () => {
    const ws = getWorkspaceSnapshot().workspaceId;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const data = await listNotifications(ws ?? undefined);
      setFeed(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setNotifError('Session expired. Sign in again.');
      } else {
        setNotifError('Could not load notifications.');
      }
      setFeed(null);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const onWs = () => void loadNotifications();
    window.addEventListener('enflow-workspace-changed', onWs);
    return () => window.removeEventListener('enflow-workspace-changed', onWs);
  }, [loadNotifications]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  const handleOpenNotifChange = (open: boolean) => {
    if (open) void loadNotifications();
  };

  const handleClickNotification = async (n: NotificationResponse) => {
    try {
      if (n.readAt == null) {
        await markNotificationRead(n.notificationId);
      }
      setFeed((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unreadCount:
            n.readAt == null ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
          items: prev.items.map((row) =>
            row.notificationId === n.notificationId
              ? { ...row, readAt: row.readAt ?? new Date().toISOString() }
              : row
          ),
        };
      });
      if (n.taskId != null && n.taskId > 0) {
        router.push(`/app/tasks/${n.taskId}`);
      }
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    const ws = getWorkspaceSnapshot().workspaceId;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(ws ?? undefined);
      await loadNotifications();
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  const unread = feed?.unreadCount ?? 0;
  const items = feed?.items ?? [];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-16">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-2xl" />

        <div className="flex items-center gap-3">
          <DropdownMenu onOpenChange={handleOpenNotifChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-700" />
                {unread > 0 ? (
                  <span className="absolute top-1 right-1 min-w-[8px] h-2 px-0.5 bg-red-500 rounded-full" />
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 z-[200]">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                {items.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-[#004ba8] hover:underline disabled:opacity-50"
                    disabled={markingAll || unread === 0}
                    onClick={() => void handleMarkAllRead()}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-y-auto">
                {notifLoading ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-500">Loading…</div>
                ) : notifError ? (
                  <div className="px-3 py-4 text-center text-sm text-red-600">{notifError}</div>
                ) : items.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    No notifications yet.
                  </div>
                ) : (
                  items.map((n) => (
                    <DropdownMenuItem
                      key={n.notificationId}
                      className={cn(
                        'flex cursor-pointer flex-col items-start gap-1 p-4',
                        n.readAt == null && 'bg-blue-50/50'
                      )}
                      onSelect={(e) => {
                        e.preventDefault();
                        void handleClickNotification(n);
                      }}
                    >
                      <div
                        className={cn(
                          'text-sm',
                          n.readAt == null ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
                        )}
                      >
                        {n.title}
                      </div>
                      {n.body ? (
                        <div className="text-sm text-gray-600 line-clamp-2">{n.body}</div>
                      ) : null}
                      <div className="text-xs text-gray-400">
                        {formatNotifTime(n.createdAt)}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg hover:bg-gray-100 p-1 pr-3 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#004ba8] flex items-center justify-center">
                  <span className="text-white font-medium text-sm">{initials}</span>
                </div>
                <span className="hidden md:inline text-sm font-medium text-gray-700 truncate max-w-[140px]">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{displayName}</div>
                  {profile.email ? (
                    <div className="text-sm text-gray-600 font-normal truncate max-w-[200px]">
                      {profile.email}
                    </div>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/account">Account</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
