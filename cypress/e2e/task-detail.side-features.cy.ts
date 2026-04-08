describe('Task detail: comment + attachment + subtask', () => {
  it('can add a comment, upload/remove attachment, and create a subtask', () => {
    const title = `E2E Task ${Date.now()}`;
    const comment = `E2E comment ${Date.now()}`;

    cy.visit('/login');

    cy.loginByApi().then((token) => {
      cy.ensurePersonalWorkspaceSnapshot(token, 'member');

      cy.seedAssignedTask(token, title).then(({ taskId }) => {
        cy.visit(`/app/tasks/${taskId}`);

        cy.get('input[class*="text-3xl"]', { timeout: 20000 }).should('have.value', title);

        // Add comment
        cy.intercept('POST', `/enflow/comments/tasks/${taskId}`).as('createComment');
        cy.get('textarea[placeholder="Write a comment..."]', { timeout: 20000 })
          .should('not.be.disabled')
          .type(`${comment}{enter}`);
        cy.wait('@createComment');
        cy.contains(comment).should('be.visible');

        // Upload attachment (hidden file input)
        cy.intercept('POST', `/enflow/attachments/tasks/${taskId}`).as('createAttachment');
        cy.get('input[type="file"]').selectFile('cypress/fixtures/example.json', { force: true });
        cy.wait('@createAttachment');
        cy.contains('a', 'example.json', { timeout: 20000 }).scrollIntoView().should('exist');

        // Remove attachment
        cy.intercept('DELETE', '/enflow/attachments/**').as('deleteAttachment');
        cy.contains('a', 'example.json')
          .closest('div.flex.items-center.justify-between')
          .within(() => {
            cy.contains('button', 'Remove').click();
          });
        cy.wait('@deleteAttachment');
        cy.contains('a', 'example.json').should('not.exist');

        // Create subtask
        cy.contains('h2', 'Subtasks').scrollIntoView().should('exist');
        cy.contains('button', 'Add Task').scrollIntoView().click({ force: true });
        cy.get('#shared-create-title', { timeout: 20000 }).should('be.visible');

        const subTitle = `E2E Subtask ${Date.now()}`;
        cy.get('#shared-create-title').clear().type(subTitle);
        cy.intercept('POST', '/enflow/tasks/projects/**/lists/**/statuses/**').as('createSubtask');
        cy.contains('button', /^Create$/).click();
        cy.wait('@createSubtask');
        // Subtask title is rendered inside an <input> (defaultValue), not as plain text.
        cy.get(`input[value="${subTitle}"]`, { timeout: 20000 }).scrollIntoView().should('exist');
      });
    });
  });
});

export {};

