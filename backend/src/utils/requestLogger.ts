import { Logger } from './logger';

/**
 * Log request information for debugging (optimized to reduce noise)
 */
export function logRequest(request: Request, info: string = ''): void {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Skip logging for health checks and very frequent requests
  const skipLogging = [
    '/health',
    '/auth/validate'
  ];
  
  if (skipLogging.some(path => pathname === path)) {
    return; // Don't log these frequent requests
  }
  
  // Log only the essential info for most requests
  const method = request.method;
  const shortPath = pathname.length > 50 ? pathname.substring(0, 47) + '...' : pathname;
  
  // Special handling for session interactions (just show session ID pattern)
  if (pathname.includes('/interact')) {
    const sessionMatch = pathname.match(/\/sessions\/([^\/]+)\//);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const shortSessionId = sessionId.substring(0, 8) + '...';
      Logger.info(`${method} /sessions/${shortSessionId}/interact ${info}`, {
        component: 'API',
        operation: 'REQUEST',
        sessionId: sessionId
      });
      return;
    }
  }
  
  Logger.info(`${method} ${shortPath} ${info}`.trim(), {
    component: 'API',
    operation: 'REQUEST'
  });
}
