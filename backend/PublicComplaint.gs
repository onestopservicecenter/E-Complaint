const INTAKE_CHUNK_ = 4 * 1024 * 1024;
const INTAKE_MAX_AGE_ = 24 * 60 * 60 * 1000;
const INTAKE_REWARD_ = ['informant', 'payment', 'identityCopy', 'bankbook'];
const INTAKE_EVIDENCE_ = ['evidence1', 'evidence2', 'evidence3', 'evidence4', 'video'];
const INTAKE_TYPES_ = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',
  dxf: 'application/dxf', dwg: 'application/acad',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', amr: 'audio/amr',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  mpeg: 'video/mpeg', mpg: 'video/mpeg', avi: 'video/x-msvideo', '3gp': 'video/3gpp'
};

function intakeEnabled_() {
  const config = cfg_();
  return !!(prop_().getProperty('COMPLAINT_CASE_ROOT_ID') && config.contact && config.privacyText &&
    db_().getSheetByName('NPT2_PublicIntake'));
}

function intakeForCase_(id) {
  if (!db_().getSheetByName('NPT2_PublicIntake')) return null;
  return rows_('PublicIntake').find(row => row.caseId === id) || null;
}

function intakeDraft_(u, requestId) {
  if (!intakeEnabled_()) throw Error('ยังไม่ได้เปิดรับเรื่องผ่านเว็บไซต์');
  if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) throw Error('คำขอไม่ถูกต้อง');
  const key = hash_(u.sub + ':' + requestId);
  const row = rows_('PublicIntake').find(item => item.key === key);
  const committed = rows_('Cases').find(item => item.ownerSub === u.sub && item.requestId === requestId);
  if (committed) return {caseId: committed.id, committed: true};
  if (row && Date.now() - Date.parse(row.at) >= INTAKE_MAX_AGE_) {
    throw Error('การอัปโหลดหมดอายุ กรุณาโหลดหน้าใหม่แล้วส่งอีกครั้ง');
  }
  return row || {key, caseId: 'NPT-' + key.slice(0, 24).toUpperCase(), at: now_(), uploads: '{}'};
}

function intakeHeaders_(response, name) {
  const headers = response.getAllHeaders();
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : '';
}

function intakeDrive_(url, options) {
  return UrlFetchApp.fetch(url, {
    ...options, muteHttpExceptions: true, followRedirects: false,
    headers: {...options.headers, Authorization: 'Bearer ' + ScriptApp.getOAuthToken()}
  });
}

function intakeChild_(parent, name) {
  const matches = parent.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : parent.createFolder(name);
}

function intakeFileSpec_(d) {
  const slot = d.slot;
  const reward = INTAKE_REWARD_.includes(slot);
  if (!reward && !INTAKE_EVIDENCE_.includes(slot)) throw Error('ช่องแนบไฟล์ไม่ถูกต้อง');
  const name = text_(d.name, 180, 1);
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase();
  const mime = Object.prototype.hasOwnProperty.call(INTAKE_TYPES_, ext) ? INTAKE_TYPES_[ext] : '';
  if (!mime || (reward && mime !== 'application/pdf') || (slot !== 'video' && mime.startsWith('video/'))) {
    throw Error('ชนิดไฟล์ไม่รองรับสำหรับช่องนี้');
  }
  if (!Number.isInteger(d.size) || d.size < 1 || d.size > (slot === 'video' ? 100 : 10) * 1024 * 1024) {
    throw Error('ไฟล์ว่างหรือเกินขนาดของช่องแนบไฟล์');
  }
  if (typeof d.signature !== 'string' || !/^[a-f0-9]{64}$/.test(d.signature)) throw Error('รหัสตรวจสอบไฟล์ไม่ถูกต้อง');
  return {name, mime, size: d.size, signature: d.signature, reward};
}

function beginIntakeFile_(u, d) {
  const spec = intakeFileSpec_(d);
  if (spec.reward && (d.prosecution !== 'proceed' || d.reward !== 'yes')) {
    throw Error('แนบเอกสารขอรางวัลได้เมื่อเลือกดำเนินคดีและขอรางวัล');
  }
  const draft = intakeDraft_(u, d.requestId);
  if (draft.committed) return draft;
  const uploads = JSON.parse(draft.uploads);
  const previous = uploads[d.slot];
  if (previous && ['name', 'mime', 'size', 'signature'].every(k => previous[k] === spec[k])) {
    return {offset: previous.offset, fileId: previous.id || ''};
  }
  if (!draft.folderId) {
    const recent = rows_('PublicIntake').filter(row => row.ownerSub === u.sub &&
      thaiDay_(row.at) === thaiDay_(now_()));
    if (recent.length >= 10) throw Error('เริ่มยื่นเรื่องได้ไม่เกิน 10 เรื่องต่อวัน');
    const root = DriveApp.getFolderById(prop_().getProperty('COMPLAINT_CASE_ROOT_ID'));
    const folder = intakeChild_(root, draft.caseId);
    draft.folderId = folder.getId();
    draft.ownerSub = u.sub;
    add_('PublicIntake', draft);
    draft._row = db_().getSheetByName('NPT2_PublicIntake').getLastRow();
  }
  const folder = DriveApp.getFolderById(draft.folderId);
  const destination = intakeChild_(folder, spec.reward ? 'เอกสารขอรับรางวัล' : 'หลักฐานผู้ร้อง');
  const savedName = d.slot + '-' + spec.name;
  const response = intakeDrive_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id', {
    method: 'post', contentType: 'application/json',
    headers: {'X-Upload-Content-Type': spec.mime, 'X-Upload-Content-Length': String(spec.size)},
    payload: JSON.stringify({name: savedName, mimeType: spec.mime, parents: [destination.getId()]})
  });
  const url = intakeHeaders_(response, 'Location');
  if (response.getResponseCode() !== 200 || !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/.test(url)) {
    throw Error('เริ่มอัปโหลดไฟล์ไม่ได้ กรุณาลองอีกครั้ง');
  }
  uploads[d.slot] = {...spec, name: spec.name, url, offset: 0};
  draft.uploads = JSON.stringify(uploads);
  replace_('PublicIntake', draft._row, draft);
  if (previous?.id) trash_([previous]);
  return {offset: 0, fileId: ''};
}

function intakeUploadResult_(response, upload) {
  const code = response.getResponseCode();
  if (code === 200 || code === 201) {
    const id = JSON.parse(response.getContentText()).id;
    if (!/^[\w-]+$/.test(id || '')) throw Error('ไม่ได้รับรหัสไฟล์จาก Drive');
    upload.id = id;
    upload.offset = upload.size;
    delete upload.url;
  } else if (code === 308) {
    const end = /^bytes=0-(\d+)$/.exec(intakeHeaders_(response, 'Range'));
    upload.offset = end ? Number(end[1]) + 1 : 0;
  } else {
    throw Error('อัปโหลดไฟล์ไม่สำเร็จ กรุณากดส่งอีกครั้ง');
  }
}

function writeIntakeChunk_(u, d) {
  const draft = intakeDraft_(u, d.requestId);
  if (draft.committed) return draft;
  const uploads = JSON.parse(draft.uploads);
  const upload = Object.prototype.hasOwnProperty.call(uploads, d.slot) ? uploads[d.slot] : null;
  if (!upload) throw Error('ยังไม่ได้เริ่มอัปโหลดไฟล์');
  if (upload.id || d.offset !== upload.offset) return {offset: upload.offset, fileId: upload.id || ''};
  const bytes = Utilities.base64Decode(text_(d.base64, Math.ceil(INTAKE_CHUNK_ / 3) * 4, 1));
  const offset = upload.offset;
  const end = offset + bytes.length;
  if (bytes.length !== Math.min(INTAKE_CHUNK_, upload.size - offset)) throw Error('ข้อมูลไฟล์ไม่ครบ');
  if (offset === 0 && upload.mime === 'application/pdf' &&
      ![37, 80, 68, 70, 45].every((b, i) => bytes[i] === b)) throw Error('ไฟล์ PDF ไม่ถูกต้อง');
  const options = {method: 'put', contentType: 'application/octet-stream'};
  try {
    intakeUploadResult_(intakeDrive_(upload.url, {
      ...options, headers: {'Content-Range': 'bytes ' + offset + '-' + (end - 1) + '/' + upload.size},
      payload: bytes
    }), upload);
  } catch (error) {
    intakeUploadResult_(intakeDrive_(upload.url, {
      ...options, headers: {'Content-Range': 'bytes */' + upload.size}, payload: ''
    }), upload);
  }
  draft.uploads = JSON.stringify(uploads);
  replace_('PublicIntake', draft._row, draft);
  return {offset: upload.offset, fileId: upload.id || ''};
}

function submitPublicComplaint_(u, d) {
  const draft = intakeDraft_(u, d.requestId);
  if (draft.committed) return {id: draft.caseId};
  if (d.acknowledge !== true || !CATS_.includes(d.category) ||
      !['yes', 'no'].includes(d.notifyResult) || !['monitor', 'proceed'].includes(d.prosecution) ||
      (d.prosecution === 'proceed' && !['yes', 'no'].includes(d.reward))) {
    throw Error('กรุณาระบุข้อมูลและรับทราบคำแนะนำให้ครบถ้วน');
  }
  const wantsReward = d.prosecution === 'proceed' && d.reward === 'yes';
  if (wantsReward && (typeof d.nationalId !== 'string' || !/^[0-9]{13}$/.test(d.nationalId))) throw Error('กรุณาระบุเลขบัตรประชาชน 13 หลัก');
  const uploads = JSON.parse(draft.uploads);
  const selected = Array.isArray(d.slots) ? d.slots : [];
  const allowed = wantsReward ? [...INTAKE_EVIDENCE_, ...INTAKE_REWARD_] : INTAKE_EVIDENCE_;
  const required = wantsReward ? ['evidence1', ...INTAKE_REWARD_] : ['evidence1'];
  if (new Set(selected).size !== selected.length || selected.some(slot => !allowed.includes(slot) || !uploads[slot]?.id) ||
      required.some(slot => !selected.includes(slot))) throw Error('กรุณาแนบเอกสารที่จำเป็นให้ครบถ้วน');
  const fileFor = slot => {
    const {id, name, mime} = uploads[slot];
    return {id, name, mime, slot};
  };
  const name = text_(d.givenName, 60, 1) + ' ' + text_(d.familyName, 60, 1);
  const phone = text_(d.phone, 25, 8);
  if (!/^[0-9+() -]{8,25}$/.test(phone) || phone.replace(/[^0-9]/g, '').length < 8) throw Error('เบอร์โทรไม่ถูกต้อง');
  const location = text_(d.location, 500, 1);
  const info = {
    acknowledged: true, notifyResult: d.notifyResult, prosecution: d.prosecution, reward: wantsReward,
    address: text_(d.address || '', 500), road: text_(d.road || '', 120),
    village: text_(d.village || '', 30), subdistrict: text_(d.subdistrict, 100, 1),
    district: text_(d.district, 100, 1), province: text_(d.province, 100, 1)
  };
  const evidence = selected.filter(slot => INTAKE_EVIDENCE_.includes(slot)).map(fileFor);
  const restricted = wantsReward ? {nationalId: d.nationalId, files: INTAKE_REWARD_.map(fileFor)} : null;
  const subject = text_(d.subject, 200, 1);
  const details = text_(d.details, 10000, 20);
  const folder = DriveApp.getFolderById(draft.folderId);
  intakeChild_(folder, 'เอกสารภายใน');
  intakeChild_(folder, 'เอกสารตอบกลับ');
  const unused = Object.keys(uploads).filter(slot => !selected.includes(slot));
  replace_('PublicIntake', draft._row, {...draft, info: JSON.stringify(info), restricted: JSON.stringify(restricted)});
  try {
    add_('Cases', {
      id: draft.caseId, requestId: d.requestId, ownerSub: u.sub, email: u.email, category: d.category,
      subject, details, location, name, phone, evidence: JSON.stringify(evidence), at: now_(), deleted: false
    });
  } catch (error) {
    replace_('PublicIntake', draft._row, draft);
    throw error;
  }
  try {
    trash_(unused.map(slot => uploads[slot]).filter(file => file.id));
    replace_('PublicIntake', draft._row, {...draft, uploads: '{}', info: JSON.stringify(info), restricted: JSON.stringify(restricted)});
    audit_(u, 'submit-public-complaint', draft.caseId);
  } catch (error) { console.warn('Complaint post-save maintenance failed'); }
  return {id: draft.caseId};
}

function intakeStaffData_(u, id) {
  const row = intakeForCase_(id);
  if (!row || !row.info) return {};
  return {
    intake: JSON.parse(row.info),
    ...(u.role === 'admin' ? {rewardDocuments: JSON.parse(row.restricted || 'null')} : {})
  };
}

function intakePrivateFile_(u, id) {
  if (u.role !== 'admin' || !db_().getSheetByName('NPT2_PublicIntake')) return false;
  const record = rows_('PublicIntake').find(row =>
    JSON.parse(row.restricted || 'null')?.files.some(file => file.id === id));
  return !!record && rows_('Cases').some(c => c.id === record.caseId && !bool_(c.deleted));
}

function intakeFileChunk_(u, d) {
  const id = text_(d.id, 150, 1);
  allowedFile_(u, id, false);
  const size = DriveApp.getFileById(id).getSize();
  if (!Number.isInteger(d.offset) || d.offset < 0 || d.offset >= size) throw Error('ช่วงข้อมูลไฟล์ไม่ถูกต้อง');
  const end = Math.min(size, d.offset + INTAKE_CHUNK_) - 1;
  const response = intakeDrive_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', {
    method: 'get', headers: {Range: 'bytes=' + d.offset + '-' + end}
  });
  if (response.getResponseCode() !== 206 ||
      intakeHeaders_(response, 'Content-Range') !== 'bytes ' + d.offset + '-' + end + '/' + size) {
    throw Error('ดาวน์โหลดไฟล์ไม่สำเร็จ');
  }
  const bytes = response.getContent();
  if (bytes.length !== end - d.offset + 1) throw Error('ข้อมูลไฟล์ไม่ครบ');
  return {base64: Utilities.base64Encode(bytes)};
}

function purgeExpiredComplaintDrafts_() {
  return lock_(() => {
    const admin = cfg_().adminEmail;
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== admin) throw Error('เฉพาะผู้ดูแลระบบ');
    const ids = new Set(rows_('Cases').map(c => c.id));
    const drafts = rows_('PublicIntake').filter(row => row.folderId && !ids.has(row.caseId) &&
      Date.now() - Date.parse(row.at) >= INTAKE_MAX_AGE_);
    drafts.forEach(row => {
      DriveApp.getFolderById(row.folderId).setTrashed(true);
      replace_('PublicIntake', row._row, {...row, folderId: '', uploads: '{}', info: '', restricted: ''});
    });
    return drafts.length;
  });
}

function installComplaintDraftCleanup() {
  const admin = cfg_().adminEmail;
  if (Session.getActiveUser().getEmail().toLowerCase() !== admin ||
      Session.getEffectiveUser().getEmail().toLowerCase() !== admin) throw Error('เฉพาะผู้ดูแลระบบ');
  return lock_(() => {
    const handler = 'purgeExpiredComplaintDrafts_';
    if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === handler)) {
      ScriptApp.newTrigger(handler).timeBased().everyDays(1).create();
    }
  });
}
