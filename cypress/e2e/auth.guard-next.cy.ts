describe('Auth guard: /app/** redirects to /login?next=...', () => {
  it('redirects unauthenticated user and allows returning after loginByApi', () => {
    cy.clearLocalStorage();

    cy.visit('/app/projects');
    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('contain', 'next=');
    cy.location('search').should('contain', encodeURIComponent('/app/projects'));

    cy.loginByApi().then(() => {
      cy.visit('/app/projects');
      cy.contains('h1', 'Projects').should('be.visible');
      cy.location('pathname').should('eq', '/app/projects');
    });
  });
});

export {};

