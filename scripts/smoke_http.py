"""Smoke test the local Compose stack. Creates one disposable CUSTOMER account."""
import http.cookiejar
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

BASE = os.getenv('BREWLITE_SMOKE_API', 'http://localhost:3001/api').rstrip('/')
if urllib.parse.urlparse(BASE).hostname not in {'localhost', '127.0.0.1'}:
    raise SystemExit('Smoke test chỉ chạy với API cục bộ')
ORIGIN = 'http://localhost:3000'

def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar

def call(opener, path, method='GET', body=None, origin=ORIGIN):
    headers = {'Content-Type': 'application/json'}
    if method != 'GET' and origin is not None:
        headers['Origin'] = origin
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body or {}).encode() if method != 'GET' else None,
        headers=headers,
        method=method,
    )
    try:
        with opener.open(request, timeout=5) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

opener, _ = client()
status, products = call(opener, '/products')
assert status == 200 and products and 'stock' in products[0]
status, detail = call(opener, '/products/' + products[0]['id'])
assert status == 200 and len(detail['sizes']) == 3

email = 'smoke-' + uuid.uuid4().hex[:10] + '@example.test'
password = 'A' + secrets.token_urlsafe(16) + '9'
customer, cookies = client()
assert call(customer, '/auth/register', 'POST', {'name': 'Test', 'email': email, 'password': password, 'role': 'BARISTA'})[0] == 400
assert call(customer, '/auth/register', 'POST', {'name': 'Test', 'email': 'bad', 'password': password})[0] == 400
status, registered = call(customer, '/auth/register', 'POST', {'name': 'Test Customer', 'email': email, 'password': password})
assert status == 201 and registered['user']['role'] == 'CUSTOMER'
assert 'accessToken' not in registered and 'passwordHash' not in registered['user']
assert len(list(cookies)) == 1 and list(cookies)[0].has_nonstandard_attr('HttpOnly')
assert call(customer, '/auth/me')[0] == 200
assert call(customer, '/barista/dashboard')[0] == 403
assert call(customer, '/auth/register', 'POST', {'name': 'Test', 'email': email, 'password': password})[0] == 409
assert call(customer, '/auth/logout', 'POST')[0] == 201
assert call(customer, '/auth/me')[0] == 401
assert call(customer, '/auth/login', 'POST', {'email': email, 'password': 'WrongPassword123'})[0] == 401
assert call(customer, '/auth/login', 'POST', {'email': email, 'password': password})[0] == 201
assert call(customer, '/auth/logout', 'POST', origin='https://other.example')[0] == 403

config = {}
for line in Path(__file__).resolve().parents[1].joinpath('.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        key, value = line.split('=', 1)
        config[key] = value.strip('"')
if config.get('BARISTA_EMAIL') and config.get('BARISTA_PASSWORD'):
    staff, _ = client()
    status, login = call(staff, '/auth/login', 'POST', {'email': config['BARISTA_EMAIL'], 'password': config['BARISTA_PASSWORD']})
    assert status == 201 and login['user']['role'] == 'BARISTA'
    assert call(staff, '/barista/dashboard')[0] == 200
print('PASS: Products list/detail, auth validation/session/logout, CSRF, CUSTOMER 403, BARISTA 200')
