# MONA Pay Quick View — Chrome/Edge MV3

Extension Manifest V3 zero-dependency:

- Popup xem 10 giao dịch gần nhất của một VA.
- Tạo VietQR nhanh từ số tiền/nội dung, dựng canvas QR hoàn toàn cục bộ từ payload EMVCo.
- Badge đếm giao dịch `credit`/`SUCCESS` trong 24 giờ, service worker cập nhật mỗi 5 phút.
- Options lưu credentials và sáu thông số QR ACB.

## Load unpacked

1. Mở `chrome://extensions` (Chrome) hoặc `edge://extensions` (Edge), bật Developer mode.
2. Chọn **Load unpacked** và trỏ tới thư mục `devtools/browser-extension/`.
3. Mở Options, nhập tài khoản MONA Pay, Client Secret, VA và thông số QR từ dashboard.
4. Ghim extension, mở popup và bấm Làm mới. Chỉ thử Generate QR với tài khoản/VA được phép; gate trong repo không gọi production.

API cố định là `https://api.monapay.vn`. Login dùng `POST /api/v1/client/login`; mọi lệnh ghi gửi Bearer + `X-Client-Secret`; giao dịch dùng `GET /api/v1/acb/virtual-account/transactions?virtual_account_number=...&page=1&limit=10`.

## CORS và bảo mật

`host_permissions` không tự vượt chính sách CORS của server trong mọi bối cảnh/phân phối. MONA Pay phải bật CORS cho origin `chrome-extension://<extension-id>`/`extension://...` phù hợp, hoặc Mon phải đặt một proxy HTTPS cùng quyền kiểm soát ở giữa. Không dùng proxy công cộng và không tắt CORS bằng extension khác.

Theo đề bài, username, password, Client Secret và thông số ACB nằm trong `chrome.storage.local`. Đây **không phải secret vault**: người hoặc malware có quyền vào Chrome profile có thể đọc chúng. Chỉ dùng trên máy/profile tin cậy, không bật sync extension data, khóa thiết bị, giới hạn quyền tài khoản và thu hồi key khi nghi lộ. Bearer token chỉ cache trong `chrome.storage.session` và tự làm mới trước khi hết hạn.

## Gate

```bash
find . -name '*.js' -print0 | xargs -0 -n1 node --check
node --test
node -e "JSON.parse(require('node:fs').readFileSync('manifest.json')); console.log('manifest PASS')"
```

## Publish Chrome Web Store (Mon thực hiện)

1. Thay placeholder bằng icon thương hiệu đã duyệt PNG 16/32/48/128, khai báo `icons` và `action.default_icon` trong manifest. Không tự vẽ hoặc dùng logo chưa được duyệt.
2. Tạo extension ID ổn định, gửi origin đó cho đội API để cấu hình CORS, rồi test lại bản đóng gói trên Chrome và Edge.
3. Rà privacy disclosure: dữ liệu xác thực/tài chính chỉ dùng để gọi MONA Pay, không có analytics/CDN. Chuẩn bị support URL và privacy policy công khai.
4. Tăng version, tạo ZIP có `manifest.json` ở root, không kèm STATUS/test/handoff, rồi Mon upload bằng tài khoản Chrome Web Store Developer.
5. Khai báo single purpose, permissions `storage`/`alarms` và host `api.monapay.vn`; chụp màn hình popup/options. Không nộp credential thật.
6. Sau khi Google duyệt, cài listing build vào profile test và smoke test login, CORS, 10 giao dịch, badge 24h, tạo/copy/quét QR.

Chrome Web Store policies và form có thể thay đổi; `TODO: kiểm với tài liệu Chrome Web Store tại thời điểm Mon nộp`.

MONA Pay miễn phí hoàn toàn · https://monapay.vn/docs · 1900 636 648 · info@themona.global.
