# BROWSER EXTENSION STATUS — 2026-08-29

## Trạng thái

Đã hoàn thành Chrome/Edge Manifest V3 scaffold, zero-dependency:

- Popup gọi API trực tiếp để xem 10 giao dịch gần nhất và format VND/thời gian.
- Form tạo QR nhanh từ số tiền nguyên VND + nội dung; đủ payload QR ACB, Bearer và `X-Client-Secret`.
- Encoder QR byte-mode/ECC M vendored cục bộ, dựng canvas từ `qr_data_url` EMVCo; không CDN, không dịch vụ QR thứ ba.
- Service worker cache Bearer trong `chrome.storage.session`, refresh một lần khi 401.
- Alarm 5 phút; badge phân trang giao dịch mới nhất và đếm `credit`/`SUCCESS` trong 24 giờ (dừng khi gặp bản ghi cũ, giới hạn an toàn 100 trang/lần).
- Options lưu username/password/Client Secret, VA và sáu thông số ACB trong `chrome.storage.local`, có cảnh báo đây không phải secret vault.
- Host permission chỉ có `https://api.monapay.vn/*`. README ghi yêu cầu CORS cho extension origin hoặc proxy HTTPS do Mon kiểm soát.
- Icon chỉ có placeholder hướng dẫn, không vẽ/giả logo. Manifest vẫn load unpacked không cần icon; Mon bổ sung PNG thương hiệu đã duyệt trước publish.

## Kết quả gate

- `node --check` toàn bộ 4 file JS runtime + 1 test của extension: **PASS**.
- `node --test devtools/browser-extension/test/*.test.js`: **PASS, 1/1 test**.
- So ma trận QR extension với encoder CLI đã test trong repo trên 3 payload: **PASS**.
- Parse `manifest.json`: **PASS**.
- Invariant manifest/source: MV3, `storage`, `alarms`, đúng host permission, service worker, chu kỳ 5 phút, 10 giao dịch và đúng QR endpoint: **PASS, 8/8**.
- Scan nội dung chung: không có tài khoản test production, tên nhà cung cấp bị cấm, trailing whitespace, `node_modules` hoặc dependency tải ngoài: **PASS**.
- Không gọi login/GET/POST production và không tạo QR/VA thật trong gate.

## Chưa xác minh trong môi trường này

- Load-unpacked UI trên Chrome/Edge thật, lifecycle service worker, badge sau sleep/wake và quyền Clipboard.
- CORS của `api.monapay.vn` với extension ID cuối cùng. `host_permissions` không thay cho cấu hình CORS/phân phối cần thiết trong mọi browser context.
- Quét ảnh QR canvas bằng nhiều app ngân hàng và các payload EMVCo dài ở production.
- Quy trình/listing Chrome Web Store tại ngày nộp và bộ icon/brand/privacy policy cuối.

README có đầy đủ cách load unpacked, cảnh báo credential, CORS/proxy và checklist để Mon publish Chrome Web Store. Trước publish, dùng extension ID ổn định, xin allowlist CORS, thêm icon PNG 16/32/48/128 đã duyệt và smoke test bản ZIP không chứa test/STATUS/credential.
