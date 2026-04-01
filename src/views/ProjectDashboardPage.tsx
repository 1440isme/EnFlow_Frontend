'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
import { getListsByProject } from '@/lib/list-api';
import type { ProjectListResponse } from '@/types/api';

function ProjectDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const nameFromQuery = searchParams.get('name');
  const [activeTab, setActiveTab] = useState('overview');
  const [lists, setLists] = useState<ProjectListResponse[]>([]);
  const [selectedView, setSelectedView] = useState<string>('project');

  useEffect(() => {
    let mounted = true;
    if (projectId) {
      getListsByProject(Number(projectId))
        .then((lData) => {
          if (!mounted) return;
          let parsedLists = [];
          const rawList = lData as any;
          if (Array.isArray(rawList)) {
            parsedLists = rawList;
          } else if (rawList?.content && Array.isArray(rawList.content)) {
            parsedLists = rawList.content;
          } else if (rawList?.data && Array.isArray(rawList.data)) {
            parsedLists = rawList.data;
          } else if (rawList) {
            parsedLists = [rawList];
          }
          setLists(parsedLists);
        })
        .catch(console.error);
    }
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const projectTitle =
    nameFromQuery && nameFromQuery.trim().length > 0
      ? decodeURIComponent(nameFromQuery.trim())
      : `Dự án ${projectId}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-gray-600" asChild>
            <Link href="/app/projects">
              <ArrowLeft className="w-4 h-4" />
              Danh sách dự án
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold text-gray-900">{projectTitle}</h1>
          <p className="text-sm font-mono text-gray-500">ID: {projectId}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedView} onValueChange={setSelectedView}>
          <SelectTrigger className="w-[280px] bg-white">
            <SelectValue placeholder="Chọn vùng tra cứu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{projectTitle} (Toàn dự án)</span>
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
          <OverviewTab />
          <Separator />
          <ProjectReportsSection projectScoped />
        </TabsContent>

        <TabsContent value="list">
          <TaskListTab />
        </TabsContent>

        <TabsContent value="kanban">
          <KanbanBoardTab />
        </TabsContent>

        <TabsContent value="calendar">
          <ProjectCalendarPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProjectDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-gray-600">Đang tải dashboard dự án…</div>
      }
    >
      <ProjectDashboardContent />
    </Suspense>
  );
}
