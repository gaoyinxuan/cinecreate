#!/usr/bin/env python3
"""
AI Video Storyboard - Local Server with File Persistence
Data stored in ./data/ directory as JSON files + blobs.
No browser IndexedDB dependency — survives restarts, clears, etc.
"""
import http.server
import json
import os
import re
import sys
import uuid
import shutil
import urllib.parse
import io
import base64
from datetime import datetime

PORT = 8765
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
BLOBS_DIR = os.path.join(DATA_DIR, 'blobs')
PROJECTS_FILE = os.path.join(DATA_DIR, 'projects.json')
SEQUENCES_FILE = os.path.join(DATA_DIR, 'sequences.json')
SHOTS_FILE = os.path.join(DATA_DIR, 'shots.json')
META_FILE = os.path.join(DATA_DIR, 'meta.json')

# ── File helpers ──────────────────────────────────
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

def save_blob(blob_id, data):
    path = os.path.join(BLOBS_DIR, blob_id)
    with open(path, 'wb') as f:
        f.write(data)

def load_blob(blob_id):
    path = os.path.join(BLOBS_DIR, blob_id)
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return f.read()
    return None

def delete_blob(blob_id):
    path = os.path.join(BLOBS_DIR, blob_id)
    if os.path.exists(path):
        os.remove(path)

# ── REST API Router ──────────────────────────────
class APIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # Serve storyboard.html as default
        if path == '/' or path == '':
            path = '/storyboard.html'

        # API routes
        route = self.match_route(path, method='GET')
        if route:
            return route(qs)

        # Static files
        if path.endswith('.html') or path.endswith('.js') or path.endswith('.css'):
            return super().do_GET()
        return super().do_GET()

    def do_POST(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body_raw = self.rfile.read(content_len) if content_len else b''
        ct = self.headers.get('Content-Type', '')

        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if 'multipart/form-data' in ct:
            # Parse multipart for file uploads
            body = self.parse_multipart(body_raw, ct)
        elif 'application/json' in ct:
            body = json.loads(body_raw.decode('utf-8'))
        else:
            body = {}

        route = self.match_route(path, method='POST')
        if route:
            return route(body)

        self.send_error(404)

    def do_PUT(self):
        content_len = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_len).decode('utf-8'))
        parsed = urllib.parse.urlparse(self.path)
        route = self.match_route(parsed.path, method='PUT')
        if route:
            return route(body)
        self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        route = self.match_route(parsed.path, method='DELETE')
        if route:
            return route({})
        self.send_error(404)

    def match_route(self, path, method):
        m = None
        # GET routes
        m = re.match(r'^/api/projects$', path)
        if m and method == 'GET': return self.get_projects
        m = re.match(r'^/api/projects/([^/]+)$', path)
        if m and method == 'GET': return lambda _: self.get_project(m.group(1))
        m = re.match(r'^/api/sequences$', path)
        if m and method == 'GET': return self.get_sequences
        m = re.match(r'^/api/shots$', path)
        if m and method == 'GET': return self.get_shots
        m = re.match(r'^/api/meta$', path)
        if m and method == 'GET': return self.get_meta
        m = re.match(r'^/api/blob/([^/]+)$', path)
        if m and method == 'GET': return lambda _: self.get_blob(m.group(1))

        # POST routes
        m = re.match(r'^/api/projects$', path)
        if m and method == 'POST': return self.create_project
        m = re.match(r'^/api/sequences$', path)
        if m and method == 'POST': return self.create_sequence
        m = re.match(r'^/api/shots$', path)
        if m and method == 'POST': return self.create_shot
        m = re.match(r'^/api/blobs$', path)
        if m and method == 'POST': return self.upload_blobs

        # PUT routes
        m = re.match(r'^/api/projects/([^/]+)$', path)
        if m and method == 'PUT': return lambda b: self.update_project(m.group(1), b)
        m = re.match(r'^/api/sequences/([^/]+)$', path)
        if m and method == 'PUT': return lambda b: self.update_sequence(m.group(1), b)
        m = re.match(r'^/api/shots/([^/]+)$', path)
        if m and method == 'PUT': return lambda b: self.update_shot(m.group(1), b)
        m = re.match(r'^/api/meta/([^/]+)$', path)
        if m and method == 'PUT': return lambda b: self.update_meta(m.group(1), b)
        m = re.match(r'^/api/projects/reorder$', path)
        if m and method == 'PUT': return self.reorder_shots
        m = re.match(r'^/api/projects/([^/]+)/bulk-shots$', path)
        if m and method == 'PUT': return lambda b: self.bulk_update_shots(m.group(1), b)

        # DELETE routes
        m = re.match(r'^/api/projects/([^/]+)$', path)
        if m and method == 'DELETE': return lambda _: self.delete_project(m.group(1))
        m = re.match(r'^/api/sequences/([^/]+)$', path)
        if m and method == 'DELETE': return lambda _: self.delete_sequence(m.group(1))
        m = re.match(r'^/api/shots/([^/]+)$', path)
        if m and method == 'DELETE': return lambda _: self.delete_shot(m.group(1))
        return None

    def parse_multipart(self, body, content_type):
        """Simple multipart parser for file uploads"""
        boundary = content_type.split('boundary=')[1].encode()
        parts = body.split(b'--' + boundary)
        result = {'files': []}
        for part in parts:
            if b'Content-Disposition' not in part: continue
            header_end = part.find(b'\r\n\r\n')
            if header_end < 0: continue
            headers_raw = part[:header_end].decode('utf-8', errors='replace')
            file_data = part[header_end+4:]
            if file_data.endswith(b'\r\n'):
                file_data = file_data[:-2]
            name_m = re.search(r'name="([^"]+)"', headers_raw)
            filename_m = re.search(r'filename="([^"]+)"', headers_raw)
            if filename_m:
                result['files'].append({
                    'field': name_m.group(1) if name_m else 'file',
                    'filename': filename_m.group(1),
                    'data': file_data,
                    'content_type': 'application/octet-stream'
                })
        return result

    # ── JSON responders ──────────────────────────
    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def send_blob(self, data, content_type='application/octet-stream'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    # ── Projects ─────────────────────────────────
    def get_projects(self, _):
        ensure_dirs()
        projects = []
        for p in load_json(PROJECTS_FILE, []):
            if 'blobs' not in p:
                projects.append(p)
        self.send_json(projects)

    def get_project(self, pid):
        projects = load_json(PROJECTS_FILE, [])
        for p in projects:
            if p['id'] == pid:
                self.send_json(p)
                return
        self.send_error(404)

    def create_project(self, body):
        ensure_dirs()
        projects = load_json(PROJECTS_FILE, [])
        p = {
            'id': str(uuid.uuid4()),
            'name': body.get('name', '未命名项目'),
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat(),
            'aiConfig': body.get('aiConfig', {})
        }
        projects.append(p)
        save_json(PROJECTS_FILE, projects)
        self.send_json(p, 201)

    def update_project(self, pid, body):
        projects = load_json(PROJECTS_FILE, [])
        for i, p in enumerate(projects):
            if p['id'] == pid:
                projects[i] = {**p, **body, 'id': pid, 'updatedAt': datetime.now().isoformat()}
                save_json(PROJECTS_FILE, projects)
                self.send_json(projects[i])
                return
        self.send_error(404)

    def delete_project(self, pid):
        projects = load_json(PROJECTS_FILE, [])
        projects = [p for p in projects if p['id'] != pid]
        save_json(PROJECTS_FILE, projects)
        # Cascade delete sequences & shots
        seqs = load_json(SEQUENCES_FILE, [])
        for seq in seqs:
            if seq['projectId'] == pid:
                for vs in (seq.get('videoSegments') or []):
                    if vs.get('videoBlobId'): delete_blob(vs['videoBlobId'])
        seqs = [s for s in seqs if s['projectId'] != pid]
        save_json(SEQUENCES_FILE, seqs)
        shots = load_json(SHOTS_FILE, [])
        for shot in shots:
            if shot['projectId'] == pid:
                for v in (shot.get('variants') or []):
                    if v.get('imageBlobId'): delete_blob(v['imageBlobId'])
        shots = [s for s in shots if s['projectId'] != pid]
        save_json(SHOTS_FILE, shots)
        self.send_json({'deleted': True})

    def bulk_update_shots(self, pid, body):
        """Replace all shots for a project (used in reorder)"""
        shots = load_json(SHOTS_FILE, [])
        shots = [s for s in shots if s['projectId'] != pid]
        shots.extend(body.get('shots', []))
        save_json(SHOTS_FILE, shots)
        self.send_json({'ok': True})

    # ── Sequences ────────────────────────────────
    def get_sequences(self, _):
        self.send_json(load_json(SEQUENCES_FILE, []))

    def create_sequence(self, body):
        seqs = load_json(SEQUENCES_FILE, [])
        s = {
            'id': str(uuid.uuid4()),
            'projectId': body.get('projectId', ''),
            'name': body.get('name', '默认序列'),
            'description': body.get('description', ''),
            'startTime': body.get('startTime', ''),
            'endTime': body.get('endTime', ''),
            'coverBlob': body.get('coverBlob', None),
            'videoSegments': body.get('videoSegments', []),
            'orderIndex': body.get('orderIndex', len(seqs)),
            'createdAt': datetime.now().isoformat()
        }
        seqs.append(s)
        save_json(SEQUENCES_FILE, seqs)
        self.send_json(s, 201)

    def update_sequence(self, sid, body):
        seqs = load_json(SEQUENCES_FILE, [])
        for i, s in enumerate(seqs):
            if s['id'] == sid:
                seqs[i] = {**s, **body, 'id': sid}
                save_json(SEQUENCES_FILE, seqs)
                self.send_json(seqs[i])
                return
        self.send_error(404)

    def delete_sequence(self, sid):
        seqs = load_json(SEQUENCES_FILE, [])
        seq = next((s for s in seqs if s['id'] == sid), None)
        if seq:
            for vs in (seq.get('videoSegments') or []):
                if vs.get('videoBlobId'): delete_blob(vs['videoBlobId'])
        seqs = [s for s in seqs if s['id'] != sid]
        save_json(SEQUENCES_FILE, seqs)
        shots = load_json(SHOTS_FILE, [])
        shots = [s for s in shots if s['sequenceId'] != sid]
        save_json(SHOTS_FILE, shots)
        self.send_json({'deleted': True})

    # ── Shots ────────────────────────────────────
    def get_shots(self, _):
        self.send_json(load_json(SHOTS_FILE, []))

    def create_shot(self, body):
        shots = load_json(SHOTS_FILE, [])
        s = {
            'id': str(uuid.uuid4()),
            'projectId': body.get('projectId', ''),
            'sequenceId': body.get('sequenceId', ''),
            'title': body.get('title', ''),
            'description': body.get('description', ''),
            'variants': body.get('variants', []),
            'startTime': body.get('startTime', ''),
            'endTime': body.get('endTime', ''),
            'duration': body.get('duration', ''),
            'tags': body.get('tags', []),
            'metadata': body.get('metadata', {}),
            'orderIndex': body.get('orderIndex', len(shots)),
            'createdAt': datetime.now().isoformat()
        }
        shots.append(s)
        save_json(SHOTS_FILE, shots)
        self.send_json(s, 201)

    def update_shot(self, sid, body):
        shots = load_json(SHOTS_FILE, [])
        for i, s in enumerate(shots):
            if s['id'] == sid:
                shots[i] = {**s, **body, 'id': sid}
                save_json(SHOTS_FILE, shots)
                self.send_json(shots[i])
                return
        self.send_error(404)

    def delete_shot(self, sid):
        shots = load_json(SHOTS_FILE, [])
        shot = next((s for s in shots if s['id'] == sid), None)
        if shot:
            for v in (shot.get('variants') or []):
                if v.get('imageBlobId'): delete_blob(v['imageBlobId'])
        shots = [s for s in shots if s['id'] != sid]
        save_json(SHOTS_FILE, shots)
        self.send_json({'deleted': True})

    def reorder_shots(self, body):
        """Reorder shots: {fromShotId, toShotId}"""
        shots = load_json(SHOTS_FILE, [])
        from_id = body['fromShotId']
        to_id = body['toShotId']
        from_idx = next((i for i,s in enumerate(shots) if s['id']==from_id), -1)
        to_idx = next((i for i,s in enumerate(shots) if s['id']==to_id), -1)
        if from_idx < 0 or to_idx < 0:
            return self.send_error(404, 'Shot not found')
        src = shots[from_idx]
        if src['sequenceId'] != shots[to_idx]['sequenceId']:
            return self.send_json({'ok': False, 'reason': 'cross-sequence'})
        # Reorder within same sequence
        seq_shots = [s for s in shots if s['sequenceId']==src['sequenceId']]
        other_shots = [s for s in shots if s['sequenceId']!=src['sequenceId']]
        seq_from = next(i for i,s in enumerate(seq_shots) if s['id']==from_id)
        seq_to = next(i for i,s in enumerate(seq_shots) if s['id']==to_id)
        moved = seq_shots.pop(seq_from)
        seq_shots.insert(seq_to, moved)
        for i, s in enumerate(seq_shots):
            s['orderIndex'] = i
        save_json(SHOTS_FILE, other_shots + seq_shots)
        self.send_json({'ok': True})

    # ── Blobs (images/videos) ────────────────────
    def upload_blobs(self, body):
        """Upload files, return blob IDs. Multipart: body['files'] = [{filename, data}]"""
        ensure_dirs()
        results = []
        for f in body.get('files', []):
            bid = str(uuid.uuid4())
            save_blob(bid, f['data'])
            results.append({
                'blobId': bid,
                'filename': f['filename'],
                'size': len(f['data']),
                'contentType': f.get('content_type', 'application/octet-stream')
            })
        self.send_json(results, 201)

    def get_blob(self, bid):
        data = load_blob(bid)
        if data:
            self.send_blob(data)
        else:
            self.send_error(404)

    # ── Meta ─────────────────────────────────────
    def get_meta(self, _):
        self.send_json(load_json(META_FILE, {}))

    def update_meta(self, key, body):
        meta = load_json(META_FILE, {})
        meta[key] = body.get('value', body)
        save_json(META_FILE, meta)
        self.send_json({key: meta[key]})


if __name__ == '__main__':
    ensure_dirs()
    print(f'\n  Storyboard Server running at:')
    print(f'  → http://localhost:{PORT}\n')
    print(f'  Data stored in: {DATA_DIR}/')
    print(f'  Press Ctrl+C to stop\n')

    server = http.server.HTTPServer(('127.0.0.1', PORT), APIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
        server.shutdown()
