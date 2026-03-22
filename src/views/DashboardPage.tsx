'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OverviewTab from '@/components/dashboard/OverviewTab';
import TaskListTab from '@/components/dashboard/TaskListTab';
import KanbanBoardTab from '@/components/dashboard/KanbanBoardTab';
import { LayoutGrid, List, Columns } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Tổng quan công việc và dự án của bạn</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white">
            <LayoutGrid className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white">
            <List className="w-4 h-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2 data-[state=active]:bg-[#004ba8] data-[state=active]:text-white">
            <Columns className="w-4 h-4" />
            Kanban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="list">
          <TaskListTab />
        </TabsContent>

        <TabsContent value="kanban">
          <KanbanBoardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
