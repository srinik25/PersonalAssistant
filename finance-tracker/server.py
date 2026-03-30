#!/usr/bin/env python3
"""
Finance Tracker local server.
Serves static files on port 8080 + /api/sp500 endpoint (avoids CORS).
"""
import json, threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.request import urlopen, Request
from urllib.error import URLError

PORT = 8080
_sp500_cache = {'data': None, 'ts': 0}
_cache_lock = threading.Lock()

def fetch_sp500():
    import time
    with _cache_lock:
        if _sp500_cache['data'] and time.time() - _sp500_cache['ts'] < 300:
            return _sp500_cache['data']
    url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=ytd'
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    raw = json.loads(urlopen(req, timeout=10).read())
    result = raw['chart']['result'][0]
    meta = result['meta']
    closes = [c for c in result['indicators']['quote'][0]['close'] if c is not None]
    current = meta['regularMarketPrice']
    ytd_start = closes[0]
    high52w = meta['fiftyTwoWeekHigh']
    data = {
        'price': current,
        'ytd_pct': (current - ytd_start) / ytd_start * 100,
        'high52w': high52w,
        'dip_pct': (current - high52w) / high52w * 100,
    }
    import time
    with _cache_lock:
        _sp500_cache['data'] = data
        _sp500_cache['ts'] = time.time()
    return data


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/sp500':
            try:
                data = fetch_sp500()
                body = json.dumps(data).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', len(body))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            super().do_GET()

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    server = HTTPServer(('', PORT), Handler)
    print(f'Finance Tracker running at http://localhost:{PORT}')
    print('Press Ctrl+C to stop.\n')
    server.serve_forever()
