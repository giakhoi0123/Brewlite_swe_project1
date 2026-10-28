"""Export the current working tree into one Markdown file, including binary assets."""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'.git', '.codex', '.agents', '.aws', 'node_modules', '.next', 'dist',
             'build', 'coverage', '__pycache__', 'playwright-report', 'test-results'}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8')


def excluded(path):
    name = path.name.lower()
    return (bool(set(path.parts) & SKIP_DIRS)
            or 'FULL_EXPORT' in path.name.upper()
            or (name.startswith('.env') and name != '.env.example')
            or name in {'.npmrc', '.pypirc', 'credentials', 'id_rsa', 'id_ed25519'}
            or path.suffix.lower() in {'.pem', '.key', '.pfx', '.p12', '.log', '.pyc', '.tsbuildinfo'})


def main():
    now = datetime.now(timezone(timedelta(hours=7)))
    output = ROOT / f'BREWLITE_PROJECT_FULL_EXPORT_{now:%Y-%m-%d}.md'
    candidates = sorted(set(filter(None, git('ls-files', '-z', '--cached', '--others',
                                              '--exclude-standard').split('\0'))))
    records, skipped = [], []
    for name in candidates:
        path = ROOT / name
        if excluded(Path(name)):
            skipped.append(name)
            continue
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise RuntimeError(f'Unsupported link outside snapshot: {name}')
        if not path.is_file():
            skipped.append(name)
            continue
        raw = path.read_bytes()
        try:
            body = raw.decode('utf-8')
            if '\0' in body:
                raise ValueError('binary content')
            encoding = 'utf-8'
        except (UnicodeDecodeError, ValueError):
            body = base64.encodebytes(raw).decode('ascii')
            encoding = 'base64'
        meta = {'path': name, 'encoding': encoding, 'bytes': len(raw),
                'characters': len(body), 'sha256': hashlib.sha256(raw).hexdigest()}
        records.append((meta, body))

    with output.open('w', encoding='utf-8', newline='') as stream:
        stream.write('# BrewLite — bản xuất nội dung project\n\n')
        stream.write(f'Thời gian: {now.isoformat(timespec="seconds")} (UTC+07:00).\n\n')
        stream.write(f'Nhánh: `{git("branch", "--show-current").strip()}`; '
                     f'commit: `{git("rev-parse", "HEAD").strip()}`.\n\n')
        stream.write('Nội dung lấy từ cây làm việc hiện tại, gồm cả thay đổi chưa commit. '
                     'Văn bản UTF-8 được giữ nguyên; ảnh, Word và file nhị phân được nhúng Base64 '
                     '(giải mã Base64 để lấy lại file gốc). Mỗi file có SHA-256 để đối chiếu.\n\n')
        stream.write('Phạm vi: file Git theo dõi và file mới không bị Git ignore. '
                     'Loại .git, thư viện, build/cache, cấu hình bí mật, log và bản xuất cũ; '
                     'giữ .env.example và package-lock.json. Không xuất dữ liệu DB đang chạy. '
                     'Đây là bản chụp nội dung, không phải kết quả nghiệm thu ứng dụng.\n\n')
        stream.write(f'Tổng cộng: {len(records)} file; '
                     f'{sum(m["encoding"] == "base64" for m, _ in records)} file Base64.\n\n')
        stream.write('## Mục lục\n\n')
        for index, (meta, _) in enumerate(records, 1):
            stream.write(f'{index}. [{meta["path"]}](#file-{index}) — {meta["bytes"]} bytes; {meta["encoding"]}\n')
        stream.write('\n## File bị loại trong danh sách Git\n\n')
        for name in skipped:
            stream.write(f'- `{name}`\n')
        stream.write('\nCác file bị Git ignore không được duyệt nội dung.\n\n')
        for index, (meta, body) in enumerate(records, 1):
            fence = '`' * max(4, 1 + max((len(x) for x in re.findall(r'`+', body)), default=0))
            stream.write(f'<a id="file-{index}"></a>\n\n## {meta["path"]}\n\n')
            stream.write('<!-- snapshot-file ' + json.dumps(meta, ensure_ascii=False) + ' -->\n')
            stream.write(f'{fence}{"base64" if meta["encoding"] == "base64" else "text"}\n')
            stream.write(body)
            stream.write(f'\n{fence}\n\n')

    # Read the artifact back and compare every embedded file against the working tree.
    exported = output.read_bytes().decode('utf-8')
    cursor = 0
    for expected, _ in records:
        start = exported.index('<!-- snapshot-file ', cursor) + len('<!-- snapshot-file ')
        end = exported.index(' -->\n', start)
        meta = json.loads(exported[start:end])
        body_start = exported.index('\n', end + len(' -->\n')) + 1
        body = exported[body_start:body_start + meta['characters']]
        raw = base64.b64decode(body) if meta['encoding'] == 'base64' else body.encode('utf-8')
        assert meta == expected
        assert len(raw) == meta['bytes']
        assert hashlib.sha256(raw).hexdigest() == meta['sha256']
        assert raw == (ROOT / meta['path']).read_bytes(), meta['path']
        cursor = body_start + meta['characters']
    print(json.dumps({'file': output.name, 'files_verified': len(records),
                      'binary_files': sum(m['encoding'] == 'base64' for m, _ in records),
                      'bytes': output.stat().st_size}, indent=2))


if __name__ == '__main__':
    main()
