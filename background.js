'use strict';

const API_ORIGIN = 'https://api.monapay.vn';
const REFRESH_ALARM = 'monapay-refresh-badge';
const LOCAL_KEYS = [
  'username', 'password', 'clientSecret', 'virtualAccountNumber', 'ownerNumber',
  'ownerType', 'merchantId', 'terminalId', 'virtualAccountPrefix', 'beneficiaryName',
];

async function localSettings() {
  return chrome.storage.local.get(LOCAL_KEYS);
}

function requireSetting(settings, key) {
  const value = String(settings[key] || '').trim();
  if (!value) throw new Error(`Thiếu cấu hình ${key}. Mở Options để nhập.`);
  return value;
}

function apiMessage(body, status) {
  if (typeof body?.message === 'string' && body.message) return body.message;
  if (typeof body?.detail === 'string' && body.detail) return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg || 'Dữ liệu không hợp lệ').join('; ');
  return `MONA Pay trả HTTP ${status}`;
}

async function accessToken(force = false) {
  if (!force) {
    const cached = await chrome.storage.session.get(['accessToken', 'accessTokenExpiresAt']);
    if (cached.accessToken && Number(cached.accessTokenExpiresAt) > Date.now() + 60_000) return cached.accessToken;
  }
  const settings = await localSettings();
  const response = await fetch(`${API_ORIGIN}/api/v1/client/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: requireSetting(settings, 'username'), password: requireSetting(settings, 'password') }),
  });
  const body = await response.json().catch(() => null);
  const token = body?.data?.access_token;
  if (!response.ok || !body?.success || typeof token !== 'string' || !token) throw new Error(apiMessage(body, response.status));
  const expiresIn = Math.max(60, Math.min(86400, Number(body.data.expires_in) || 86400));
  await chrome.storage.session.set({ accessToken: token, accessTokenExpiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

async function apiFetch(path, { method = 'GET', body, retry = true } = {}) {
  const settings = await localSettings();
  const headers = { Accept: 'application/json', Authorization: `Bearer ${await accessToken()}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-Client-Secret'] = requireSetting(settings, 'clientSecret');
  let response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw new Error('Không gọi được API. Kiểm tra mạng và CORS cho origin của extension.');
  }
  if (response.status === 401 && retry) {
    await accessToken(true);
    return apiFetch(path, { method, body, retry: false });
  }
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) throw new Error(apiMessage(json, response.status));
  return json.data;
}

async function transactionPage(page = 1, limit = 10) {
  const settings = await localSettings();
  const va = requireSetting(settings, 'virtualAccountNumber');
  const query = new URLSearchParams({ virtual_account_number: va, page: String(Math.max(1, page)), limit: String(Math.min(100, Math.max(1, limit))) });
  return apiFetch(`/api/v1/acb/virtual-account/transactions?${query}`);
}

async function recentTransactions(limit = 10) {
  const result = await transactionPage(1, limit);
  return Array.isArray(result?.data) ? result.data.slice(0, limit) : [];
}

async function generateQr(input) {
  const settings = await localSettings();
  const amount = Number(input?.amount);
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000) throw new Error('Số tiền phải là số nguyên từ 0 đến 1.000.000.000 VND.');
  const description = String(input?.description || '').trim();
  if (description.length > 255) throw new Error('Nội dung tối đa 255 ký tự.');
  const orderId = `EXT${Date.now()}`;
  return apiFetch('/api/v1/acb/qr-payment/generate', {
    method: 'POST',
    body: {
      ownerNumber: requireSetting(settings, 'ownerNumber'),
      ownerType: requireSetting(settings, 'ownerType'),
      merchantId: requireSetting(settings, 'merchantId'),
      terminalId: requireSetting(settings, 'terminalId'),
      orderId,
      virtualAccountPrefix: requireSetting(settings, 'virtualAccountPrefix'),
      beneficiaryName: requireSetting(settings, 'beneficiaryName'),
      amount,
      description: description || `Thanh toan ${orderId}`,
      traceNumber: orderId,
    },
  });
}

async function updateBadge() {
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    let count = 0;
    let pageNumber = 1;
    let reachedOldTransaction = false;
    do {
      const page = await transactionPage(pageNumber, 100);
      const transactions = Array.isArray(page?.data) ? page.data : [];
      for (const transaction of transactions) {
        const occurredAt = Date.parse(transaction.transaction_date || transaction.effective_date || '');
        if (Number.isFinite(occurredAt) && occurredAt < since) {
          reachedOldTransaction = true;
          continue;
        }
        if ((!transaction.debit_or_credit || transaction.debit_or_credit === 'credit')
          && (!transaction.transaction_status || transaction.transaction_status === 'SUCCESS')
          && Number.isFinite(occurredAt)) count += 1;
      }
      if (reachedOldTransaction || pageNumber >= Number(page?.last_page || pageNumber)) break;
      pageNumber += 1;
    } while (pageNumber <= 100);
    await chrome.action.setBadgeBackgroundColor({ color: '#2563EB' });
    await chrome.action.setBadgeText({ text: count ? (count > 99 ? '99+' : String(count)) : '' });
  } catch (error) {
    await chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 5 });
  await updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) updateBadge();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.session.clear().then(updateBadge);
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const task = message?.type === 'transactions'
    ? recentTransactions(10)
    : message?.type === 'generateQr'
      ? generateQr(message.input)
      : message?.type === 'refreshBadge'
        ? updateBadge().then(() => null)
        : Promise.reject(new Error('Yêu cầu extension không hợp lệ.'));
  task.then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
