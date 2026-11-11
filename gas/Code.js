const GAS_CONFIG = {
  // Kosongkan agar selalu menulis ke sheet yang sedang aktif; atau isi nama sheet spesifik jika diperlukan.
  SHEET_NAME: '',
  // Opsional: isi ID folder Google Drive tujuan; jika kosong akan otomatis memakai/membuat folder DEFAULT_FOLDER_NAME.
  DRIVE_FOLDER_ID: '',
  DEFAULT_FOLDER_NAME: 'Bukti Transfer Pendaftaran Desa - Mamuju Tengah',
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  LOCK_TIMEOUT_MS: 30000,
  TIMEZONE: 'Asia/Makassar',
};

const SHEET_HEADERS = [
  'Timestamp',
  'Kecamatan',
  'Nama Desa',
  'Nama Kepala Desa',
  'No. HP Kepala Desa',
  'Alamat Kantor Desa',
  'Email Resmi Desa',
  'Nama Pendamping (Sekretaris)',
  'No. HP Pendamping (Sekretaris)',
  'Nama Operator',
  'No. HP Operator',
  'Link File Google Drive',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Endpoint GET untuk memverifikasi status aktif Web App.
 */
function doGet() {
  return createJsonResponse_({
    result: 'success',
    status: 'active',
    message: 'Webhook Formulir Pendaftaran Desa Kabupaten Mamuju Tengah siap menerima data.',
  });
}

/**
 * Endpoint POST untuk menerima data pendaftaran desa dan bukti transfer (JSON + Base64).
 * Menggunakan LockService agar penulisan ke Drive dan Sheet bebas race condition.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    try {
      lock.waitLock(GAS_CONFIG.LOCK_TIMEOUT_MS);
    } catch (lockError) {
      return createJsonResponse_({
        result: 'error',
        message: 'Server sedang sibuk memproses antrean. Silakan kirim ulang beberapa saat lagi.',
      });
    }

    const payload = parseRequestPayload_(e);
    const validatedData = validatePayload_(payload);

    // Validasi akses sheet terlebih dahulu sebelum mengunggah file ke Drive.
    const sheet = getTargetSheet_();
    const fileUrl = saveTransferProofToDrive_(validatedData);
    const timestamp = Utilities.formatDate(
      new Date(),
      GAS_CONFIG.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    );

    ensureSheetHeaders_(sheet);
    sheet.appendRow([
      timestamp,
      validatedData.kecamatan,
      validatedData.namaDesa,
      validatedData.kepalaDesa,
      formatPhoneForSheet_(validatedData.hpKepalaDesa),
      validatedData.alamatKantor,
      validatedData.emailDesa,
      validatedData.namaPendamping,
      formatPhoneForSheet_(validatedData.hpPendamping),
      validatedData.namaOperator,
      formatPhoneForSheet_(validatedData.hpOperator),
      fileUrl,
    ]);

    return createJsonResponse_({
      result: 'success',
      message: 'Data pendaftaran desa dan bukti transfer berhasil disimpan.',
      timestamp: timestamp,
      fileUrl: fileUrl,
    });
  } catch (error) {
    return createJsonResponse_({
      result: 'error',
      message: error.message || 'Terjadi kesalahan saat memproses pendaftaran.',
    });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Mengurai body JSON dari request POST.
 */
function parseRequestPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Payload request kosong atau tidak valid.');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (parseError) {
    throw new Error('Format body request harus berupa JSON yang valid.');
  }
}

/**
 * Memvalidasi seluruh field wajib serta tipe dan ukuran file bukti transfer.
 */
function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Struktur data pendaftaran tidak valid.');
  }

  const kecamatan = sanitizeText_(payload.kecamatan);
  const namaDesa = sanitizeText_(payload.namaDesa);
  const kepalaDesa = sanitizeText_(payload.kepalaDesa);
  const hpKepalaDesa = sanitizeText_(payload.hpKepalaDesa);
  const alamatKantor = sanitizeText_(payload.alamatKantor);
  const emailDesa = sanitizeText_(payload.emailDesa);
  const namaPendamping = sanitizeText_(payload.namaPendamping);
  const hpPendamping = sanitizeText_(payload.hpPendamping);
  const namaOperator = sanitizeText_(payload.namaOperator);
  const hpOperator = sanitizeText_(payload.hpOperator);

  if (!kecamatan) throw new Error('Kecamatan wajib diisi.');
  if (!namaDesa) throw new Error('Nama Desa wajib diisi.');
  if (!kepalaDesa) throw new Error('Nama Kepala Desa wajib diisi.');
  if (!hpKepalaDesa) {
    throw new Error('No. HP Kepala Desa wajib diisi.');
  }
  if (!alamatKantor) throw new Error('Alamat Kantor Desa wajib diisi.');
  if (!emailDesa || !EMAIL_REGEX.test(emailDesa)) {
    throw new Error('Format Email Resmi Desa tidak valid.');
  }
  if (!namaPendamping) {
    throw new Error('Nama Pendamping (Sekretaris) wajib diisi.');
  }
  if (!hpPendamping) {
    throw new Error('No. HP Pendamping (Sekretaris) wajib diisi.');
  }
  if (!namaOperator) {
    throw new Error('Nama Operator wajib diisi.');
  }
  if (!hpOperator) {
    throw new Error('No. HP Operator wajib diisi.');
  }

  const file = payload.file;
  if (!file || typeof file !== 'object' || !file.base64 || !file.name) {
    throw new Error('File bukti transfer wajib dilampirkan.');
  }

  const normalizedMime = normalizeMimeType_(file.mimeType, file.name);
  if (!GAS_CONFIG.ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    throw new Error('Format file tidak diizinkan. Gunakan JPG, JPEG, PNG, atau PDF.');
  }

  const rawBase64 = String(file.base64).replace(/^data:[^;]+;base64,/i, '').trim();
  if (!rawBase64) {
    throw new Error('Konten file base64 kosong.');
  }

  const decodedBytes = Utilities.base64Decode(rawBase64);
  if (decodedBytes.length === 0) {
    throw new Error('File tidak valid atau berukuran 0 byte.');
  }
  if (decodedBytes.length > GAS_CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error('Ukuran file melebihi batas maksimal 10 MB.');
  }

  return {
    kecamatan: kecamatan,
    namaDesa: namaDesa,
    kepalaDesa: kepalaDesa,
    hpKepalaDesa: hpKepalaDesa,
    alamatKantor: alamatKantor,
    emailDesa: emailDesa,
    namaPendamping: namaPendamping,
    hpPendamping: hpPendamping,
    namaOperator: namaOperator,
    hpOperator: hpOperator,
    fileBytes: decodedBytes,
    fileMimeType: normalizedMime,
    originalFileName: String(file.name),
  };
}

/**
 * Mendecode file dan menyimpannya ke Google Drive dengan izin akses publik view.
 */
function saveTransferProofToDrive_(data) {
  const folder = getOrCreateTargetFolder_();
  const timestampSlug = Utilities.formatDate(
    new Date(),
    GAS_CONFIG.TIMEZONE,
    'yyyyMMdd-HHmmss'
  );
  const safeFileName = sanitizeFileName_(
    `${data.kecamatan}_${data.namaDesa}_${timestampSlug}_${data.originalFileName}`
  );

  const blob = Utilities.newBlob(data.fileBytes, data.fileMimeType, safeFileName);
  const uploadedFile = folder.createFile(blob);

  uploadedFile.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  return uploadedFile.getUrl();
}

/**
 * Mengambil folder tujuan Drive berdasarkan ID, atau membuat folder default jika belum ada.
 */
function getOrCreateTargetFolder_() {
  if (GAS_CONFIG.DRIVE_FOLDER_ID) {
    return DriveApp.getFolderById(GAS_CONFIG.DRIVE_FOLDER_ID);
  }

  const existingFolders = DriveApp.getFoldersByName(GAS_CONFIG.DEFAULT_FOLDER_NAME);
  if (existingFolders.hasNext()) {
    return existingFolders.next();
  }

  return DriveApp.createFolder(GAS_CONFIG.DEFAULT_FOLDER_NAME);
}

/**
 * Mengambil sheet aktif atau sheet sesuai konfigurasi.
 */
function getTargetSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'Apps Script harus terikat ke Google Sheets (Extensions -> Apps Script).'
    );
  }

  if (GAS_CONFIG.SHEET_NAME) {
    return (
      spreadsheet.getSheetByName(GAS_CONFIG.SHEET_NAME) ||
      spreadsheet.insertSheet(GAS_CONFIG.SHEET_NAME)
    );
  }

  return spreadsheet.getActiveSheet();
}

/**
 * Menambahkan baris header otomatis jika sheet masih kosong.
 */
function ensureSheetHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function normalizeMimeType_(mimeType, fileName) {
  const lowerMime = String(mimeType || '').toLowerCase().trim();
  if (lowerMime === 'image/jpg') return 'image/jpeg';
  if (GAS_CONFIG.ALLOWED_MIME_TYPES.includes(lowerMime)) return lowerMime;

  const lowerName = String(fileName || '').toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  return '';
}

function sanitizeText_(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatPhoneForSheet_(phone) {
  // Awalan apostrof menjaga angka 0 di depan dan simbol + agar tetap tersimpan sebagai teks di Sheets.
  return phone ? `'${phone}` : '';
}

function sanitizeFileName_(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
}

function createJsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
