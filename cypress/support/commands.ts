type AuthResponse = {
  accessToken: string;
  user: {
    userId: number;
    fullName: string;
    email: string;
  };
};

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login nhanh qua API của BE (đi qua Next rewrite `/enflow/*`).
       * Set đúng localStorage keys FE đang dùng.
       */
      loginByApi(usernameOrEmail?: string, password?: string): Chainable<string>;
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

export {};