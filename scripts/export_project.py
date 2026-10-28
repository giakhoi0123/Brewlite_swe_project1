import os
import shutil
import sys
import re
from datetime import datetime

# Paths
output_path = os.path.join('docs', 'assignment2', 'BREWLITE_PROJECT_FULL_EXPORT.md')
root_output_path = 'BREWLITE_PROJECT_FULL_EXPORT.md'

# Exclude patterns
exclude_dirs = {'.git', 'node_modules', '.next', 'dist', 'build', '.turbo', 'coverage', '.vscode', '.idea', '__pycache__'}
exclude_exts = {'.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.docx', '.zip', '.gz', '.tar', '.log', '.exe', '.dll', '.map', '.tsbuildinfo', '.pyc'}
exclude_files = {'package-lock.json', '.env'}

def get_lang(path):
    filename = os.path.basename(path).lower()
    if filename == 'dockerfile':
        return 'dockerfile'
    if filename in ['.gitignore', '.dockerignore']:
        return 'text'
    if filename == '.prettierrc':
        return 'json'
    ext = os.path.splitext(path)[1].lower()
    mapping = {
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.cjs': 'javascript',
        '.mjs': 'javascript',
        '.json': 'json',
        '.md': 'markdown',
        '.css': 'css',
        '.html': 'html',
        '.sql': 'sql',
        '.prisma': 'prisma',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.puml': 'plantuml',
        '.sh': 'bash',
        '.ps1': 'powershell',
        '.svg': 'xml',
        '.txt': 'text',
        '.toml': 'toml',
        '.py': 'python',
        '.example': 'bash',
    }
    return mapping.get(ext, 'text')

def sort_key(p):
    # Root configs and main docs
    if p in ['README.md', 'AGENTS.md', 'TV4_CODE_GIAI_THICH.md', 'docker-compose.yml', 'package.json', '.env.example', '.gitignore']:
        order = ['README.md', 'AGENTS.md', 'TV4_CODE_GIAI_THICH.md', 'docker-compose.yml', 'package.json', '.env.example', '.gitignore']
        return (0, order.index(p) if p in order else 99, p)
    if p.startswith('docs/'):
        if '/' not in p[5:]:  # docs/*.md
            return (1, 0, p)
        elif p.startswith('docs/requirements/'):
            return (1, 1, p)
        elif p.startswith('docs/diagrams/'):
            return (1, 2, p)
        elif p.startswith('docs/architecture/'):
            return (1, 3, p)
        elif p.startswith('docs/assignment2/'):
            return (1, 4, p)
        else:
            return (1, 5, p)
    if p.startswith('backend/prisma/'):
        if p == 'backend/prisma/schema.prisma':
            return (2, 0, p)
        if 'seed' in p:
            return (2, 1, p)
        return (2, 2, p)
    if p.startswith('backend/'):
        if p.startswith('backend/src/'):
            return (3, 1, p)
        if p.startswith('backend/test/') or p.startswith('backend/scripts/'):
            return (3, 2, p)
        return (3, 0, p)  # backend configs
    if p.startswith('frontend/'):
        if p.startswith('frontend/src/'):
            return (4, 1, p)
        if p.startswith('frontend/e2e/'):
            return (4, 2, p)
        if p.startswith('frontend/public/'):
            return (4, 3, p)
        return (4, 0, p)  # frontend configs
    if p.startswith('stitch/'):
        return (5, 0, p)
    if p.startswith('scripts/'):
        return (6, 0, p)
    return (7, 0, p)

def make_anchor(index, path):
    clean = re.sub(r'[^a-zA-Z0-9_-]', '-', path).lower()
    return f'file-{index}-{clean}'

def get_max_consecutive_backticks(content):
    bt = chr(96)
    max_c = 0
    curr = 0
    for ch in content:
        if ch == bt:
            curr += 1
            if curr > max_c:
                max_c = curr
        else:
            curr = 0
    return max_c

def build_tree(path='.', prefix=''):
    entries = sorted(os.listdir(path))
    filtered = []
    for e in entries:
        if e in exclude_dirs or e in exclude_files:
            continue
        if 'FULL_EXPORT' in e:
            continue
        filtered.append(e)
    
    lines = []
    for i, entry in enumerate(filtered):
        is_last = (i == len(filtered) - 1)
        connector = '└── ' if is_last else '├── '
        full_path = os.path.join(path, entry)
        if os.path.isdir(full_path):
            lines.append(f'{prefix}{connector}{entry}/')
            sub_prefix = prefix + ('    ' if is_last else '│   ')
            lines.extend(build_tree(full_path, sub_prefix))
        else:
            lines.append(f'{prefix}{connector}{entry}')
    return lines

print('Collecting files...')
files_to_export = []
binary_files = []

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for f in files:
        if 'FULL_EXPORT' in f:
            continue
        rel = os.path.normpath(os.path.join(root, f)).replace('\\', '/')
        if rel.startswith('./'):
            rel = rel[2:]
        ext = os.path.splitext(f)[1].lower()
        if ext in {'.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.docx'}:
            binary_files.append((rel, os.path.getsize(rel)))
        elif f in exclude_files or ext in exclude_exts:
            continue
        else:
            files_to_export.append(rel)

files_to_export.sort(key=sort_key)
binary_files.sort(key=lambda x: x[0])

print(f'Found {len(files_to_export)} text files to export, and {len(binary_files)} binary assets.')

# Gather statistics
stats = {
    'total_lines': 0,
    'total_bytes': 0,
    'by_type': {}
}

file_meta = []
for p in files_to_export:
    sz = os.path.getsize(p)
    lang = get_lang(p)
    try:
        with open(p, 'r', encoding='utf-8', errors='replace') as infile:
            txt = infile.read()
            lines = txt.count('\n') + (1 if txt and not txt.endswith('\n') else 0)
    except Exception:
        txt = ''
        lines = 0
    stats['total_lines'] += lines
    stats['total_bytes'] += sz
    stats['by_type'][lang] = stats['by_type'].get(lang, 0) + 1
    file_meta.append({
        'path': p,
        'size': sz,
        'lines': lines,
        'lang': lang,
        'content': txt
    })

print(f'Total lines: {stats["total_lines"]:,}, Total size: {stats["total_bytes"]:,} bytes')

# Git branch and commit
git_info = 'Branch: feature/orders-and-inventory | Commit: 2ee0fc6dbf960f090ca29e2e148f08997beeff22'
now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

separator_line = '=' * 80

print(f'Writing export to {output_path}...')
with open(output_path, 'w', encoding='utf-8') as out:
    out.write('# TOÀN BỘ MÃ NGUỒN VÀ TÀI LIỆU DỰ ÁN BREWLITE (ASSIGNMENT 2 FULL EXPORT)\n\n')
    out.write('> **TỆP XUẤT TOÀN DIỆN VÀ CHÍNH XÁC NHẤT TOÀN BỘ DỰ ÁN BREWLITE**  \n')
    out.write(f'> **Thời gian xuất:** {now_str} | **Git:** {git_info}  \n')
    out.write('> **Môn học:** Công nghệ Phần mềm — ĐH Sài Gòn | **Đồ án:** BrewLite — Nền tảng đặt cà phê và thanh toán không tiền mặt  \n\n')
    out.write('---\n\n')

    # Executive Context for AI
    out.write('## 1. HƯỚNG DẪN DÀNH CHO AI KHI NẠP TỆP DỮ LIỆU NÀY\n\n')
    out.write('Tệp này tập hợp nguyên văn 100% tất cả các tệp mã nguồn, tài liệu đặc tả, kiểm thử, lược đồ cơ sở dữ liệu và cấu hình của dự án BrewLite. Các hệ thống AI (Claude 3.5 Sonnet, Gemini 1.5 Pro, GPT-4o, v.v.) cần tuân thủ nghiêm ngặt các nguyên tắc sau:\n\n')
    out.write('1. **Kiến trúc hệ thống BrewLite:**\n')
    out.write('   - **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, Zustand State Management, mobile-first PWA, hỗ trợ 3 viewport chuẩn (Desktop 1440px, Tablet 768px, Mobile 390px).\n')
    out.write('   - **Backend:** NestJS 11, TypeScript, kiến trúc module hóa chặt chẽ (Auth, Products, Cart, Orders, Payments, Inventory, Barista), validation bằng class-validator.\n')
    out.write('   - **Cơ sở dữ liệu:** PostgreSQL 15, quản lý qua Prisma ORM (12 models, 6 enums, 11 bản migration hoàn chỉnh, seed dữ liệu mẫu phong phú).\n')
    out.write('   - **Hạ tầng & Đóng gói:** Docker Compose cho Multi-service (PostgreSQL, NestJS Backend, Next.js Frontend), CI/CD pipelines.\n\n')
    out.write('2. **Phân công 6 thành viên (Assignment 2):**\n')
    out.write('   - **Phạm Gia Khôi:** Task 1.1 Context & Scope; Task 2.1 Activity menu/cart; Task 3.1 Design FE; Task 4 UI Menu/ProductCard; Task 5 UI chi tiết món/tùy chọn size topping.\n')
    out.write('   - **Võ Minh Tri:** Task 1.2 SRS menu/cart/checkout; Task 2.1 Activity checkout/end-to-end; Task 3.1 Ghép kiến trúc; Task 4 Shell/Navigation/API adapter; Task 5 Giỏ hàng/Checkout/Thanh toán UI.\n')
    out.write('   - **Nguyễn Văn Đông:** Task 1.2 Auth & NFR bảo mật; Task 2.2 Sequence tạo đơn; Task 3.1 Thiết kế module backend; Task 4 PostgreSQL migration/seed/GET products; Task 5 API Auth JWT & API tạo đơn.\n')
    out.write('   - **Lê Quang Điệp:** Task 1.3 Đặc tả UC-CHK (Đặt và thanh toán); Task 2.2 Sequence thanh toán & idempotency; Task 3.1 DB schema, transaction & mock payment; Task 4 API GET products/:id; Task 5 API thanh toán idempotency & API lịch sử đơn.\n')
    out.write('   - **Trần Thế Duy:** Task 1.2-1.3 Sơ đồ Use-case tổng quát & trọng tâm; Task 2.3 Class Diagram 7 lớp; Task 3.1 ADRs & Test list; Task 4 UI Loading/Empty/Error/Retry; Task 5 UI Auth/Lịch sử/Theo dõi & E2E test.\n')
    out.write('   - **Nguyễn Tuấn Kiệt:** Task 1.2 NFR hiệu năng/triển khai & init repo; Task 2 Chuẩn hóa PlantUML/SVG & traceability-matrix; Task 3.2 Deployment Diagram; Task 4 NestJS bootstrap, GET /health, CI pipeline; Task 5 API Staff KDS, Docker, CD pipeline & deploy.\n\n')
    out.write('3. **Quy tắc kỹ thuật bắt buộc trong mã nguồn:**\n')
    out.write('   - **Authentication:** Luôn luôn là API backend thật qua JWT cookie HttpOnly (`token`), bcrypt băm mật khẩu, `session_version` quản lý thu hồi phiên tức thì khi đăng xuất.\n')
    out.write('   - **Tách biệt Mock & API:** Mock dữ liệu chỉ tồn tại độc lập tại `frontend/src/services/mock.ts`. Khi `NEXT_PUBLIC_DATA_MODE=api`, client KHÔNG được tự ý fallback về mock khi backend lỗi để đảm bảo tính chân thực.\n')
    out.write('   - **Luồng Tạo đơn (POST /api/orders):** Kiểm tra tồn kho khả dụng, khóa giữ kho ngay lập tức (`inventoryHeld=true`), lưu snapshot giá và tên tùy chọn vào `order_items`, gán trạng thái ban đầu `PENDING`.\n')
    out.write('   - **Luồng Thanh toán (POST /api/payments):** Kiểm tra Idempotency Key (`idempotencyKey`), khóa dòng đơn hàng (`row-level lock SELECT FOR UPDATE`), ghi nhận nhật ký `gatewayStatus`, cập nhật trạng thái đơn sang `PAID` nếu thành công, hoặc `PAYMENT_FAILED` nếu thất bại (kèm tự động hoàn lại tồn kho), hoặc giữ `PENDING` nếu trạng thái là `UNKNOWN`.\n')
    out.write('   - **Màn hình Barista KDS (Staff):** Đơn chuyển tuần tự: `PAID`/`PENDING` -> `PREPARING` -> `READY` -> `COMPLETED` (ghi nhận `completedAt`). Cho phép hủy đơn kèm lý do bắt buộc (1-300 ký tự) từ trạng thái hợp lệ, tự động hoàn trả tồn kho.\n\n')
    out.write('---\n\n')

    # Project Tree
    out.write('## 2. SƠ ĐỒ CÂY THƯ MỤC DỰ ÁN (PROJECT DIRECTORY TREE)\n\n')
    out.write('```text\n')
    out.write('Brewlite_swe_project1/\n')
    tree_lines = build_tree('.')
    for tl in tree_lines:
        out.write(f'{tl}\n')
    out.write('```\n\n')
    out.write('---\n\n')

    # Summary Statistics
    out.write('## 3. BẢNG THỐNG KÊ DỮ LIỆU XUẤT (EXPORT SUMMARY)\n\n')
    out.write(f'- **Tổng số tệp mã nguồn & tài liệu được xuất nguyên văn:** `{len(files_to_export)}` tệp\n')
    out.write(f'- **Tổng số dòng văn bản (Lines of Code/Docs):** `{stats["total_lines"]:,}` dòng\n')
    out.write(f'- **Tổng dung lượng văn bản:** `{stats["total_bytes"]:,}` bytes (~{stats["total_bytes"] / (1024 * 1024):.2f} MB)\n')
    out.write(f'- **Tổng số tài nguyên nhị phân được lập danh mục:** `{len(binary_files)}` tệp (mockup UI, hình ảnh, tài liệu docx)\n\n')
    out.write('### Phân bố theo ngôn ngữ & định dạng:\n\n')
    out.write('| Định dạng / Ngôn ngữ | Số lượng tệp |\n')
    out.write('| :--- | :--- |\n')
    for lang_name, count in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
        out.write(f'| `{lang_name}` | {count} |\n')
    out.write('\n---\n\n')

    # Binary Assets Table
    out.write('## 4. DANH MỤC TÀI NGUYÊN NHỊ PHÂN (BINARY & MEDIA ASSETS)\n\n')
    out.write('> Ghi chú: Các tệp nhị phân (hình ảnh webp, png, tài liệu docx) không thể nhúng dưới dạng văn bản code block nhưng được lưu giữ đầy đủ tại vị trí đường dẫn tương ứng trong thư mục dự án:\n\n')
    out.write('| STT | Đường dẫn tệp | Dung lượng | Loại tài nguyên |\n')
    out.write('| :--- | :--- | :--- | :--- |\n')
    for idx, (b_path, b_size) in enumerate(binary_files, 1):
        b_ext = os.path.splitext(b_path)[1].lower()
        b_type = 'Ảnh chụp giao diện kiểm thử' if 'evidence' in b_path else ('Thiết kế giao diện Stitch UI Mockup' if 'stitch' in b_path else ('Hồ sơ tài liệu Word (DOCX)' if b_ext == '.docx' else 'Tài nguyên đồ họa hệ thống'))
        out.write(f'| {idx} | `{b_path}` | {b_size:,} bytes | {b_type} |\n')
    out.write('\n---\n\n')

    # Table of Contents
    out.write('## 5. MỤC LỤC CHI TIẾT TỪNG TỆP (TABLE OF CONTENTS)\n\n')
    out.write('| STT | Đường dẫn tệp | Dòng | Dung lượng | Ngôn ngữ | Liên kết |\n')
    out.write('| :--- | :--- | :--- | :--- | :--- | :--- |\n')
    for idx, meta in enumerate(file_meta, 1):
        anchor = make_anchor(idx, meta['path'])
        out.write(f'| {idx} | `{meta["path"]}` | {meta["lines"]:,} | {meta["size"]:,} B | `{meta["lang"]}` | [Xem nội dung](#{anchor}) |\n')
    out.write('\n---\n\n')

    # Verbatim File Contents
    out.write('## 6. TOÀN BỘ NỘI DUNG NGUYÊN VĂN TỪNG TỆP TRONG DỰ ÁN\n\n')

    for idx, meta in enumerate(file_meta, 1):
        path = meta['path']
        lang = meta['lang']
        content = meta['content']
        anchor = make_anchor(idx, path)
        max_bt = get_max_consecutive_backticks(content)
        fence_len = max(4, max_bt + 1)
        fence = chr(96) * fence_len

        out.write(f'<a id="{anchor}"></a>\n')
        out.write(f'{separator_line}\n')
        out.write(f'FILE #{idx}: {path}\n')
        out.write(f'Dung lượng: {meta["size"]:,} bytes | Tổng số dòng: {meta["lines"]:,} | Định dạng: {lang}\n')
        out.write(f'{separator_line}\n\n')
        out.write(f'{fence}{lang}\n')
        out.write(content)
        if not content.endswith('\n'):
            out.write('\n')
        out.write(f'{fence}\n\n')
        out.write(f'[↑ Trở lại Mục lục](#5-mục-lục-chi-tiết-từng-tệp-table-of-contents)\n\n')

print(f'Done writing to {output_path}!')

# Copy to root
shutil.copyfile(output_path, root_output_path)
print(f'Successfully copied full export to root: {root_output_path}!')
