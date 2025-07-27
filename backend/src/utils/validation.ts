import { ProfileUpdateRequest } from "../routes/profile";

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return 'session_' + crypto.randomUUID();
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
  return /^session_[a-f0-9-]{36}$/.test(sessionId);
}

/**
 * Check if a string is a valid world ID
 */
export function isValidWorldId(worldId: string): boolean {
  // Allow alphanumeric characters, hyphens, and underscores, case insensitive
  return /^[a-zA-Z0-9_-]+$/.test(worldId) && worldId.length >= 1 && worldId.length <= 50;
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: any,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!obj || !obj[field]) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

/**
 * Supported languages for user profiles
 */
export const SUPPORTED_LANGUAGES = ['English', 'French', 'German', 'Italian', 'Swedish', 'Spanish', 'Portuguese'] as const;

/**
 * Validate the profile update request body
 */
export function validateProfileUpdateRequest(body: ProfileUpdateRequest): string | null {
  if (!body.name && !body.language) {
    return 'At least one field (name or language) must be provided';
  }

  if (body.name && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
    return 'Name must be a non-empty string';
  }

  if (body.language && !SUPPORTED_LANGUAGES.includes(body.language as any)) {
    return `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`;
  }

  return null;
}

/**
 * Validate world creation request
 */
export function validateWorldCreationRequest(body: { title?: unknown; description?: unknown }): { error?: string; validatedData?: { title: string; description?: string } } {
  const { title, description } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { error: 'Title is required and must be a non-empty string' };
  }

  if (description && typeof description !== 'string') {
    return { error: 'Description must be a string' };
  }

  return {
    validatedData: {
      title: title.trim(),
      description: description && typeof description === 'string' ? description.trim() : undefined
    }
  };
}
