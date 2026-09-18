export interface AuthUser {
  name: string;
  email: string;
  accountId: string;
}

function ldapFromEmail(email: string): string {
  return email.split("@")[0] || process.env.USER || "user";
}

/**
 * Identity for Proto Hub.
 * - Hackathon day: replace with real NetApp SSO / OIDC session lookup.
 * - Until then: uses MOCK_SSO_* if set in .env.local, otherwise your Mac NetApp login (e.g. sb29895).
 */
export function getCurrentUser(): AuthUser {
  const ldap = process.env.USER || "user";
  const email = process.env.MOCK_SSO_EMAIL || `${ldap}@netapp.com`;
  const name = process.env.MOCK_SSO_NAME || ldap;

  return {
    name,
    email,
    accountId: ldapFromEmail(email),
  };
}

export function isOwnPrototype(
  prototype: { authorEmail: string; folderPath?: string },
  user: AuthUser,
): boolean {
  if (prototype.authorEmail.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }

  // Prototypes created before auto-detect used placeholder mock identity.
  const isPlaceholderAuthor =
    prototype.authorEmail === "you@netapp.com" || prototype.authorEmail === "jane@netapp.com";
  if (isPlaceholderAuthor && prototype.folderPath) {
    return prototype.folderPath.includes(`/Users/${user.accountId}/`);
  }

  return false;
}
