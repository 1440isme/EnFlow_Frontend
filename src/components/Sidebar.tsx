'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Building2,
  Check,
  CheckSquare,
  ChevronDown,
  Folder,
  PlusCircle,
  Settings,
  Users,
} from 'lucide-react';
import { getStoredUserId } from '@/lib/auth-session';
import {
  listWorkspaces,
  listWorkspacesByOwner,
} from '@/lib/workspace-api';
import {
  DEFAULT_WORKSPACE,
  getWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  workspaceResponseToSnapshot,
} from '@/lib/workspace-storage';
import type { WorkspaceSnapshot } from '@/types/workspace';
import type { WorkspaceResponse } from '@/types/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/components/ui/utils';
import CreateWorkspaceDialog from '@/components/CreateWorkspaceDialog';
import WorkspaceSettingsDialog from '@/components/WorkspaceSettingsDialog';

async function fetchWorkspacesForSwitcher(): Promise<WorkspaceResponse[]> {
  try {
    return await listWorkspaces();
  } catch {
    const uid = getStoredUserId();
    if (uid == null) return [];
    return listWorkspacesByOwner(uid);
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  /** Match SSR and first client render so workspace name does not flash after hydration. */
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>(() => ({ ...DEFAULT_WORKSPACE }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceResponse[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  const refreshWorkspace = useCallback(() => {
    setWorkspace({ ...getWorkspaceSnapshot() });
  }, []);

  useEffect(() => {
    refreshWorkspace();
    const onChange = () => refreshWorkspace();
    window.addEventListener('enflow-workspace-changed', onChange);
    return () => window.removeEventListener('enflow-workspace-changed', onChange);
  }, [refreshWorkspace]);

  const loadWorkspaceOptions = useCallback(async () => {
    setWorkspacesLoading(true);
    try {
      const list = await fetchWorkspacesForSwitcher();
      setWorkspaceOptions(list);
    } catch {
      setWorkspaceOptions([]);
    } finally {
      setWorkspacesLoading(false);
    }
  }, []);

  const menuItems = [
    { icon: CheckSquare, label: 'My tasks', path: '/app/my-tasks' },
    { icon: Folder, label: 'Projects', path: '/app/projects' },
    { icon: BarChart2, label: 'Reports', path: '/app/reports' },
    { icon: Users, label: 'Team', path: '/app/team' },
  ];

  const isActive = (path: string) => {
    if (path === '/app/projects') {
      return pathname.startsWith('/app/projects');
    }
    if (path === '/app/reports') {
      return pathname.startsWith('/app/reports');
    }
    return pathname === path;
  };

  const selectWorkspace = (w: WorkspaceResponse) => {
    saveWorkspaceSnapshot(workspaceResponseToSnapshot(w));
    refreshWorkspace();
  };

  const currentId = workspace.workspaceId;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <DropdownMenu
          modal={false}
          onOpenChange={(open) => {
            if (open) void loadWorkspaceOptions();
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-between gap-2 rounded-md px-3 py-3 text-sm font-medium',
                'hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004ba8]/30'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#004ba8]/10">
                  <Building2 className="h-5 w-5 text-[#004ba8]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Workspace
                  </p>
                  <p className="truncate font-semibold text-gray-900">{workspace.name}</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="z-[200] w-56"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onSelect={() => {
                setSettingsOpen(true);
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Workspace settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-gray-500 font-normal px-2 py-1.5">
              Switch workspace
            </DropdownMenuLabel>
            <div className="max-h-48 overflow-y-auto">
              {workspacesLoading ? (
                <div className="px-2 py-2 text-xs text-gray-500">Loading…</div>
              ) : workspaceOptions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-gray-500">No other workspaces.</div>
              ) : (
                workspaceOptions.map((w) => {
                  const active = currentId != null && w.workspaceId === currentId;
                  return (
                    <DropdownMenuItem
                      key={w.workspaceId}
                      onSelect={() => selectWorkspace(w)}
                      className="cursor-pointer"
                    >
                      <span className="mr-2 flex h-4 w-4 items-center justify-center shrink-0">
                        {active ? <Check className="h-4 w-4 text-[#004ba8]" /> : null}
                      </span>
                      <span className="truncate">{w.name}</span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setCreateOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                  ? 'bg-[#e6f0fb] text-[#004ba8] font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              <item.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 mt-auto">
        <Link
          href="/app/projects"
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 bg-[#004ba8] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <div>
            <span className="text-lg font-semibold text-gray-900 block leading-tight">EnFlow</span>
            <span className="text-xs text-gray-500">Task management</span>
          </div>
        </Link>
      </div>

      <WorkspaceSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        snapshot={workspace}
        onSaved={refreshWorkspace}
      />
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshWorkspace}
      />
    </aside>
  );
}
