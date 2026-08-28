'use strict';

const transactionsList = document.getElementById('transactions');
const transactionsStatus = document.getElementById('transactions-status');
const qrStatus = document.getElementById('qr-status');
const qrResult = document.getElementById('qr-result');
const qrPayload = document.getElementById('qr-payload');

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function dateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

async function message(payload) {
  const result = await chrome.runtime.sendMessage(payload);
  if (!result?.ok) throw new Error(result?.error || 'Extension không phản hồi.');
  return result.data;
}

async function loadTransactions() {
  transactionsStatus.textContent = 'Đang tải…';
  transactionsList.replaceChildren();
  try {
    const transactions = await message({ type: 'transactions' });
    if (!transactions.length) {
      transactionsStatus.textContent = 'Chưa có giao dịch.';
      return;
    }
    transactionsStatus.textContent = '';
    for (const transaction of transactions) {
      const item = document.createElement('li');
      const top = document.createElement('div');
      const amount = document.createElement('strong');
      const time = document.createElement('time');
      const content = document.createElement('span');
      amount.textContent = money(transaction.amount);
      time.textContent = dateTime(transaction.transaction_date || transaction.effective_date);
      content.textContent = transaction.transaction_content || transaction.transaction_code || 'Không có nội dung';
      top.append(amount, time);
      item.append(top, content);
      transactionsList.append(item);
    }
  } catch (error) {
    transactionsStatus.textContent = error.message;
  }
}

document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('refresh').addEventListener('click', loadTransactions);
document.getElementById('qr-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  qrStatus.textContent = 'Đang tạo QR…';
  qrResult.hidden = true;
  const form = new FormData(event.currentTarget);
  try {
    const data = await message({ type: 'generateQr', input: { amount: Number(form.get('amount')), description: String(form.get('description') || '') } });
    if (!data?.qr_data_url) throw new Error('API không trả qr_data_url.');
    qrPayload.value = data.qr_data_url;
    document.getElementById('qr-meta').textContent = `VA: ${data.virtual_account_number || '—'} · QR ID: ${data.id || '—'}`;
    MonaQr.renderCanvas(document.getElementById('qr-canvas'), data.qr_data_url);
    qrResult.hidden = false;
    qrStatus.textContent = 'Đã tạo VietQR.';
  } catch (error) {
    qrStatus.textContent = error.message;
  }
});
document.getElementById('copy-qr').addEventListener('click', async () => {
  await navigator.clipboard.writeText(qrPayload.value);
  qrStatus.textContent = 'Đã copy chuỗi VietQR.';
});

loadTransactions();
