'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from '@/components/dashboard/OverviewTab';
import TaskListTab from '@/components/dashboard/TaskListTab';
import KanbanBoardTab from '@/components/dashboard/KanbanBoardTab';
import ProjectReportsSection from '@/components/dashboard/ProjectReportsSection';
import ProjectCalendarPanel from '@/components/dashboard/ProjectCalendarPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutGrid, List, Columns, Calendar, Folder } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getProjectById, getProjectListsStatuses } from '@/lib/project-api';
import type { ProjectListResponse } from '@/types/api';
import { getWorkspaceSnapshot } from '@/lib/workspace-storage';

function ProjectDashboardContent() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const projectIdNumber = Number(projectId);
  const nameFromQuery = searchParams.get('name');
  const listIdFromQuery = searchParams.get('listId');
  const [activeTab, setActiveTab] = useState('overview');
  const [lists, setLists] = useState<ProjectListResponse[]>([]);

  const selectedListId = listIdFromQuery ? Number(listIdFromQuery) : null;
  const selectedView = selectedListId ? `list-${selectedListId}` : 'project';

  const selectedList = useMemo(
    () => lists.find((list) => list.listProjectId === selectedListId) ?? null,
    [lists, selectedListId]
  );

  const normalizeCollection = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];

    const raw = value as any;
    if (raw?.content && Array.isArray(raw.content)) return raw.content as T[];
    if (raw?.data && Array.isArray(raw.data)) return raw.data as T[];
    if (raw) return [raw as T];
    return [];
  };

  const loadProjectLists = useCallback(async () => {
    if (!projectId) {
      setLists([]);
      return;
    }

    try {
      const response = await getProjectListsStatuses(Number(projectId));
      setLists(normalizeCollection<ProjectListResponse>(response.lists));
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProjectLists();
  }, [loadProjectLists]);

  /** When switching workspace: if this project is not in that workspace, go back to projects. */
  useEffect(() => {
    if (!Number.isFinite(projectIdNumber) || projectIdNumber <= 0) return;

    const verify = async () => {
      const snapWs = getWorkspaceSnapshot().workspaceId;
      if (snapWs == null) return;
      try {
        const p = await getProjectById(projectIdNumber);
        if (p.workspaceId !== snapWs) {
          router.replace('/app/projects');
        }
      } catch {
        router.replace('/app/projects');
      }
    };

    const onWorkspaceChanged = () => {
      void verify();
    };

    window.addEventListener('enflow-workspace-changed', onWorkspaceChanged);
    void verify();
    return () => window.removeEventListener('enflow-workspace-changed', onWorkspaceChanged);
  }, [projectIdNumber, router]);

  useEffect(() => {
    const handleListsChanged = () => {
      void loadProjectLists();
    };

    window.addEventListener('enflow:lists-changed', handleListsChanged);
    return () => {
      window.removeEventListener('enflow:lists-changed', handleListsChanged);
    };
  }, [loadProjectLists]);

  const projectTitle =
    nameFromQuery && nameFromQuery.trim().length > 0
      ? decodeURIComponent(nameFromQuery.trim())
      : `Project ${projectId}`;

  const handleViewChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value === 'project') {
      nextParams.delete('listId');
    } else if (value.startsWith('list-')) {
      nextParams.set('listId', value.replace('list-', ''));
    }

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-gray-900">{projectTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedView} onValueChange={handleViewChange}>
          <SelectTrigger className="w-[280px] bg-white">
            <SelectValue placeholder="Select scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{projectTitle} </span>
              </div>
            </SelectItem>
            {lists.length > 0 && <Separator className="my-2" />}
            {lists.map(list => (
              <SelectItem key={list.listProjectId} value={`list-${list.listProjectId}`}>
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-gray-500" />
                  <span>{list.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-gray-200 h-auto flex flex-wrap gap-1 p-1 justify-start">
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white"
          >
            <LayoutGrid className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white"
          >
            <List className="w-4 h-4" />
            List
          </TabsTrigger>
          <TabsTrigger
            value="kanban"
            className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white"
          >
            <Columns className="w-4 h-4" />
            Board
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <OverviewTab
            projectId={projectIdNumber}
            listId={selectedListId}
            listCount={lists.length}
          />
          <Separator />
          <ProjectReportsSection
            projectId={projectIdNumber}
            listId={selectedListId}
            listCount={lists.length}
          />
        </TabsContent>

        <TabsContent value="list">
          <TaskListTab listId={selectedListId} />
        </TabsContent>

        <TabsContent value="kanban">
          <KanbanBoardTab listId={selectedListId} />
        </TabsContent>

        <TabsContent value="calendar">
          <ProjectCalendarPanel listId={selectedListId} scopeLabel={selectedList ? selectedList.name : projectTitle} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-gray-600">Loading project…</div>
      }
    >
      <ProjectDashboardContent />
    </Suspense>
  );
}
