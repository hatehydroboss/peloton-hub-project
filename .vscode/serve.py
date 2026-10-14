"""Local web server for PelotonHub (started by F5 / the "PelotonHub: start server" task).

The site uses JavaScript modules and Firebase, which browsers block on file:// pages,
so it has to be opened through http://. Files are sent with no-cache headers so the
browser never mixes old and new versions while you edit.

Usage: python -u serve.py <folder-to-serve> [port]
"""
import functools
import http.server
import socket
import sys

root = sys.argv[1] if len(sys.argv) > 1 else '.'
port = int(sys.argv[2]) if len(sys.argv) > 2 else 5500

# Already running from an earlier F5? Reuse it.
probe = socket.socket()
try:
    probe.bind(('127.0.0.1', port))
except OSError:
    print(f'Serving HTTP on http://127.0.0.1:{port}/ (already running)', flush=True)
    sys.exit(0)
finally:
    probe.close()


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):   # keep the terminal quiet
        pass


handler = functools.partial(NoCacheHandler, directory=root)
with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
    print(f'Serving HTTP on http://127.0.0.1:{port}/  (folder: {root})  — press Ctrl+C to stop', flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
