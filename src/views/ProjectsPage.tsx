'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Project, Task } from '@/types/task';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Folder, TrendingUp, Plus } from 'lucide-react';
import { listTasks } from '@/lib/task-api';
import { getProjectsByWorkspace, createProject } from '@/lib/project-api';
import { getWorkspaceSnapshot, saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
import { getStoredUserId } from '@/lib/auth-session';
import { listWorkspacesByOwner } from '@/lib/workspace-api';


export default function ProjectsPage() {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    
    // Determine workspace ID directly, rather than waiting for user interaction
    let wsId = getWorkspaceSnapshot().workspaceId;
    if (!wsId) {
       const userId = getStoredUserId();
       if (userId) {
         listWorkspacesByOwner(userId).then(list => {
           const personal = list.find((w) => w.workspaceKey === `personal-${userId}`) ?? list[0];
           if (personal) {
              saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
              wsId = personal.workspaceId;
           }
         }).catch(console.error);
       }
    }

    Promise.all([wsId ? getProjectsByWorkspace(wsId) : Promise.resolve([]), listTasks()])
      .then(([projects, t]) => {
        if (!mounted) return;
        setProjectList((projects as any[]).map(p => ({
            id: p.idProject.toString(),
            name: p.name,
            key: p.projectKey,
            description: p.description || '',
            color: '#3b82f6', // fallback color
            tasksCount: 0
        })) as any[]);
        setTasks(t || []);
      })
      .catch((err) => {
        console.error(err);
        setError(err?.message || 'Lỗi khi tải dữ liệu dự án');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const resetForm = () => {
    setName('');
    setKey('');
    setDescription('');
  };


  const isKeyDuplicate =
    key.trim().length > 0 &&
    projectList.some((p) => p.key.toLowerCase() === key.trim().toLowerCase());
  const canSubmit = name.trim() && key.trim() && !isKeyDuplicate;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      // read selected/last workspace from local snapshot (client-only)
      let snapshot = getWorkspaceSnapshot();
      let wsId = snapshot.workspaceId;
      if (!wsId) {
        // fallback: try to fetch workspaces by stored user id and pick personal
        const userId = getStoredUserId();
        if (!userId) {
          throw new Error('Không tìm thấy workspace hoặc user đã đăng nhập. Vui lòng đăng nhập lại.');
        }
        const list = await listWorkspacesByOwner(userId);
        const personal = list.find((w) => w.workspaceKey === `personal-${userId}`) ?? list[0];
        if (!personal) {
          throw new Error('Không tìm thấy workspace cho user này.');
        }
        // persist snapshot locally for future calls
        saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
        snapshot = getWorkspaceSnapshot();
        wsId = snapshot.workspaceId;
      }

      const payload = {
        name: name.trim(),
        projectKey: key.trim().toUpperCase(),
        description: description.trim(),
        isPrivate: false,
        archive: false,
      };

      if (!wsId) {
         throw new Error('Workspace ID is missing');
      }

      const created = await createProject(wsId, payload);
      setProjectList((prev) => [...prev, {
            id: created.idProject.toString(),
            name: created.name,
            key: created.projectKey,
            description: created.description || '',
            color: '#3b82f6',
            tasksCount: 0
      } as any]);
      resetForm();
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Lỗi khi tạo dự án');
    }
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center text-gray-600">Đang tải dự án...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center text-red-600">{error}</Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Projects</h1>
          <p className="text-gray-600">Select a project to open its dashboard</p>
        </div>

        <Button
          id="btn-new-project"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Project Grid */}
      {projectList.length === 0 ? (
        <Card className="p-12 text-center text-gray-400">
          <Folder className="w-12 h-12 mx-auto opacity-30 mb-2" />
          <p className="mb-3">No projects yet.</p>
          <button
            onClick={() => setOpen(true)}
            className="text-indigo-600 text-2xl font-semibold hover:underline"
          >
            Create your first project →
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectList.map((project) => {
            // match tasks by project id (Task.project stores the project id)
            const projectTasks = tasks.filter((t) => t.project === project.id);
            const completedTasks = projectTasks.filter((t) => t.status === 'completed').length;
            const progress =
              projectTasks.length > 0
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : 0;

            const dashboardHref = `/app/projects/${encodeURIComponent(project.id)}/dashboard?name=${encodeURIComponent(project.name)}`;

            return (
              <Link key={project.id} href={dashboardHref} className="block">
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${project.color}15` }}
                        >
                          <Folder className="w-6 h-6" style={{ color: project.color }} />
                        </div>
                        <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
                          {project.key}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <TrendingUp className="w-4 h-4" />
                        {progress}%
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {project.description || 'No description yet.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">
                          {completedTasks}/{projectTasks.length} tasks
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="flex items-center -space-x-2">
                      {projectTasks.slice(0, 4).map((task, idx) => (
                        <img
                          key={`${task.id}-${idx}`}
                          src={task.assigneeAvatar}
                          alt={task.assignee}
                          className="w-8 h-8 rounded-full border-2 border-white"
                        />
                      ))}
                      {projectTasks.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            +{projectTasks.length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── New Project Dialog ── */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Project
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tên dự án */}
            <div className="space-y-1.5">
              <Label htmlFor="project-name">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder="Ex: EnFlow Phase 2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Project Key */}
            <div className="space-y-1.5">
              <Label htmlFor="project-key">
                Project Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="project-key"
                placeholder="Ex: EFM"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                }}
                className={isKeyDuplicate ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              <p className="text-xs text-gray-400">
                {isKeyDuplicate ? (
                  <span className="text-red-500">Key already exists, please choose a different key.</span>
                ) : (
                  'Uppercase, no accents, up to 10 characters.'
                )}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="project-description">
                Description{' '}
                <span className="text-gray-400 font-normal text-xs"></span>
              </Label>
              <Input
                id="project-description"
                placeholder="Short description of the project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              id="btn-create-project-confirm"
              onClick={handleCreate}
              disabled={!canSubmit}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
