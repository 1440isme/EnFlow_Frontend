describe('Projects: create → edit → delete (UI)', () => {
  it('creates, edits, and deletes a project', () => {
    const uniq = Date.now();
    const projectName = `E2E Project ${uniq}`;
    const projectKey = `E2E${String(uniq).slice(-8)}`;
    const editedName = `${projectName} edited`;

    cy.visit('/login');

    cy.loginByApi().then((token) => {
      cy.ensurePersonalWorkspaceSnapshot(token, 'owner');

      cy.visit('/app/projects');
      cy.contains('h1', 'Projects').should('be.visible');

      cy.get('#btn-new-project').should('be.enabled').click();
      cy.get('#project-name').clear().type(projectName);
      cy.get('#project-key').clear().type(projectKey);

      cy.intercept('POST', '/enflow/projects/workspaces/**').as('createProject');
      cy.get('#btn-create-project-confirm').click();
      cy.wait('@createProject');

      cy.contains('h3', projectName, { timeout: 20000 }).scrollIntoView().should('exist');

      // Edit via card options menu (aria-label is stable in source).
      cy.get(`[aria-label="Options for project ${projectName}"]`).click();
      cy.contains('[role="menuitem"]', 'Edit').click();
      cy.get('#project-name').clear().type(editedName);

      cy.intercept('PUT', '/enflow/projects/**').as('updateProject');
      cy.get('#btn-create-project-confirm').click();
      cy.wait('@updateProject');

      cy.contains('h3', editedName).scrollIntoView().should('exist');

      // Delete edited project.
      cy.get(`[aria-label="Options for project ${editedName}"]`).click();
      cy.contains('[role="menuitem"]', 'Delete').click();
      cy.contains('button', /^Delete$/).click();

      cy.contains('h3', editedName).should('not.exist');
    });
  });
});

export {};

