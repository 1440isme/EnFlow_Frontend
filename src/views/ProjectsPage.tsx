'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Folder, TrendingUp, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { listTasks } from '@/lib/task-api';
import {
  getProjectsByWorkspace,
  createProject,
  updateProject,
  deleteProject,
  type ProjectResponse,
} from '@/lib/project-api';
import { isTaskCompleted } from '@/lib/overview-task-utils';
import { getWorkspaceSnapshot, saveWorkspaceSnapshot, workspaceResponseToSnapshot } from '@/lib/workspace-storage';
import { getStoredUserId } from '@/lib/auth-session';
import { listWorkspaces, listWorkspacesByOwner } from '@/lib/workspace-api';
import { personalWorkspaceKey } from '@/lib/workspace-keys';

async function resolveWorkspaceId(): Promise<number | null> {
  let wsId = getWorkspaceSnapshot().workspaceId;
  if (wsId) return wsId;
  const userId = getStoredUserId();
  if (!userId) return null;
  try {
    const list = await listWorkspaces();
    const personal = list.find((w) => w.workspaceKey === personalWorkspaceKey(userId)) ?? list[0];
    if (personal) {
      saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
      return personal.workspaceId;
    }
  } catch {
    /* fallback */
  }
  try {
    const list = await listWorkspacesByOwner(userId);
    const personal = list.find((w) => w.workspaceKey === personalWorkspaceKey(userId)) ?? list[0];
    if (personal) {
      saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
      return personal.workspaceId;
    }
  } catch {
    /* no workspace */
  }
  return null;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() =>
    typeof window !== 'undefined' ? getWorkspaceSnapshot().workspaceId : null,
  );

  useEffect(() => {
    const sync = () => setActiveWorkspaceId(getWorkspaceSnapshot().workspaceId);
    sync();
    window.addEventListener('enflow-workspace-changed', sync);
    return () => window.removeEventListener('enflow-workspace-changed', sync);
  }, []);

  const loadProjectsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let wsId = activeWorkspaceId ?? getWorkspaceSnapshot().workspaceId;
      if (!wsId) {
        wsId = await resolveWorkspaceId();
        if (wsId != null) {
          setActiveWorkspaceId(wsId);
        }
      }

      const [projects, t] = await Promise.all([
        wsId ? getProjectsByWorkspace(wsId) : Promise.resolve([]),
        listTasks(),
      ]);

      setProjectList(
        (projects as ProjectResponse[]).map((p) => ({
          id: p.idProject.toString(),
          name: p.name,
          key: p.projectKey ?? '',
          description: p.description ?? '',
          color: '#3b82f6',
          tasksCount: 0,
        })),
      );
      setTasks(t || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load project data.');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void loadProjectsData();
  }, [loadProjectsData]);

  const resetForm = () => {
    setName('');
    setKey('');
    setDescription('');
    setFormError(null);
  };


  const isKeyDuplicate =
    key.trim().length > 0 &&
    projectList.some(
      (p) => p.key.toLowerCase() === key.trim().toLowerCase() && p.id !== editingProject?.id
    );
  const canSubmit = Boolean(name.trim() && key.trim() && !isKeyDuplicate);

  const handleSaveProject = async () => {
    if (!canSubmit) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        projectKey: key.trim().toUpperCase(),
        description: description.trim(),
        isPrivate: false,
        archive: false,
      };

      if (editingProject) {
        const updated = await updateProject(Number(editingProject.id), payload);
        setProjectList((prev) =>
          prev.map((project) =>
            project.id === editingProject.id
              ? {
                ...project,
                name: updated.name,
                key: updated.projectKey ?? project.key,
                description: updated.description || '',
              }
              : project
          )
        );
      } else {
        // read selected/last workspace from local snapshot (client-only)
        let snapshot = getWorkspaceSnapshot();
        let wsId = snapshot.workspaceId;
        if (!wsId) {
          // fallback: try to fetch workspaces by stored user id and pick personal
          const userId = getStoredUserId();
          if (!userId) {
            throw new Error('Workspace or signed-in user not found. Please sign in again.');
          }
          const list = await listWorkspacesByOwner(userId);
          const personal = list.find((w) => w.workspaceKey === personalWorkspaceKey(userId)) ?? list[0];
          if (!personal) {
            throw new Error('No workspace found for this user.');
          }
          // persist snapshot locally for future calls
          saveWorkspaceSnapshot(workspaceResponseToSnapshot(personal));
          snapshot = getWorkspaceSnapshot();
          wsId = snapshot.workspaceId;
        }

        if (!wsId) {
          throw new Error('Workspace ID is missing');
        }

        const created = await createProject(wsId, payload);
        setProjectList((prev) => [
          ...prev,
          {
            id: created.idProject.toString(),
            name: created.name,
            key: created.projectKey ?? key.trim().toUpperCase(),
            description: created.description ?? '',
            color: '#3b82f6',
            tasksCount: 0,
          },
        ]);
      }

      resetForm();
      setEditingProject(null);
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message || 'Failed to save project.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingProject(null);
    setOpen(true);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setKey(project.key);
    setDescription(project.description || '');
    setFormError(null);
    setOpen(true);
  };

  const openDeleteDialog = (project: Project) => {
    setDeleteTarget(project);
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteProject(Number(deleteTarget.id));
      setProjectList((prev) => prev.filter((project) => project.id !== deleteTarget.id));
      setTasks((prev) => prev.filter((task) => task.project !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err?.message || 'Failed to delete project.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    setEditingProject(null);
    setOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center text-gray-600">Loading projects...</Card>
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
          onClick={openCreateDialog}
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
            onClick={openCreateDialog}
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
            const completedTasks = projectTasks.filter((t) => isTaskCompleted(t)).length;
            const progress =
              projectTasks.length > 0
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : 0;

            const dashboardHref = `/app/projects/${encodeURIComponent(project.id)}/dashboard?name=${encodeURIComponent(project.name)}`;

            return (
              <Card
                key={project.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full"
                onClick={() => router.push(dashboardHref)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(dashboardHref);
                  }
                }}
              >
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
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-accent hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004ba8]/30 ml-2 flex-shrink-0"
                          aria-label={`Options for project ${project.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditDialog(project);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openDeleteDialog(project);
                            }}
                            className="cursor-pointer text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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


                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Project Dialog ── */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
          </DialogHeader>

          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}

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
              onClick={handleSaveProject}
              disabled={!canSubmit || submitting}
            >
              <Plus className="w-4 h-4 mr-1" />
              {submitting ? '...' : editingProject ? 'Save Project' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Project Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
              {deleting ? '...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
