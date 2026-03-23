/**
 * Pure validation functions for auth forms.
 * Shared between frontend pages and property tests.
 */

const MIN_PASSWORD_LENGTH = 6;

/**
 * Validate a password string.
 * Returns an error message if invalid, or null if valid.
 */
export function validatePassword(password: string): string | null {
  if (!password || password.trim().length === 0) {
    return "Password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be at least 6 characters.";
  }
  return null;
}
