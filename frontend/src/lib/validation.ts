/**
 * Pure validation functions for auth forms.
 * Shared between frontend pages and property tests.
 */

const MIN_PASSWORD_LENGTH = 8;

/**
 * Validate an email string.
 * Returns an error message if invalid, or null if valid.
 */
export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return "Email is required.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

/**
 * Validate a password string.
 * Returns an error message if invalid, or null if valid.
 * Evaluation order: empty → length → uppercase → digit → special character.
 */
export function validatePassword(password: string): string | null {
  if (!password || password.trim().length === 0) {
    return "Password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Password must be 8 characters or more.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Must include at least one uppercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Must include at least one number.";
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return "Must include at least one special character.";
  }
  return null;
}
