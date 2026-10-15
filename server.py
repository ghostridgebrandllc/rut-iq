"""Serve only Rut IQ public assets, with browser security headers."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs, urlencode
from urllib.request import urlopen
import json
import os
import re

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

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == '/api/address-geocode':
            query = parse_qs(parsed.query).get('q', [''])[0].strip()
            if len(query) < 6 or len(query) > 180:
                return self.send_json(400, {'error': 'Enter a complete street address.'})
            try:
                url = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?' + urlencode({
                    'address': query, 'benchmark': 'Public_AR_Current',
                    'vintage': 'Current_Current', 'format': 'json'})
                with urlopen(url, timeout=9) as response:
                    matches = json.load(response).get('result', {}).get('addressMatches', [])
                result = []
                for match in matches[:5]:
                    coords = match.get('coordinates', {})
                    result.append({'label': match.get('matchedAddress', ''), 'lat': coords.get('y'), 'lon': coords.get('x'), 'approximate': True})
                return self.send_json(200, {'matches': result})
            except Exception:
                return self.send_json(503, {'error': 'Address lookup temporarily unavailable.'})
        return super().do_GET()

    def send_json(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
