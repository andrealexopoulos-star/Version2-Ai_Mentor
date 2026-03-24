/**
 * Single source for privileged / master admin check. No hard-coded emails in components.
 * Set REACT_APP_BIQC_MASTER_ADMIN_EMAIL in .env.
 */
const MASTER_ADMIN_EMAIL = (typeof process !== 'undefined' && process.env.REACT_APP_BIQC_MASTER_ADMIN_EMAIL)?.trim?.()?.toLowerCase?.()
  || '';

/**
 * @param {{ email?: string } | null} user - Current user from auth
 * @returns {boolean}
 */
export function isPrivilegedUser(user) {
  if (!user) return false;
  if (!MASTER_ADMIN_EMAIL) return false;
  const email = (user.email || '').trim().toLowerCase();
  return email === MASTER_ADMIN_EMAIL;
}

export { MASTER_ADMIN_EMAIL };
