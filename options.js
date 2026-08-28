'use strict';

const FORM = document.getElementById('settings-form');
const STATUS = document.getElementById('status');
const KEYS = ['username', 'password', 'clientSecret', 'virtualAccountNumber', 'ownerNumber', 'ownerType', 'merchantId', 'terminalId', 'virtualAccountPrefix', 'beneficiaryName'];

async function load() {
  const values = await chrome.storage.local.get(KEYS);
  for (const key of KEYS) {
    if (FORM.elements[key]) FORM.elements[key].value = values[key] || (key === 'ownerType' ? 'ORG' : '');
  }
}

FORM.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = {};
  for (const key of KEYS) values[key] = String(FORM.elements[key].value || '').trim();
  if (!['PER', 'ORG'].includes(values.ownerType)) {
    STATUS.textContent = 'ownerType không hợp lệ.';
    return;
  }
  if (values.virtualAccountPrefix.length > 10) {
    STATUS.textContent = 'virtualAccountPrefix tối đa 10 ký tự.';
    return;
  }
  await chrome.storage.local.set(values);
  await chrome.storage.session.clear();
  STATUS.textContent = 'Đã lưu.';
  chrome.runtime.sendMessage({ type: 'refreshBadge' }).catch(() => {});
  setTimeout(() => { STATUS.textContent = ''; }, 2500);
});

load();
