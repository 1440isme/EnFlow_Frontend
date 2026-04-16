describe('My Tasks: update inline + search', () => {
  it('updates status/priority/due date inline and can search by title', () => {
    const title = `E2E Task ${Date.now()}`;

    cy.visit('/login');

    cy.loginByApi().then((token) => {
      cy.ensurePersonalWorkspaceSnapshot(token, 'owner');

      cy.seedAssignedTask(token, title).then(({ taskId }) => {
        cy.visit('/app/my-tasks');
        cy.contains('h1', 'My Tasks').should('be.visible');

        // Wait for the row to appear.
        cy.contains('a', title, { timeout: 20000 }).scrollIntoView().should('exist');

        cy.intercept('PUT', `/enflow/tasks/${taskId}`).as('updateTask');

        // Scope to row by aria-label (set to task.title).
        cy.get(`[role="row"][aria-label="${title}"]`).within(() => {
          // Change status to "In progress" (label comes from FE formatting).
          cy.contains('button', /to do|to-do|todo/i).click({ force: true });
        });
        cy.contains('[role="menuitem"]', /in progress/i).click();
        cy.wait('@updateTask');

        // Change priority.
        cy.get(`[role="row"][aria-label="${title}"]`).within(() => {
          cy.contains('button', /medium|normal/i).click({ force: true });
        });
        cy.contains('[role="menuitem"]', /high/i).click();
        cy.wait('@updateTask');

        // Change due date (input type="date" is in the row).
        const due = '2099-12-31';
        cy.get(`[role="row"][aria-label="${title}"]`).within(() => {
          cy.get('input[type="date"]').scrollIntoView().clear().type(due, { force: true });
        });
        cy.wait('@updateTask');

        // Search by title (exact).
        cy.get('input[placeholder="Search tasks..."]').clear().type(title);
        cy.get(`[role="row"][aria-label="${title}"]`).scrollIntoView().should('exist');

        // Clear search -> row still exists.
        cy.get('input[placeholder="Search tasks..."]').clear();
        cy.get(`[role="row"][aria-label="${title}"]`).scrollIntoView().should('exist');
      });
    });
  });
});

export {};

