import { Request, Response, NextFunction } from 'express';
import { notifyAdmin } from '../shared/utils/notify-admin';
import { logger } from '../config/logger';

const SKIP_PATHS = new Set(['/health', '/api-docs', '/api-docs.json']);
const SKIP_PREFIXES = ['/uploads'];

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/MSIE|Trident/.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}

function parseDevice(ua: string): string {
  if (/Mobile|Android|iPhone/.test(ua)) return 'Mobile';
  if (/Tablet|iPad/.test(ua)) return 'Tablet';
  return 'Desktop';
}

interface GeoResponse {
  country?: string;
  city?: string;
  isp?: string;
  status?: string;
}

// Extract the real client IP.
// X-Client-IP is set by our Next.js route handler with the visitor's real IP
// (read from Vercel's x-real-ip before Railway's proxy can overwrite it).
// Fall back to CF-Connecting-IP, then the leftmost X-Forwarded-For entry.
function extractClientIp(req: Request): string {
  const clientIp = req.headers['x-client-ip'];
  if (clientIp) return (Array.isArray(clientIp) ? clientIp[0] : clientIp).trim().replace(/^::ffff:/, '');

  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return (Array.isArray(cfIp) ? cfIp[0] : cfIp).trim();

  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }

  return (req.ip ?? '').replace(/^::ffff:/, '');
}

export function visitorMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next();

  const path = req.path;
  if (SKIP_PATHS.has(path) || SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
  if (req.method === 'OPTIONS') return;

  const ip = extractClientIp(req);
  if (!ip || ip === '127.0.0.1' || ip === '::1') return;

  const ua = req.headers['user-agent'] ?? '';
  const browser = parseBrowser(ua);
  const device = parseDevice(ua);

  // Derive the frontend page from the Referer header
  const referer = req.headers['referer'] ?? req.headers['referrer'] ?? '';
  const page = (() => {
    try {
      const p = new URL(String(referer)).pathname;
      return p || path;
    } catch {
      return path;
    }
  })();

  logger.info('[visitor] visit detected', { ip, page, browser, device });

  fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp`)
    .then((r) => r.json() as Promise<GeoResponse>)
    .then((geo) => {
      notifyAdmin({
        type: 'SITE_VISITOR',
        ip,
        country: geo.status === 'success' ? geo.country : undefined,
        city: geo.status === 'success' ? geo.city : undefined,
        isp: geo.status === 'success' ? geo.isp : undefined,
        browser,
        device,
        page,
      });
    })
    .catch(() => {
      notifyAdmin({ type: 'SITE_VISITOR', ip, browser, device, page });
    });
}
