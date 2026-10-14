"""Serve only Rut IQ public assets, with browser security headers."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import os
import re
import hmac
import hashlib
import time
from http.cookies import SimpleCookie
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parent
CSP = (
    "default-src 'self'; script-src 'self' https://unpkg.com; "
    "style-src 'self' 'unsafe-inline' https://unpkg.com; "
    "img-src 'self' blob: data: https://unpkg.com https://server.arcgisonline.com https://*.tile.openstreetmap.org; "
    "connect-src 'self' https://ddxzyzjsqrnputiibdbi.supabase.co https://nominatim.openstreetmap.org; "
    "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
)
PUBLIC = {'/', '/index.html', '/app.js', '/field-talk.js', '/regions.json', '/state-bounds.json', '/counties-map.json', '/county-neighbors.json', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/rut-iq.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable.png', '/icons/apple-touch-icon.png'}

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json'}
    server_version = 'RutIQ'
    sys_version = ''

    def _session_signature(self, issued):
        password = os.environ.get('RUT_IQ_BETA_PASSWORD', '')
        key = hashlib.sha256(('rut-iq-cookie:' + password).encode()).digest()
        return hmac.new(key, issued.encode(), hashlib.sha256).hexdigest()

    def _beta_authenticated(self):
        if not os.environ.get('RUT_IQ_BETA_PASSWORD'):
            return True
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            issued, signature = cookie['rut_iq_beta'].value.split('.', 1)
            return (issued.isdigit() and 0 <= time.time() - int(issued) < 604800
                    and hmac.compare_digest(signature, self._session_signature(issued)))
        except (KeyError, ValueError):
            return False

    def _login_page(self, failed=False):
        error = '<p style="color:#ffcead">Incorrect password. Try again.</p>' if failed else ''
        body = ('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<meta name="robots" content="noindex,nofollow"><title>Rut IQ Beta</title>'
                '<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#191611;'
                'color:#f6e7d4;font:16px -apple-system,BlinkMacSystemFont,Arial,sans-serif}'
                'main{box-sizing:border-box;width:min(92vw,430px);padding:28px;background:#2b241d;'
                'border:1px solid #655038;border-radius:20px}h1{font-size:32px;margin:7px 0}p{color:#d4c1a6;line-height:1.5}'
                'label{display:block;margin-top:20px}input{width:100%;box-sizing:border-box;padding:15px;'
                'margin-top:8px;border-radius:12px;border:1px solid #806447;background:#17130f;color:#fff;font-size:18px}'
                'button{width:100%;margin-top:18px;padding:16px;border:0;border-radius:12px;'
                'background:#d3ad78;color:#21180e;font-size:17px;font-weight:800}</style>'
                '<main><p>GHOST RIDGE PRESENTS</p><h1>RUT IQ</h1><p>Private beta access</p>'
                + error + '<form method="post" action="/beta-login"><label>Preview password'
                '<input type="password" name="password" autocomplete="current-password" required></label>'
                '<button type="submit">Open Rut IQ</button></form>'
                '<p>Your Rut IQ account sign-in comes next.</p></main></html>')
        data = body.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if urlsplit(self.path).path != '/beta-login' or not os.environ.get('RUT_IQ_BETA_PASSWORD'):
            self.send_error(404)
            return
        size = int(self.headers.get('Content-Length', '0') or '0')
        if size > 512:
            self.send_error(400)
            return
        attempt = parse_qs(self.rfile.read(size).decode('utf-8', 'replace')).get('password', [''])[0]
        if not hmac.compare_digest(attempt, os.environ['RUT_IQ_BETA_PASSWORD']):
            self._login_page(failed=True)
            return
        issued = str(int(time.time()))
        token = issued + '.' + self._session_signature(issued)
        self.send_response(303)
        self.send_header('Location', '/')
        self.send_header('Set-Cookie', 'rut_iq_beta=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send_head(self):
        if not self._beta_authenticated():
            self._login_page()
            return None

        path = unquote(urlsplit(self.path).path)
        if path not in PUBLIC and not re.fullmatch(r'/maps/[A-Za-z0-9_-]+\.json', path):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
        self.send_header('Strict-Transport-Security', 'max-age=31536000')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8000'))), partial(Handler, directory=str(ROOT))).serve_forever()
