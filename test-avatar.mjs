import http from 'http';

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

const BASE = { hostname: 'localhost', port: 3001 };

// 1. Login — get token + admin user ID from JWT payload
const loginData = JSON.stringify({ email: 'admin@lumina.bank', password: 'Admin1234!' });
const login = await req({
  ...BASE, path: '/api/v1/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
}, loginData);
const loginParsed = JSON.parse(login.body);
const token = loginParsed.data?.accessToken;
if (!token) { console.error('Login failed:', login.body); process.exit(1); }

// Decode JWT payload (middle section, base64url)
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
const adminId = payload.sub;
console.log('✅ Login OK — admin ID:', adminId);

// 2. Upload a 1×1 PNG using the admin's ID as the agent ID
//    (updateAgent just upserts the profile, so any valid user ID works)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const boundary = 'FormBoundary' + Date.now();
const CRLF = '\r\n';
const formBody = Buffer.concat([
  Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="avatar"; filename="test.png"${CRLF}Content-Type: image/png${CRLF}${CRLF}`),
  png,
  Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
]);

console.log('Uploading 1×1 PNG to Cloudinary...');
const uploadRes = await req({
  ...BASE, path: `/api/v1/admin/agents/${adminId}/avatar`, method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': formBody.length,
  }
}, formBody);

console.log('Status:', uploadRes.status);
const result = JSON.parse(uploadRes.body);
if (result.success) {
  const url = result.data?.avatarUrl;
  console.log('✅ Upload succeeded!');
  console.log('   URL:', url);
  console.log(url?.includes('cloudinary.com')
    ? '✅ Cloudinary CDN confirmed — avatar upload is working perfectly'
    : '❌ Unexpected URL format: ' + url);
} else {
  console.error('❌ Upload failed:', JSON.stringify(result, null, 2));
}
