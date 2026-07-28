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
  status: string;
  country?: string;
  city?: string;
  isp?: string;
}

export function visitorMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next();

  const path = req.path;
  if (SKIP_PATHS.has(path) || SKIP_PREFIXES.some((p) => path.startsWith(p))) return;
  if (req.method === 'OPTIONS') return;

  const ip = (req.ip ?? '').replace(/^::ffff:/, '');
  if (!ip || ip === '127.0.0.1' || ip === '::1' || seenIps.has(ip)) return;
  seenIps.add(ip);

  const ua = req.headers['user-agent'] ?? '';
  const browser = parseBrowser(ua);
  const device = parseDevice(ua);

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
      });
    })
    .catch(() => {
      notifyAdmin({ type: 'SITE_VISITOR', ip, browser, device });
    });
}
