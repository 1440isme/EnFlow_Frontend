'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTaskPriorityLabel } from '@/lib/task-priority-ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onNewTask={() => setIsNewTaskOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* New Task Dialog */}
      <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo Task mới</DialogTitle>
          </DialogHeader>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Tiêu đề *</Label>
              <Input
                id="task-title"
                placeholder="Nhập tiêu đề task..."
                className="bg-input-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Mô tả</Label>
              <Textarea
                id="task-description"
                placeholder="Mô tả chi tiết về task..."
                rows={4}
                className="bg-input-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-project">Dự án</Label>
                <Select>
                  <SelectTrigger id="task-project" className="bg-input-background">
                    <SelectValue placeholder="Chọn dự án" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website Redesign</SelectItem>
                    <SelectItem value="mobile">Mobile App</SelectItem>
                    <SelectItem value="marketing">Marketing Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-assignee">Người thực hiện</Label>
                <Select>
                  <SelectTrigger id="task-assignee" className="bg-input-background">
                    <SelectValue placeholder="Chọn người thực hiện" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user1">Nguyễn Văn A</SelectItem>
                    <SelectItem value="user2">Trần Thị B</SelectItem>
                    <SelectItem value="user3">Lê Văn C</SelectItem>
                    <SelectItem value="user4">Phạm Thị D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select>
                  <SelectTrigger id="task-priority" className="bg-input-background">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{formatTaskPriorityLabel('low')}</SelectItem>
                    <SelectItem value="medium">{formatTaskPriorityLabel('medium')}</SelectItem>
                    <SelectItem value="high">{formatTaskPriorityLabel('high')}</SelectItem>
                    <SelectItem value="urgent">{formatTaskPriorityLabel('urgent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-duedate">Deadline</Label>
                <Input
                  id="task-duedate"
                  type="date"
                  className="bg-input-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-tags">Tags (phân cách bằng dấu phẩy)</Label>
              <Input
                id="task-tags"
                placeholder="design, ui/ux, frontend"
                className="bg-input-background"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewTaskOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className="bg-[#004ba8] hover:bg-[#003d8a]"
                onClick={(e) => {
                  e.preventDefault();
                  setIsNewTaskOpen(false);
                }}
              >
                Tạo Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
