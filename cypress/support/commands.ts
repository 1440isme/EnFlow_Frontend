type AuthResponse = {
  accessToken: string;
  user: {
    userId: number;
    fullName: string;
    email: string;
  };
};

type UserMeResponse = { userId: number; email: string; fullName: string; username: string };
type WorkspaceResponse = { workspaceId: number; name: string; workspaceKey: string };

type ProjectResponse = { idProject: number; name: string };
type ProjectListResponse = { listProjectId: number; name: string };
type StatusesResponse = { statusId: number; statusGroup: string; name?: string | null };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function setWorkspaceSnapshot(workspace: WorkspaceResponse, roleInWorkspace: string) {
  const snapshot = {
    workspaceId: workspace.workspaceId,
    ownerUserId: null,
    name: workspace.name,
    workspaceKey: workspace.workspaceKey,
    description: '',
    isPrivate: false,
    roleInWorkspace,
  };
  cy.window().then((win) => {
    win.localStorage.setItem('enflow_workspace_snapshot', JSON.stringify(snapshot));
    win.dispatchEvent(new Event('enflow-workspace-changed'));
  });
  return;
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login nhanh qua API của BE (đi qua Next rewrite `/enflow/*`).
       * Set đúng localStorage keys FE đang dùng.
       */
      loginByApi(usernameOrEmail?: string, password?: string): Chainable<string>;

      /**
       * Load workspace personal của user hiện tại và set workspace snapshot + role.
       * Giúp UI bật quyền edit ổn định (My Tasks / Task Detail / Projects...).
       */
      ensurePersonalWorkspaceSnapshot(token: string, roleInWorkspace?: string): Chainable<void>;

      /**
       * Seed minimal data để có 1 task được assign cho chính user hiện tại,
       * kèm statuses tối thiểu (to_do + in_progress).
       */
      seedAssignedTask(
        token: string,
        title: string,
      ): Chainable<{ taskId: number; title: string }>;
    }
  }
}

Cypress.Commands.add('loginByApi', (usernameOrEmail?: string, password?: string) => {
  const u = usernameOrEmail ?? (Cypress.env('E2E_USERNAME') as string | undefined);
  const p = password ?? (Cypress.env('E2E_PASSWORD') as string | undefined);

  if (!u || !p) {
    throw new Error(
      'Thiếu tài khoản E2E. Hãy set env CYPRESS_E2E_USERNAME và CYPRESS_E2E_PASSWORD (hoặc truyền trực tiếp vào cy.loginByApi(username, password)).'
    );
  }

  cy.request<AuthResponse>({
    method: 'POST',
    url: '/enflow/auth/login',
    body: { usernameOrEmail: u, password: p },
    failOnStatusCode: true,
  }).then((res) => {
    const data = res.body;
    expect(data).to.have.property('accessToken');
    expect(data).to.have.nested.property('user.userId');

    return cy
      .window()
      .then((win) => {
        win.localStorage.setItem('enflow_access_token', data.accessToken);
        win.localStorage.setItem('enflow_user_id', String(data.user.userId));
        win.localStorage.setItem(
          'enflow_user_profile',
          JSON.stringify({ fullName: data.user.fullName, email: data.user.email })
        );
      })
      .then(() => data.accessToken);
  });
});

Cypress.Commands.add('ensurePersonalWorkspaceSnapshot', (token: string, roleInWorkspace?: string) => {
  const role = roleInWorkspace ?? 'member';
  return cy
    .request<UserMeResponse>({
      method: 'GET',
      url: '/enflow/users/me',
      headers: authHeader(token),
    })
    .then((meRes) => {
      const personalKey = `personal-${meRes.body.userId}`;
      return cy
        .request<WorkspaceResponse[]>({
          method: 'GET',
          url: '/enflow/workspaces',
          headers: authHeader(token),
        })
        .then((wsRes) => {
          const w = wsRes.body.find((x) => x.workspaceKey === personalKey) ?? wsRes.body[0];
          setWorkspaceSnapshot(w, role);
          return cy.wrap(null).then(() => undefined) as unknown as Cypress.Chainable<void>;
        });
    });
});

Cypress.Commands.add('seedAssignedTask', (token: string, title: string) => {
  const uniq = Date.now();
  const projectName = `E2E Project ${uniq}`;
  const projectKey = `E2E${String(uniq).slice(-8)}`;
  const listName = `E2E List ${uniq}`;

  return cy
    .request<UserMeResponse>({
      method: 'GET',
      url: '/enflow/users/me',
      headers: authHeader(token),
    })
    .then((meRes) => {
      const personalKey = `personal-${meRes.body.userId}`;
      return cy
        .request<WorkspaceResponse[]>({
          method: 'GET',
          url: '/enflow/workspaces',
          headers: authHeader(token),
        })
        .then((wsRes) => {
          const personal =
            wsRes.body.find((w) => w.workspaceKey === personalKey) ?? wsRes.body[0];
          const workspaceId = personal.workspaceId;

          return cy
            .request<ProjectResponse>({
              method: 'POST',
              url: `/enflow/projects/workspaces/${workspaceId}`,
              headers: authHeader(token),
              body: {
                name: projectName,
                projectKey,
                description: 'created by cypress',
                isPrivate: false,
                archive: false,
              },
            })
            .then((pRes) => {
              const projectId = pRes.body.idProject;
              return cy
                .request<ProjectListResponse>({
                  method: 'POST',
                  url: `/enflow/lists/projects/${projectId}`,
                  headers: authHeader(token),
                  body: {
                    name: listName,
                    description: 'created by cypress',
                    position: 1,
                    isPrivate: false,
                    archived: false,
                  },
                })
                .then((lRes) => {
                  const listId = lRes.body.listProjectId;
                  return cy
                    .request<StatusesResponse>({
                      method: 'POST',
                      url: `/enflow/statuses/projects/${projectId}/lists/${listId}`,
                      headers: authHeader(token),
                      body: {
                        color: '#94a3b8',
                        statusGroup: 'to_do',
                        position: 1,
                        isDefault: true,
                      },
                    })
                    .then((todoRes) => {
                      const todoStatusId = todoRes.body.statusId;
                      return cy
                        .request<StatusesResponse>({
                          method: 'POST',
                          url: `/enflow/statuses/projects/${projectId}/lists/${listId}`,
                          headers: authHeader(token),
                          body: {
                            color: '#3b82f6',
                            statusGroup: 'in_progress',
                            position: 2,
                            isDefault: false,
                          },
                        })
                        .then(() => {
                          return cy
                            .request<{ taskId: number }>({
                              method: 'POST',
                              url: `/enflow/tasks/projects/${projectId}/lists/${listId}/statuses/${todoStatusId}`,
                              headers: authHeader(token),
                              body: {
                                title,
                                description: 'created by cypress',
                                taskType: 'task',
                                priority: 'normal',
                                reporterId: meRes.body.userId,
                                archived: false,
                              },
                            })
                            .then((tRes) => {
                              const taskId = tRes.body.taskId;
                              return cy
                                .request({
                                  method: 'POST',
                                  url: `/enflow/task-assignees/tasks/${taskId}`,
                                  headers: authHeader(token),
                                  body: { userId: meRes.body.userId, isPrimary: true },
                                })
                                .then(() => ({ taskId, title }));
                            });
                        });
                    });
                });
            });
        });
    });
});

export {};