"""Serve only Rut IQ public assets, with browser security headers."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import os
import re

ROOT = Path(__file__).resolve().parent
CSP = (
    "default-src 'self'; script-src 'self' https://unpkg.com; "
    "style-src 'self' 'unsafe-inline' https://unpkg.com; "
    "img-src 'self' data: https://unpkg.com https://server.arcgisonline.com https://*.tile.openstreetmap.org; "
    "connect-src 'self' https://ddxzyzjsqrnputiibdbi.supabase.co https://nominatim.openstreetmap.org; "
    "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
)
PUBLIC = {'/', '/index.html', '/app.js', '/regions.json', '/state-bounds.json', '/counties-map.json', '/county-neighbors.json', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/rut-iq.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable.png', '/icons/apple-touch-icon.png'}

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json'}
    server_version = 'RutIQ'
    sys_version = ''

    def send_head(self):
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
