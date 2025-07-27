/**
 * Sanitize user input to prevent basic XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Basic sanitization - remove potential script tags and limit length
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .substring(0, 2000) // Limit length
    .trim();
}
