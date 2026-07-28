import { Request, Response, NextFunction } from 'express';
import { notifyAdmin } from '../shared/utils/notify-admin';

const seenIps = new Set<string>();

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
  org?: string; // ipinfo.io returns ASN + org name, e.g. "AS12345 MTN Nigeria"
}

// Extract the real client IP: prefer the leftmost address in X-Forwarded-For
// (always the original client), falling back to CF-Connecting-IP or req.ip.
function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return (Array.isArray(cfIp) ? cfIp[0] : cfIp).trim();
  return (req.ip ?? '').replace(/^::ffff:/, '');
}

export function visitorMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next();

  const path = req.path;
  if (SKIP_PATHS.has(path) || SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
  if (req.method === 'OPTIONS') return;

  const ip = extractClientIp(req);
  if (!ip || ip === '127.0.0.1' || ip === '::1' || seenIps.has(ip)) return;
  seenIps.add(ip);

  const ua = req.headers['user-agent'] ?? '';
  const browser = parseBrowser(ua);
  const device = parseDevice(ua);

  // ipinfo.io has better accuracy for African/emerging-market ISPs than ip-api.com
  fetch(`https://ipinfo.io/${ip}/json`)
    .then((r) => r.json() as Promise<GeoResponse>)
    .then((geo) => {
      notifyAdmin({
        type: 'SITE_VISITOR',
        ip,
        country: geo.country,
        city: geo.city,
        isp: geo.org,
        browser,
        device,
      });
    })
    .catch(() => {
      notifyAdmin({ type: 'SITE_VISITOR', ip, browser, device });
    });
}
