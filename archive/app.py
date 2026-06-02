"""
AI Video Storyboard - Native Desktop App
Starts internal server, wraps in native window.
Double-click to run. Data saved to ./data/ folder.
Requires: pip install pywebview
"""
import json
import os
import sys
import uuid
import re
import base64
import threading
import http.server
import urllib.parse
from datetime import datetime
import webview

PORT = 18765
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
BLOBS_DIR = os.path.join(DATA_DIR, 'blobs')

# ── File I/O ────────────────────────────────────
def ensure_dirs():
    os.makedirs(BLOBS_DIR, exist_ok=True)

def load_json(path, default=None):
    if default is None: default = []
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fpath(name):
    return os.path.join(DATA_DIR, name)

ensure_dirs()

# ── API Handler ─────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == '/': path = '/storyboard.html'

        # API routes
        m = re.match(r'^/api/projects$', path)
        if m: return self.json(load_json(fpath('projects.json'), []))
        m = re.match(r'^/api/sequences$', path)
        if m: return self.json(load_json(fpath('sequences.json'), []))
        m = re.match(r'^/api/shots$', path)
        if m: return self.json(load_json(fpath('shots.json'), []))
        m = re.match(r'^/api/meta$', path)
        if m: return self.json(load_json(fpath('meta.json'), {}))
        m = re.match(r'^/api/blob/([^/]+)$', path)
        if m: return self.send_blob(m.group(1))

        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = json.loads(self.read_body())

        m = re.match(r'^/api/projects$', path)
        if m:
            p = {'id': str(uuid.uuid4()), 'name': body.get('name',''), 'createdAt': datetime.now().isoformat(), 'updatedAt': datetime.now().isoformat(), 'aiConfig': body.get('aiConfig',{})}
            items = load_json(fpath('projects.json'), []); items.append(p); save_json(fpath('projects.json'), items)
            return self.json(p, 201)

        m = re.match(r'^/api/sequences$', path)
        if m:
            s = {'id': str(uuid.uuid4()), 'projectId': body.get('projectId',''), 'name': body.get('name',''), 'description': body.get('description',''), 'startTime': body.get('startTime',''), 'endTime': body.get('endTime',''), 'coverBlob': None, 'videoSegments': body.get('videoSegments',[]), 'orderIndex': body.get('orderIndex',0), 'createdAt': datetime.now().isoformat()}
            items = load_json(fpath('sequences.json'), []); items.append(s); save_json(fpath('sequences.json'), items)
            return self.json(s, 201)

        m = re.match(r'^/api/shots$', path)
        if m:
            s = {'id': str(uuid.uuid4()), 'projectId': body.get('projectId',''), 'sequenceId': body.get('sequenceId',''), 'title': body.get('title',''), 'description': body.get('description',''), 'variants': body.get('variants',[]), 'startTime': body.get('startTime',''), 'endTime': body.get('endTime',''), 'duration': body.get('duration',''), 'tags': body.get('tags',[]), 'metadata': body.get('metadata',{}), 'orderIndex': body.get('orderIndex',0), 'createdAt': datetime.now().isoformat()}
            items = load_json(fpath('shots.json'), []); items.append(s); save_json(fpath('shots.json'), items)
            return self.json(s, 201)

        m = re.match(r'^/api/blobs$', path)
        if m:
            ct = self.headers.get('Content-Type','')
            if 'multipart' in ct:
                return self.json([], 201)  # simplified
            return self.json([], 201)

        self.send_error(404)

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        body = json.loads(self.read_body())

        m = re.match(r'^/api/projects/reorder$', path)
        if m:
            shots = load_json(fpath('shots.json'), [])
            fid, tid = body['fromShotId'], body['toShotId']
            fi = next((i for i,s in enumerate(shots) if s['id']==fid), -1)
            ti = next((i for i,s in enumerate(shots) if s['id']==tid), -1)
            if fi>=0 and ti>=0 and shots[fi].get('sequenceId')==shots[ti].get('sequenceId'):
                sq = [s for s in shots if s.get('sequenceId')==shots[fi]['sequenceId']]
                ot = [s for s in shots if s.get('sequenceId')!=shots[fi]['sequenceId']]
                sf = next(i for i,s in enumerate(sq) if s['id']==fid)
                st = next(i for i,s in enumerate(sq) if s['id']==tid)
                mv = sq.pop(sf); sq.insert(st, mv)
                for i,s in enumerate(sq): s['orderIndex']=i
                save_json(fpath('shots.json'), ot+sq)
            return self.json({'ok':True})

        m = re.match(r'^/api/meta/([^/]+)$', path)
        if m:
            meta = load_json(fpath('meta.json'), {})
            meta[m.group(1)] = body.get('value', body)
            save_json(fpath('meta.json'), meta)
            return self.json({m.group(1): meta[m.group(1)]})

        # Generic update by ID
        for route, file_key in [('/api/projects/', 'projects.json'), ('/api/sequences/', 'sequences.json'), ('/api/shots/', 'shots.json')]:
            m = re.match(f'^{re.escape(route)}([^/]+)$', path)
            if m:
                items = load_json(fpath(file_key), [])
                for i, item in enumerate(items):
                    if item['id'] == m.group(1):
                        items[i] = {**item, **body, 'id': m.group(1)}
                        save_json(fpath(file_key), items)
                        return self.json(items[i])
                return self.json({}, 404)

        self.send_error(404)

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        for route, file_key in [('/api/projects/', 'projects.json'), ('/api/sequences/', 'sequences.json'), ('/api/shots/', 'shots.json')]:
            m = re.match(f'^{re.escape(route)}([^/]+)$', path)
            if m:
                items = load_json(fpath(file_key), [])
                items = [it for it in items if it['id'] != m.group(1)]
                save_json(fpath(file_key), items)
                return self.json({'deleted':True})
        self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length).decode('utf-8') if length else '{}'

    def json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.cors()
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_blob(self, bid):
        path = os.path.join(BLOBS_DIR, bid)
        if os.path.exists(path):
            with open(path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.cors()
            self.send_header('Content-Length', len(data))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404)

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        pass  # silent

# ── Main ────────────────────────────────────────
def start_server():
    server = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
    server.serve_forever()

if __name__ == '__main__':
    ensure_dirs()
    # Start internal server in background thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    # Open native window pointing to the local server
    webview.create_window('AI Video Storyboard', f'http://127.0.0.1:{PORT}',
                          width=1400, height=900, min_size=(900, 600))
    webview.start()
