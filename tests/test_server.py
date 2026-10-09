import sys
import threading
import unittest
import urllib.request
import urllib.error
from functools import partial
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler, ROOT

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_public_assets_and_headers(self):
        for path in ['/', '/app.js', '/?view=home', '/manifest.webmanifest', '/sw.js', '/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable.png', '/icons/apple-touch-icon.png', '/icons/rut-iq.svg', '/county-neighbors.json']:
            with urllib.request.urlopen(self.base + path) as response:
                self.assertEqual(response.status, 200)
                response.read()
                self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
                self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                self.assertIn("frame-ancestors 'none'", response.headers['Content-Security-Policy'])
                self.assertEqual(response.headers['Referrer-Policy'], 'no-referrer')

    def test_private_files_and_traversal_are_not_served(self):
        for path in ['/server.py', '/.git/config', '/tests/test_server.py', '/maps/', '/maps/../server.py', '/%2e%2e/server.py', '/database/', '/icons/', '/scripts/build_county_neighbors.py']:
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(self.base + path)
            self.assertEqual(error.exception.code, 404)

if __name__ == '__main__':
    unittest.main()
