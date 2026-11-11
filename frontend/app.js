'use strict';

/**
 * Konfigurasi aplikasi pendaftaran desa.
 * Ganti nilai WEBHOOK_URL dengan URL Web App hasil deployment Google Apps Script.
 */
const APP_CONFIG = {
  WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbxa8gjBA33s9U4Oo92kYvOOcy3JEDsO-crrFVghQsJuOv8xUpvQJ-MgsQhQzR2M7q6k/exec',
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'pdf'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  REQUEST_TIMEOUT_MS: 90000,
};

/**
 * Data resmi wilayah Kabupaten Mamuju Tengah (5 Kecamatan, 54 Desa).
 */
const WILAYAH_MAMUJU_TENGAH = {
  Tobadak: [
    'Bambadaru',
    'Batu Parigi',
    'Mahahe',
    'Palongaan',
    'Saloadak',
    'Sejati',
    'Sulobaja',
    'Tobadak',
  ],
  Topoyo: [
    'Bambamanurung',
    'Budong-Budong',
    'Kabubu',
    'Pangalloang',
    'Paraili',
    'Salulekbo',
    'Salupangkang',
    'Salupangkang IV',
    'Sinabatta',
    'Tabolang',
    'Tangkou',
    'Tappilina',
    'Topoyo',
    'Tumbu',
    'Waeputeh',
  ],
  'Budong-Budong': [
    'Babana',
    'Barakkang',
    'Bojo',
    'Kire',
    'Lembah Hada',
    'Lumu',
    'Pasapa',
    'Pontanakayang',
    'Salogatta',
    'Salumanurung',
    'Tinali',
  ],
  Karossa: [
    'Benggaulu',
    'Kadaila',
    'Kambunong',
    'Karossa',
    'Kayu Calla',
    'Lara',
    'Lembah Hopo',
    'Salubiro',
    'Sanjango',
    'Suka Maju',
    'Tasokko',
  ],
  Pangale: [
    'Kombiling',
    'Kuo',
    'Lamba-lamba',
    'Lemo-Lemo',
    'Pangale',
    'Polo Camba',
    'Polo Lereng',
    'Polo Pangale',
    'Sartanamaju',
  ],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^(?:\+62|62|0)[2-9][0-9]{7,12}$/;

const PHONE_FIELDS = [
  { key: 'hpKepalaDesa', label: 'No. HP Kepala Desa' },
  { key: 'hpPendamping', label: 'No. HP Pendamping (Sekretaris)' },
  { key: 'hpOperator', label: 'No. HP Operator' },
];

const state = {
  selectedFile: null,
  previewObjectUrl: null,
  isSubmitting: false,
};

const elements = {
  form: document.getElementById('registrationForm'),
  statusAlert: document.getElementById('statusAlert'),
  kecamatan: document.getElementById('kecamatan'),
  namaDesa: document.getElementById('namaDesa'),
  desaCountHint: document.getElementById('desaCountHint'),
  kepalaDesa: document.getElementById('kepalaDesa'),
  hpKepalaDesa: document.getElementById('hpKepalaDesa'),
  alamatKantor: document.getElementById('alamatKantor'),
  emailDesa: document.getElementById('emailDesa'),
  namaPendamping: document.getElementById('namaPendamping'),
  hpPendamping: document.getElementById('hpPendamping'),
  namaOperator: document.getElementById('namaOperator'),
  hpOperator: document.getElementById('hpOperator'),
  buktiTransfer: document.getElementById('buktiTransfer'),
  dropzone: document.getElementById('dropzone'),
  filePreviewCard: document.getElementById('filePreviewCard'),
  filePreviewThumb: document.getElementById('filePreviewThumb'),
  filePreviewName: document.getElementById('filePreviewName'),
  filePreviewMeta: document.getElementById('filePreviewMeta'),
  removeFileBtn: document.getElementById('removeFileBtn'),
  submitBtn: document.getElementById('submitBtn'),
};

function init() {
  populateKecamatanDropdown();
  bindEvents();
}

function populateKecamatanDropdown() {
  const kecamatanList = Object.keys(WILAYAH_MAMUJU_TENGAH);
  const fragment = document.createDocumentFragment();

  kecamatanList.forEach((kecamatanName) => {
    const option = document.createElement('option');
    option.value = kecamatanName;
    option.textContent = `Kecamatan ${kecamatanName}`;
    fragment.appendChild(option);
  });

  elements.kecamatan.appendChild(fragment);
}

function populateDesaDropdown(kecamatanName) {
  const desaSelect = elements.namaDesa;
  desaSelect.innerHTML = '';

  if (!kecamatanName || !WILAYAH_MAMUJU_TENGAH[kecamatanName]) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih Kecamatan terlebih dahulu';
    desaSelect.appendChild(placeholder);
    desaSelect.disabled = true;
    elements.desaCountHint.textContent = '5 Kecamatan, 54 Desa terdaftar';
    return;
  }

  const desaList = WILAYAH_MAMUJU_TENGAH[kecamatanName];
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = `Pilih Desa (${desaList.length} desa)`;
  desaSelect.appendChild(defaultOption);

  const fragment = document.createDocumentFragment();
  desaList.forEach((desaName) => {
    const option = document.createElement('option');
    option.value = desaName;
    option.textContent = desaName;
    fragment.appendChild(option);
  });

  desaSelect.appendChild(fragment);
  desaSelect.disabled = false;
  elements.desaCountHint.textContent = `Menampilkan ${desaList.length} desa di Kecamatan ${kecamatanName}`;
}

function bindEvents() {
  elements.kecamatan.addEventListener('change', (event) => {
    const chosenKecamatan = event.target.value;
    populateDesaDropdown(chosenKecamatan);
    clearFieldError('kecamatan');
    clearFieldError('namaDesa');
  });

  elements.namaDesa.addEventListener('change', () => clearFieldError('namaDesa'));

  [
    { input: elements.kepalaDesa, field: 'kepalaDesa' },
    { input: elements.alamatKantor, field: 'alamatKantor' },
    { input: elements.namaPendamping, field: 'namaPendamping' },
    { input: elements.namaOperator, field: 'namaOperator' },
  ].forEach(({ input, field }) => {
    input.addEventListener('input', () => {
      if (input.value.trim().length > 0) {
        clearFieldError(field);
      }
    });
  });

  elements.emailDesa.addEventListener('input', () => {
    const value = elements.emailDesa.value.trim();
    if (!value || EMAIL_PATTERN.test(value)) {
      clearFieldError('emailDesa');
    }
  });

  elements.emailDesa.addEventListener('blur', () => {
    const value = elements.emailDesa.value.trim();
    if (value && !EMAIL_PATTERN.test(value)) {
      setFieldError('emailDesa', 'Format email tidak valid. Contoh: desa@domain.go.id');
    }
  });

  PHONE_FIELDS.forEach(({ key, label }) => {
    const input = elements[key];
    input.addEventListener('input', () => {
      const normalized = normalizePhone(input.value);
      if (!normalized || PHONE_PATTERN.test(normalized)) {
        clearFieldError(key);
      }
    });
    input.addEventListener('blur', () => {
      const normalized = normalizePhone(input.value);
      if (normalized && !PHONE_PATTERN.test(normalized)) {
        setFieldError(key, `Format ${label} tidak valid. Gunakan angka 08... atau +628...`);
      }
    });
  });

  elements.buktiTransfer.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      handleSelectedFile(file);
    }
  });

  elements.removeFileBtn.addEventListener('click', () => {
    resetSelectedFile();
  });

  setupDragAndDrop();

  elements.form.addEventListener('submit', handleFormSubmit);
}

function setupDragAndDrop() {
  const dropzone = elements.dropzone;

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.isSubmitting) {
        dropzone.classList.add('is-dragover');
      }
    });
  });

  ['dragleave', 'dragend'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
      dropzone.classList.remove('is-dragover');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.remove('is-dragover');

    if (state.isSubmitting) {
      return;
    }

    const droppedFiles = event.dataTransfer && event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleSelectedFile(droppedFiles[0]);
    }
  });
}

function getFileExtension(fileName) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function resolveMimeType(file) {
  if (file.type === 'image/jpg') {
    return 'image/jpeg';
  }
  if (file.type && APP_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
    return file.type;
  }

  const ext = getFileExtension(file.name);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'pdf') return 'application/pdf';
  return '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateFile(file) {
  if (!file) {
    return 'Bukti transfer wajib diunggah.';
  }

  const ext = getFileExtension(file.name);
  const mime = resolveMimeType(file);
  const isAllowedExtension = APP_CONFIG.ALLOWED_EXTENSIONS.includes(ext);
  const isAllowedMime = mime !== '';

  if (!isAllowedExtension || !isAllowedMime) {
    return 'Format file tidak didukung. Gunakan JPG, JPEG, PNG, atau PDF.';
  }

  if (file.size === 0) {
    return 'File yang dipilih kosong (0 byte).';
  }

  if (file.size > APP_CONFIG.MAX_FILE_SIZE_BYTES) {
    return `Ukuran file (${formatFileSize(file.size)}) melebihi batas maksimal 10 MB.`;
  }

  return '';
}

function handleSelectedFile(file) {
  const validationMessage = validateFile(file);
  if (validationMessage) {
    resetSelectedFile();
    setFieldError('buktiTransfer', validationMessage);
    return;
  }

  clearFieldError('buktiTransfer');
  revokePreviewUrl();

  state.selectedFile = file;
  renderFilePreview(file);
}

function renderFilePreview(file) {
  const resolvedMime = resolveMimeType(file);
  elements.filePreviewThumb.innerHTML = '';

  if (resolvedMime.startsWith('image/')) {
    const objectUrl = URL.createObjectURL(file);
    state.previewObjectUrl = objectUrl;
    const img = document.createElement('img');
    img.src = objectUrl;
    img.alt = `Pratinjau ${file.name}`;
    elements.filePreviewThumb.appendChild(img);
  } else {
    const badge = document.createElement('span');
    badge.className = 'file-pdf-badge';
    badge.textContent = 'PDF';
    elements.filePreviewThumb.appendChild(badge);
  }

  elements.filePreviewName.textContent = file.name;
  elements.filePreviewMeta.textContent = `${resolvedMime.toUpperCase()} • ${formatFileSize(file.size)}`;
  elements.filePreviewCard.classList.remove('is-hidden');
}

function resetSelectedFile() {
  revokePreviewUrl();
  state.selectedFile = null;
  elements.buktiTransfer.value = '';
  elements.filePreviewThumb.innerHTML = '';
  elements.filePreviewName.textContent = '';
  elements.filePreviewMeta.textContent = '';
  elements.filePreviewCard.classList.add('is-hidden');
}

function revokePreviewUrl() {
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = null;
  }
}

function setFieldError(fieldName, message) {
  const group = elements.form.querySelector(`[data-field="${fieldName}"]`);
  const errorEl = document.getElementById(`${fieldName}Error`);

  if (group) {
    group.classList.add('has-error');
  }
  if (errorEl) {
    errorEl.textContent = message;
  }
}

function clearFieldError(fieldName) {
  const group = elements.form.querySelector(`[data-field="${fieldName}"]`);
  const errorEl = document.getElementById(`${fieldName}Error`);

  if (group) {
    group.classList.remove('has-error');
  }
  if (errorEl) {
    errorEl.textContent = '';
  }
}

function normalizePhone(rawValue) {
  return rawValue.trim().replace(/[\s\-().]/g, '');
}

function clearAllFieldErrors() {
  [
    'kecamatan',
    'namaDesa',
    'kepalaDesa',
    'hpKepalaDesa',
    'alamatKantor',
    'emailDesa',
    'namaPendamping',
    'hpPendamping',
    'namaOperator',
    'hpOperator',
    'buktiTransfer',
  ].forEach(clearFieldError);
}

function validateFormFields() {
  clearAllFieldErrors();
  let firstInvalidElement = null;

  const markInvalid = (fieldName, element, message) => {
    setFieldError(fieldName, message);
    if (!firstInvalidElement) {
      firstInvalidElement = element;
    }
  };

  const kecamatan = elements.kecamatan.value.trim();
  const namaDesa = elements.namaDesa.value.trim();
  const kepalaDesa = elements.kepalaDesa.value.trim();
  const alamatKantor = elements.alamatKantor.value.trim();
  const emailDesa = elements.emailDesa.value.trim();
  const namaPendamping = elements.namaPendamping.value.trim();
  const namaOperator = elements.namaOperator.value.trim();

  if (!kecamatan || !WILAYAH_MAMUJU_TENGAH[kecamatan]) {
    markInvalid('kecamatan', elements.kecamatan, 'Silakan pilih Kecamatan.');
  }

  if (
    !namaDesa ||
    !kecamatan ||
    !WILAYAH_MAMUJU_TENGAH[kecamatan] ||
    !WILAYAH_MAMUJU_TENGAH[kecamatan].includes(namaDesa)
  ) {
    markInvalid('namaDesa', elements.namaDesa, 'Silakan pilih Nama Desa.');
  }

  if (kepalaDesa.length < 3) {
    markInvalid(
      'kepalaDesa',
      elements.kepalaDesa,
      'Nama Kepala Desa wajib diisi (minimal 3 karakter).'
    );
  }

  if (alamatKantor.length < 10) {
    markInvalid(
      'alamatKantor',
      elements.alamatKantor,
      'Alamat Kantor Desa wajib diisi secara lengkap (minimal 10 karakter).'
    );
  }

  if (!emailDesa) {
    markInvalid('emailDesa', elements.emailDesa, 'Email Resmi Desa wajib diisi.');
  } else if (!EMAIL_PATTERN.test(emailDesa)) {
    markInvalid(
      'emailDesa',
      elements.emailDesa,
      'Format email tidak valid. Contoh: pemdes@mamujutengahkab.go.id'
    );
  }

  if (namaPendamping.length < 3) {
    markInvalid(
      'namaPendamping',
      elements.namaPendamping,
      'Nama Pendamping (Sekretaris) wajib diisi (minimal 3 karakter).'
    );
  }

  if (namaOperator.length < 3) {
    markInvalid(
      'namaOperator',
      elements.namaOperator,
      'Nama Operator wajib diisi (minimal 3 karakter).'
    );
  }

  PHONE_FIELDS.forEach(({ key, label }) => {
    const input = elements[key];
    const normalized = normalizePhone(input.value);
    if (!normalized) {
      markInvalid(key, input, `${label} wajib diisi.`);
    } else if (!PHONE_PATTERN.test(normalized)) {
      markInvalid(
        key,
        input,
        `Format ${label} tidak valid. Contoh: 081234567890`
      );
    }
  });

  const fileError = validateFile(state.selectedFile);
  if (fileError) {
    markInvalid('buktiTransfer', elements.buktiTransfer, fileError);
  }

  if (firstInvalidElement) {
    firstInvalidElement.focus();
    return false;
  }

  return true;
}

function isWebhookConfigured() {
  const url = APP_CONFIG.WEBHOOK_URL.trim();
  return (
    url.startsWith('https://') &&
    !url.includes('GANTI_DENGAN_ID_DEPLOYMENT_ANDA')
  );
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Gagal membaca file yang dipilih.'));
        return;
      }
      const commaIndex = reader.result.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Format hasil pembacaan file tidak valid.'));
        return;
      }
      resolve(reader.result.slice(commaIndex + 1));
    };
    reader.onerror = () => {
      reject(new Error('Terjadi kesalahan saat membaca file dari perangkat.'));
    };
    reader.readAsDataURL(file);
  });
}

function setSubmittingState(isSubmitting) {
  state.isSubmitting = isSubmitting;
  elements.submitBtn.disabled = isSubmitting;
  elements.submitBtn.classList.toggle('is-loading', isSubmitting);
  elements.submitBtn.querySelector('.btn-text').textContent = isSubmitting
    ? 'Mengirim Data & Mengunggah Bukti...'
    : 'Kirim Pendaftaran Desa';

  const controls = elements.form.querySelectorAll(
    'input, select, textarea, button'
  );
  controls.forEach((control) => {
    if (control === elements.submitBtn) return;
    if (control === elements.namaDesa) {
      control.disabled = isSubmitting || !elements.kecamatan.value;
      return;
    }
    control.disabled = isSubmitting;
  });
}

function showStatusAlert({ type, title, message, linkUrl, linkLabel }) {
  const alertEl = elements.statusAlert;
  alertEl.className = `alert is-${type}`;
  alertEl.innerHTML = '';

  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(svgNS, 'svg');
  icon.setAttribute('class', 'alert-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');

  if (type === 'success') {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'm9 12 2 2 4-4');
    icon.append(circle, path);
  } else {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    const line1 = document.createElementNS(svgNS, 'line');
    line1.setAttribute('x1', '12');
    line1.setAttribute('y1', '8');
    line1.setAttribute('x2', '12');
    line1.setAttribute('y2', '12');
    const line2 = document.createElementNS(svgNS, 'line');
    line2.setAttribute('x1', '12');
    line2.setAttribute('y1', '16');
    line2.setAttribute('x2', '12.01');
    line2.setAttribute('y2', '16');
    icon.append(circle, line1, line2);
  }

  const content = document.createElement('div');
  content.className = 'alert-content';

  const titleEl = document.createElement('p');
  titleEl.className = 'alert-title';
  titleEl.textContent = title;

  const messageEl = document.createElement('p');
  messageEl.className = 'alert-message';
  messageEl.textContent = message;

  content.append(titleEl, messageEl);

  if (linkUrl) {
    const link = document.createElement('a');
    link.className = 'alert-link';
    link.href = linkUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = linkLabel || 'Lihat file bukti transfer';
    content.appendChild(link);
  }

  alertEl.append(icon, content);
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideStatusAlert() {
  elements.statusAlert.className = 'alert is-hidden';
  elements.statusAlert.innerHTML = '';
}

async function submitToWebhook(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    APP_CONFIG.REQUEST_TIMEOUT_MS
  );

  try {
    // Gunakan text/plain agar browser tidak mengirim preflight OPTIONS ke Google Apps Script.
    const response = await fetch(APP_CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Server mengembalikan status HTTP ${response.status}. Pastikan deployment Web App aktif.`
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        'Respons server tidak berformat JSON yang valid. Periksa izin akses Web App (Anyone).'
      );
    }

    if (!data || data.result !== 'success') {
      throw new Error(
        (data && data.message) || 'Pendaftaran gagal diproses oleh server.'
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Waktu koneksi habis. Periksa koneksi internet Anda lalu coba kembali.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  hideStatusAlert();

  if (state.isSubmitting) {
    return;
  }

  if (!validateFormFields()) {
    return;
  }

  if (!isWebhookConfigured()) {
    showStatusAlert({
      type: 'error',
      title: 'URL Webhook Belum Dikonfigurasi',
      message:
        'Buka file frontend/app.js dan ganti WEBHOOK_URL dengan URL deployment Web App Google Apps Script Anda.',
    });
    return;
  }

  const submittedKecamatan = elements.kecamatan.value.trim();
  const submittedDesa = elements.namaDesa.value.trim();
  const file = state.selectedFile;

  setSubmittingState(true);

  try {
    const base64Data = await readFileAsBase64(file);
    const payload = {
      kecamatan: submittedKecamatan,
      namaDesa: submittedDesa,
      kepalaDesa: elements.kepalaDesa.value.trim(),
      hpKepalaDesa: normalizePhone(elements.hpKepalaDesa.value),
      alamatKantor: elements.alamatKantor.value.trim(),
      emailDesa: elements.emailDesa.value.trim(),
      namaPendamping: elements.namaPendamping.value.trim(),
      hpPendamping: normalizePhone(elements.hpPendamping.value),
      namaOperator: elements.namaOperator.value.trim(),
      hpOperator: normalizePhone(elements.hpOperator.value),
      file: {
        name: file.name,
        mimeType: resolveMimeType(file),
        size: file.size,
        base64: base64Data,
      },
    };

    const result = await submitToWebhook(payload);

    elements.form.reset();
    populateDesaDropdown('');
    resetSelectedFile();
    clearAllFieldErrors();

    showStatusAlert({
      type: 'success',
      title: 'Pendaftaran Berhasil Dikirim',
      message: `Data Desa ${submittedDesa} (Kecamatan ${submittedKecamatan}) dan bukti transfer telah tersimpan ke Google Sheets dan Google Drive.`,
      linkUrl: result.fileUrl || '',
      linkLabel: 'Buka bukti transfer di Google Drive',
    });
  } catch (error) {
    showStatusAlert({
      type: 'error',
      title: 'Pengiriman Data Gagal',
      message:
        error.message ||
        'Terjadi gangguan saat mengirim data. Silakan coba beberapa saat lagi.',
    });
  } finally {
    setSubmittingState(false);
  }
}

document.addEventListener('DOMContentLoaded', init);
