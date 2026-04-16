type WorkspaceResponse = { workspaceId: number; name: string; workspaceKey: string };
type UserResponse = { userId: number; email: string; fullName: string; username: string };
type ProjectResponse = { idProject: number; name: string };
type ProjectListResponse = { listProjectId: number; name: string };
type StatusesResponse = { statusId: number; statusGroup: string; name?: string | null };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Nghiệp vụ chính: tạo task và thấy trong My Tasks', () => {
  it('tạo project/list/status bằng API rồi tạo task bằng UI', () => {
    const uniq = Date.now();
    const projectName = `E2E Project ${uniq}`;
    const projectKey = `E2E${String(uniq).slice(-8)}`;
    const listName = `E2E List ${uniq}`;
    const title = `E2E Task ${uniq}`;

    cy.visit('/login');

    cy.loginByApi().then((token) => {
      // 1) Lấy user + workspace personal để tạo data đúng context My Tasks
      cy.request<UserResponse>({
        method: 'GET',
        url: '/enflow/users/me',
        headers: authHeader(token),
      }).then((meRes) => {
        const personalKey = `personal-${meRes.body.userId}`;

        cy.request<WorkspaceResponse[]>({
          method: 'GET',
          url: '/enflow/workspaces',
          headers: authHeader(token),
        }).then((wsRes) => {
          expect(wsRes.body).to.have.length.greaterThan(0);
          const personal = wsRes.body.find((w) => w.workspaceKey === personalKey) ?? wsRes.body[0];
          const workspaceId = personal.workspaceId;

          // 2) Tạo project
          cy.request<ProjectResponse>({
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
          }).then((pRes) => {
            const projectId = pRes.body.idProject;

            // 3) Tạo list
            cy.request<ProjectListResponse>({
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
            }).then((lRes) => {
              const listId = lRes.body.listProjectId;

              // 4) Tạo status tối thiểu để dialog chọn được
              cy.request<StatusesResponse>({
                method: 'POST',
                url: `/enflow/statuses/projects/${projectId}/lists/${listId}`,
                headers: authHeader(token),
                body: {
                  color: '#94a3b8',
                  statusGroup: 'to_do',
                  position: 1,
                  isDefault: true,
                },
              }).then(() => {
                // 5) Tạo task bằng UI trên My Tasks
                cy.visit('/app/my-tasks');
                cy.contains('h1', 'My Tasks').should('be.visible');

                cy.contains('button', 'Create Task').click();
                cy.contains('Create task').should('be.visible');

                cy.get('#shared-create-title').clear().type(title);

                cy.get('#shared-create-project').click();
                cy.contains('[role="option"]', projectName).click();

                cy.get('#shared-create-list').click();
                cy.contains('[role="option"]', listName).click();

                cy.get('#shared-create-status').click();
                cy.contains('[role="option"]', /to do/i).click();

                cy.intercept('POST', '/enflow/tasks/projects/**/lists/**/statuses/**').as('createTask');
                cy.intercept('POST', '/enflow/task-assignees/tasks/**').as('assignTask');

                cy.contains('button', /^Create$/).click();

                cy.wait('@createTask')
                  .its('response.body.taskId')
                  .then((taskId) => {
                    expect(taskId).to.be.a('number');
                    cy.wait('@assignTask');
                    // Đi thẳng trang chi tiết để assert UI chắc chắn theo taskId
                    cy.visit(`/app/tasks/${taskId}`);
                    cy.get('input[class*="text-3xl"]', { timeout: 20000 }).should('have.value', title);
                  });
              });
            });
          });
        });
      });
    });
  });
});

export {};

