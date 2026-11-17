/**
 * E-Complaint public intake (separate Apps Script project).
 * Deploy as Web App: execute as owner, access anyone.
 * Never place citizen evidence in a folder shared to "anyone with link".
 * Run setupIntake() in the Apps Script editor AFTER fixing folder permissions.
 */
const INTAKE = Object.freeze({
  ROOT: '12I80r9jyMUqTSe63VYQHGRc_ok6dH5tO',
  REWARD: '1t6GC0JI-_EidfYd_GjnjAzg8Y1IBNF0L',
  NO_REWARD: '1MpWPCtJa5yZmHlwK_n_AOmPpkPKLaERC',
  GOOGLE_CLIENT_ID: 'SET_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
  SHEET_PROP: 'INTAKE_SPREADSHEET_ID',
  TZ: 'Asia/Bangkok',
  REQUIRED_OWNER_EMAIL: 'ossc73@gmail.com',
  HEADERS: ['เลขรับเรื่อง','วันที่บันทึก','สินบนนำจับ','บัญชีผู้ยื่น','ชื่อผู้ยื่น','โทรศัพท์','เรื่อง','สถานที่','รายละเอียด','แจ้งผล','สถานะ','โฟลเดอร์','clientNonce','หลักฐาน_JSON','วันที่ยื่นสำเร็จ']
});
const REQUIRED_REWARD_DOCS = []; // The latest reward-intent form requires an identity-card image instead of four PDFs.

function doGet(e) {
  const intent = (e && e.parameter && e.parameter.intent) === 'reward' ? 'reward' : 'no-reward';
  const staff = e && e.parameter && e.parameter.view === 'staff';
  const citizen = e && e.parameter && e.parameter.view === 'citizen';
  const t = HtmlService.createTemplateFromFile(staff ? 'Staff' : citizen ? 'CitizenStatus' : intent === 'reward' ? 'Reward' : 'Intake');
  t.intent = intent;
  t.clientId = INTAKE.GOOGLE_CLIENT_ID;
  return t.evaluate().setTitle('แจ้งข้อร้องเรียน | สสจ.นครปฐม')
    .addMetaTag('viewport','width=device-width,initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
function setupIntake() {
  assertPrivateFolders_();
  if (INTAKE.GOOGLE_CLIENT_ID.startsWith('SET_')) throw Error('โปรดกำหนด GOOGLE_CLIENT_ID');
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(INTAKE.SHEET_PROP)) {
    const existing=SpreadsheetApp.openById(props.getProperty(INTAKE.SHEET_PROP));
    ensureAuditSheet_(existing);
    ensureResponsesSheet_(existing);
    ensureSubmissionColumn_(existing.getSheetByName('Cases'));
    return 'ตั้งค่าฐานข้อมูล Audit Log และระบบแจ้งผลแล้ว';
  }
  const ss = SpreadsheetApp.create('E-Complaint Intake Registry - Confidential');
  const sh = ss.getSheets()[0];
  sh.setName('Cases'); sh.appendRow(INTAKE.HEADERS);
  sh.setFrozenRows(1);
  ensureSubmissionColumn_(sh);
  ensureAuditSheet_(ss);
  ensureResponsesSheet_(ss);
  props.setProperty(INTAKE.SHEET_PROP, ss.getId());
  return ss.getUrl();
}
function verifyProductionOwnership_() {
  const effective=(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(effective!==INTAKE.REQUIRED_OWNER_EMAIL)
    throw Error('ไม่อนุญาตให้รับเรื่อง: Apps Script ต้องดำเนินการด้วยบัญชีกลางของหน่วยงาน');
  for (const id of [INTAKE.ROOT,INTAKE.REWARD,INTAKE.NO_REWARD]) {
    const folder=DriveApp.getFolderById(id);
    const owner=folder.getOwner();
    if(!owner||owner.getEmail().toLowerCase()!==INTAKE.REQUIRED_OWNER_EMAIL)
      throw Error('ไม่อนุญาตให้รับเรื่อง: โฟลเดอร์ Production ยังไม่ได้เป็นของบัญชีกลาง');
  }
}
function checkDeploymentReadiness() {
  // Run manually in Apps Script editor using the intended production owner.
  // Throws safely before any live complaint is accepted.
  verifyProductionOwnership_();
  assertPrivateFolders_();
  if(INTAKE.GOOGLE_CLIENT_ID.startsWith('SET_'))throw Error('ยังไม่มี Google OAuth Client ID');
  if(!PropertiesService.getScriptProperties().getProperty(INTAKE.SHEET_PROP))
    throw Error('ยังไม่ได้สร้างทะเบียนคำร้อง');
  return 'ผ่านการตรวจบัญชีเจ้าของ โฟลเดอร์ส่วนตัว และทะเบียน แต่ยังต้องทดสอบ Google Login และสิทธิ์ Staff แบบ end-to-end';
}
function assertPrivateFolders_() {
  verifyProductionOwnership_();
  const root = DriveApp.getFolderById(INTAKE.ROOT);
  const checked = new Set();
  // Check all ancestor folders too: a shared ancestor may expose inherited child data.
  function checkAncestors(folder,depth) {
    if(depth>25) throw Error('ไม่สามารถยืนยันสิทธิ์โฟลเดอร์ระดับบนได้');
    if(checked.has(folder.getId())) return;
    checked.add(folder.getId());
    if(folder.getSharingAccess() !== DriveApp.Access.PRIVATE) {
      throw Error('ยังไม่สามารถเปิดรับข้อมูล: โฟลเดอร์ร้องเรียนหรือโฟลเดอร์ระดับบนเปิดสิทธิ์สาธารณะ');
    }
    const parents=folder.getParents();
    while(parents.hasNext()) checkAncestors(parents.next(),depth+1);
  }
  for (const id of [INTAKE.ROOT, INTAKE.REWARD, INTAKE.NO_REWARD]) checkAncestors(DriveApp.getFolderById(id),0);
  for (const id of [INTAKE.REWARD, INTAKE.NO_REWARD]) {
    const parents=DriveApp.getFolderById(id).getParents();
    let isChild=false;
    while(parents.hasNext()) if(parents.next().getId()===root.getId()) isChild=true;
    if(!isChild) throw Error('โครงสร้างโฟลเดอร์ร้องเรียนไม่ถูกต้อง');
  }
}
function ensureSubmissionColumn_(sh) {
  if(!sh)throw Error('ไม่พบทะเบียน Cases');
  if(sh.getRange(1,15).getValue() !== 'วันที่ยื่นสำเร็จ') {
    if(sh.getRange(1,15).getValue()) throw Error('คอลัมน์ 15 ถูกใช้งานอยู่ ตรวจสอบก่อนย้ายข้อมูล');
    sh.getRange(1,15).setValue('วันที่ยื่นสำเร็จ');
  }
}
function caseDate_(date) {
  return Utilities.formatDate(date,INTAKE.TZ,'yyyy-MM-dd');
}
/* Date hierarchy is created only after public-folder checks and inside the same lock as case creation. */
function privateDatedFolder_(parent,date) {
  const name=caseDate_(date);
  const existing=parent.getFoldersByName(name);
  const folder=existing.hasNext()?existing.next():parent.createFolder(name);
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('โฟลเดอร์วันที่มีการแชร์สาธารณะ');
  return folder;
}
function sheet_() {
  const id=PropertiesService.getScriptProperties().getProperty(INTAKE.SHEET_PROP);
  if(!id) throw Error('Backend ยังไม่ได้ตั้งค่า กรุณาเรียก setupIntake() ก่อน');
  return SpreadsheetApp.openById(id).getSheetByName('Cases');
}
/**
 * Append-only operational audit entries, separate from complaint details.
 * Never include token, password, identity-card number, request body or evidence in logs.
 * Email is derived only from a verified identity token, never user-entered input.
 * Audits reside in the private owner spreadsheet; grant no citizen spreadsheet access.
 */
function ensureAuditSheet_(ss) {
  let sh=ss.getSheetByName('AuditLog');
  if(!sh) {
    sh=ss.insertSheet('AuditLog');
    sh.appendRow(['เวลาบันทึก','การกระทำ','เลขรับเรื่อง','ผู้กระทำ (บัญชียืนยัน)','บทบาท','ผลลัพธ์']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function writeAudit_(action,caseId,actor,role,outcome) {
  const allowed=new Set(['CASE_DRAFT_CREATED','CASE_SUBMITTED','CITIZEN_STATUS_VIEW',
    'STAFF_CASE_LIST','STAFF_CASE_VIEW','STAFF_EVIDENCE_DOWNLOAD',
    'STAFF_CASE_STATUS_UPDATE','CITIZEN_REPLY_VIEW','STAFF_DAILY_SUMMARY']);
  if(!allowed.has(action)) throw Error('Audit event ไม่ได้รับอนุญาต');
  const sh=ensureAuditSheet_(sheet_().getParent());
  sh.appendRow([new Date(),action,caseId||'',sheetText_(actor||''),role,outcome||'SUCCESS']);
}
function ensureResponsesSheet_(ss) {
  let sh=ss.getSheetByName('CaseResponses');
  if(!sh){
    sh=ss.insertSheet('CaseResponses');
    sh.appendRow(['เลขรับเรื่อง','แก้ไขเมื่อ','สถานะ','ผลดำเนินการสำหรับผู้ร้อง','บัญชีเจ้าหน้าที่ผู้บันทึก']);
    sh.setFrozenRows(1);
  }
  return sh;
}
function findResponseRow_(sh,caseId) {
  const last=sh.getLastRow();
  if(last<2)return 0;
  const values=sh.getRange(2,1,last-1,1).getValues();
  const index=values.findIndex(row=>String(row[0])===caseId);
  return index<0?0:index+2;
}
function safeResponse_(record) {
  if(!record)return null;
  return {status:String(record[2]),message:String(record[3]||''),
    updatedAt:record[1] instanceof Date?record[1].toISOString():String(record[1])};
}
function identity_(token) {
  if (INTAKE.GOOGLE_CLIENT_ID.startsWith('SET_')) throw Error('ยังไม่ได้ตั้งค่า Google Login');
  if(!token || String(token).length>5000) throw Error('กรุณาเข้าสู่ระบบ Google');
  const url='https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token);
  const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if(res.getResponseCode()!==200) throw Error('เข้าสู่ระบบ Google ไม่สำเร็จ');
  const v=JSON.parse(res.getContentText());
  if(v.aud!==INTAKE.GOOGLE_CLIENT_ID || !['accounts.google.com','https://accounts.google.com'].includes(v.iss) ||
    Number(v.exp)*1000<=Date.now() || String(v.email_verified)!=='true' || !v.email)
    throw Error('ไม่สามารถตรวจสอบตัวตน Google ได้');
  return v.email.toLowerCase();
}
function cleaned_(value,max) { return String(value||'').trim().slice(0,max); }
function sheetText_(value) { const s=String(value||''); return /^[=+\-@]/.test(s)?"'"+s:s; }
function exactIntent_(intent) {
  if(!['reward','no-reward'].includes(intent)) throw Error('ประเภทการร้องเรียนไม่ถูกต้อง');
  return intent;
}
function findCase_(sh,id) {
  const last=sh.getLastRow();
  if(last<2) throw Error('ไม่พบเลขรับเรื่อง');
  const cells=sh.getRange(2,1,last-1,1).getValues();
  const idx=cells.findIndex(row=>row[0]===id);
  if(idx<0) throw Error('ไม่พบเลขรับเรื่อง');
  return {row:idx+2,data:sh.getRange(idx+2,1,1,14).getValues()[0]};
}
function startComplaint(input) {
  const email=identity_(input&&input.idToken);
  const intent=exactIntent_(input.intent);
  const name=cleaned_(input.name,150),phone=cleaned_(input.phone,30),
    subject=cleaned_(input.subject,200),place=cleaned_(input.place,500),
    details=cleaned_(input.details,8000),nationalId=cleaned_(input.nationalId,13),
    age=cleaned_(input.age,3),issuer=cleaned_(input.issuer,250),
    replyDetails=cleaned_(input.replyDetails,1000),
    address=cleaned_(input.address,1000),contactAddress=cleaned_(input.contactAddress,1000),
    altEmail=cleaned_(input.altEmail,255),lineId=cleaned_(input.lineId,100),
    desiredAction=cleaned_(input.desiredAction,3000),eventDate=cleaned_(input.eventDate,20);
  if(!name||!subject||!place||!details||!phone) throw Error('กรุณากรอกข้อมูลจำเป็นให้ครบถ้วน');
  if(intent==='reward') {
    if(!input.acceptTerms) throw Error('กรุณายอมรับข้อตกลงและหลักเกณฑ์');
    if(!/^\d{13}$/.test(nationalId)) throw Error('กรุณากรอกเลขบัตรประชาชน 13 หลัก');
    if(!address || !contactAddress || !issuer || !eventDate || !desiredAction) throw Error('กรุณากรอกข้อมูลร้องเรียนให้ครบถ้วน');
    if(age && (!/^\d{1,3}$/.test(age)||Number(age)>120)) throw Error('อายุไม่ถูกต้อง');
    if(altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(altEmail)) throw Error('รูปแบบอีเมลไม่ถูกต้อง');
  }
  const nonce=cleaned_(input.nonce,80);
  if(!/^[a-f0-9-]{16,80}$/i.test(nonce)) throw Error('ข้อมูลคำขอไม่ถูกต้อง');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    assertPrivateFolders_();
    const sh=sheet_(), last=sh.getLastRow();
    if(last>1) {
      const values=sh.getRange(2,13,last-1,1).getValues();
      const ix=values.findIndex(v=>v[0]===nonce);
      if(ix>=0) {
        const data=sh.getRange(ix+2,1,1,14).getValues()[0];
        if(data[3]!==email) throw Error('คำขอนี้ไม่ใช่ของบัญชีที่เข้าสู่ระบบ');
        return {caseId:data[0],status:data[10]};
      }
    }
    const now=new Date();
    const caseId='NPT-'+Utilities.formatDate(now,INTAKE.TZ,'yyyyMMdd')+
      '-'+Utilities.getUuid().slice(0,8).toUpperCase();
    const parent=DriveApp.getFolderById(intent==='reward'?INTAKE.REWARD:INTAKE.NO_REWARD);
    const datedFolder=privateDatedFolder_(parent,now);
    const folder=datedFolder.createFolder(caseId);
    // Personal data is written only after permissions have been verified.
    const payload={caseId,createdAt:new Date().toISOString(),intent,email,name,phone,
      subject,place,details,nationalId:intent==='reward'?nationalId:null,
      age,issuer,address,contactAddress,altEmail,lineId,desiredAction,eventDate,replyDetails,
      acceptTerms:intent==='reward'?true:!!input.acceptTerms,
      wantsReply:input.wantsReply==='yes'};
    folder.createFile(Utilities.newBlob(JSON.stringify(payload,null,2),'application/json','คำร้อง.json'));
    sh.appendRow([caseId,new Date(),intent,email,sheetText_(name),sheetText_(phone),sheetText_(subject),sheetText_(place),sheetText_(details),
      input.wantsReply==='yes'?'ต้องการแจ้งผล':'ไม่ต้องการแจ้งผล','DRAFT',folder.getId(),nonce,'{}']);
    writeAudit_('CASE_DRAFT_CREATED',caseId,email,'CITIZEN','SUCCESS');
    return {caseId,status:'DRAFT'};
  } finally {lock.releaseLock(); }
}
function uploadEvidence(input) {
  const email=identity_(input&&input.idToken), id=cleaned_(input.caseId,50);
  const kind=cleaned_(input.kind,30),b64=String(input.base64||'');
  const kinds=['image','video','identityCard','evidence',...REQUIRED_REWARD_DOCS];
  if(!kinds.includes(kind)) throw Error('ชนิดไฟล์ไม่ถูกต้อง');
  const mime=cleaned_(input.mime,100).toLowerCase();
  const maxBytes=10*1024*1024;
  if(b64.length>Math.ceil(maxBytes*4/3)+16||!b64||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))
    throw Error('ไฟล์ใหญ่เกินขนาดที่กำหนด หรือไฟล์ไม่ถูกต้อง');
  const bytes=Utilities.base64Decode(b64);
  if(bytes.length>maxBytes) throw Error('ไฟล์ใหญ่เกินขนาดที่กำหนด');
  const first=bytes.slice(0,12).map(n=>n&255);
  const isPDF=first.slice(0,5).join(',')==='37,80,68,70,45';
  const isPNG=first.slice(0,4).join(',')==='137,80,78,71';
  const isJPG=first.slice(0,3).join(',')==='255,216,255';
  const isWEBP=String.fromCharCode(...first.slice(0,4))==='RIFF' && String.fromCharCode(...first.slice(8,12))==='WEBP';
  const isMP4=String.fromCharCode(...first.slice(4,8))==='ftyp';
  const isWAV=String.fromCharCode(...first.slice(0,4))==='RIFF' && String.fromCharCode(...first.slice(8,12))==='WAVE';
  const isMP3=first.slice(0,3).join(',')==='73,68,51'||(first[0]===255&&(first[1]&224)===224);
  const isOGG=String.fromCharCode(...first.slice(0,4))==='OggS';
  const imageValid=(mime==='image/jpeg'&&isJPG)||(mime==='image/png'&&isPNG)||(mime==='image/webp'&&isWEBP);
  const videoValid=mime==='video/mp4'&&isMP4;
  const documentValid=mime==='application/pdf'&&isPDF;
  const audioValid=(mime==='audio/mpeg'&&isMP3)||(mime==='audio/wav'&&isWAV)||(mime==='audio/ogg'&&isOGG);
  const valid=kind==='identityCard'||kind==='image'?imageValid:
    kind==='video'?videoValid:kind==='evidence'?(imageValid||videoValid||documentValid||audioValid):documentValid;
  if(!valid) throw Error('รูปแบบไฟล์ไม่ตรงตามที่กำหนด');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    assertPrivateFolders_();
    const sh=sheet_(),found=findCase_(sh,id),row=found.data;
    if(row[3]!==email||row[10]!=='DRAFT') throw Error('ไม่สามารถเพิ่มหลักฐานให้เรื่องนี้ได้');
    if(kind!=='image'&&kind!=='video'&&row[2]!=='reward') throw Error('ไม่มีสิทธิ์แนบเอกสารสินบนนำจับ');
    const uploads=JSON.parse(row[13]||'{}'),arr=uploads[kind]||[];
    if(arr.length>=(kind==='image'||kind==='evidence'?5:1)) throw Error('จำนวนไฟล์ชนิดนี้ครบแล้ว');
    const extByMime={'image/jpeg':'jpg','image/png':'png','image/webp':'webp',
      'video/mp4':'mp4','application/pdf':'pdf','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg'};
    const extension=extByMime[mime];
    const filename=kind+'-'+(arr.length+1)+'.'+extension;
    const folder=DriveApp.getFolderById(row[11]);
    const file=folder.createFile(Utilities.newBlob(bytes,mime,filename));
    arr.push({fileId:file.getId(),name:filename,size:bytes.length});
    uploads[kind]=arr;
    sh.getRange(found.row,14).setValue(JSON.stringify(uploads));
    return {caseId:id,kind,uploaded:arr.length};
  } finally {lock.releaseLock(); }
}
function finishComplaint(input) {
  const email=identity_(input&&input.idToken),id=cleaned_(input.caseId,50);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    assertPrivateFolders_();
    const sh=sheet_(),found=findCase_(sh,id),row=found.data;
    if(row[3]!==email) throw Error('ไม่สามารถดำเนินการกับเรื่องนี้ได้');
    if(row[10]==='SUBMITTED') return {caseId:id,status:'SUBMITTED'};
    if(row[10]!=='DRAFT') throw Error('สถานะเรื่องไม่ถูกต้อง');
    const files=JSON.parse(row[13]||'{}');
    if(row[2]==='reward' && (!files.identityCard || files.identityCard.length!==1))
      throw Error('กรุณาแนบสำเนาบัตรประชาชน 1 รูป');
    const submittedAt=new Date();
    ensureSubmissionColumn_(sh);
    sh.getRange(found.row,11).setValue('SUBMITTED');
    sh.getRange(found.row,15).setValue(submittedAt);
    writeAudit_('CASE_SUBMITTED',id,email,'CITIZEN','SUCCESS');
    return {caseId:id,status:'SUBMITTED'};
  }finally{lock.releaseLock();}
}
function myComplaintStatus(input) {
  const email=identity_(input&&input.idToken),found=findCase_(sheet_(),cleaned_(input.caseId,50));
  if(found.data[3]!==email) throw Error('ไม่สามารถดูข้อมูลเรื่องนี้ได้');
  const replies=ensureResponsesSheet_(sheet_().getParent());
  const index=findResponseRow_(replies,found.data[0]);
  const response=index?safeResponse_(replies.getRange(index,1,1,5).getValues()[0]):null;
  writeAudit_('CITIZEN_STATUS_VIEW',found.data[0],email,'CITIZEN','SUCCESS');
  if(response)writeAudit_('CITIZEN_REPLY_VIEW',found.data[0],email,'CITIZEN','SUCCESS');
  return {caseId:found.data[0],status:found.data[10],
    submittedAt:found.data[1] instanceof Date?found.data[1].toISOString():String(found.data[1]),
    response};
}

/**
 * Authorized staff read-only dashboard.
 * Set STAFF_EMAILS script property with a comma-separated list of approved work emails.
 * Access is denied by default. The web app runs as the owner, never as the citizen.
 */
function staffIdentity_(token) {
  const email=identity_(token);
  const configured=PropertiesService.getScriptProperties().getProperty('STAFF_EMAILS')||'';
  const allowed=configured.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!allowed.includes(email)) throw Error('บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลร้องเรียน');
  return email;
}
function staffComplaintList(input) {
  const actor=staffIdentity_(input&&input.idToken);
  const sh=sheet_();
  const last=sh.getLastRow();
  writeAudit_('STAFF_CASE_LIST','',actor,'STAFF','SUCCESS');
  if(last<2)return [];
  const rows=sh.getRange(Math.max(2,last-199),1,Math.min(198,last-1),14).getValues();
  return rows.reverse().filter(r=>r[10]!=='DRAFT').map(r=>({
    caseId:String(r[0]),createdAt:r[1] instanceof Date?r[1].toISOString():String(r[1]),
    intent:r[2],name:r[4],subject:r[6],status:r[10]
  }));
}
function staffComplaintDetail(input) {
  const actor=staffIdentity_(input&&input.idToken);
  const sh=sheet_(),found=findCase_(sh,cleaned_(input.caseId,50));
  const row=found.data;
  if(row[10]==='DRAFT')throw Error('เรื่องร้องเรียนนี้ยังไม่ได้ส่ง');
  assertPrivateFolders_();
  const folder=DriveApp.getFolderById(row[11]);
  const files=folder.getFilesByName('คำร้อง.json');
  if(!files.hasNext())throw Error('ไม่พบข้อมูลรายละเอียดคำร้อง');
  const record=JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
  writeAudit_('STAFF_CASE_VIEW',row[0],actor,'STAFF','SUCCESS');
  return {caseId:row[0],status:row[10],createdAt:row[1] instanceof Date?row[1].toISOString():String(row[1]),
    record,evidence:JSON.parse(row[13]||'{}')};
}
function staffComplaintFile(input) {
  const actor=staffIdentity_(input&&input.idToken);
  const found=findCase_(sheet_(),cleaned_(input.caseId,50)),row=found.data;
  if(row[10]==='DRAFT')throw Error('เรื่องร้องเรียนยังไม่ได้ส่ง');
  assertPrivateFolders_();
  const fileId=cleaned_(input.fileId,150);
  const uploads=JSON.parse(row[13]||'{}');
  const belongs=Object.keys(uploads).some(k=>(uploads[k]||[]).some(v=>v.fileId===fileId));
  if(!belongs)throw Error('ไฟล์นี้ไม่ใช่หลักฐานของเรื่องร้องเรียน');
  const f=DriveApp.getFileById(fileId);
  const blob=f.getBlob();
  if(blob.getBytes().length>10*1024*1024)throw Error('ไฟล์เกินขนาดที่กำหนด');
  writeAudit_('STAFF_EVIDENCE_DOWNLOAD',row[0],actor,'STAFF','SUCCESS');
  return {name:f.getName(),mime:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())};
}

/**
 * Staff response workflow (test-only until staff username/password and production owner are configured).
 * Never sends Gmail or files; citizen must sign in with the original verified Google account.
 * Only a short case outcome belongs here; no identity numbers, details about third parties or attachments.
 */
function staffUpdateCase(input) {
  const actor=staffIdentity_(input&&input.idToken);
  const caseId=cleaned_(input.caseId,50);
  const allowed=['RECEIVED','IN_REVIEW','NEED_INFORMATION','COMPLETED','CLOSED'];
  const next=cleaned_(input.status,40);
  const message=cleaned_(input.message,2000);
  if(!allowed.includes(next))throw Error('สถานะไม่ถูกต้อง');
  if(!message || message.length<5)throw Error('กรุณากรอกข้อความแจ้งผลอย่างน้อย 5 ตัวอักษร');
  if(/(?:\d[ -]?){13}/.test(message))throw Error('ห้ามใส่เลขบัตรประชาชนในข้อความแจ้งผล');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    assertPrivateFolders_();
    const sh=sheet_(),found=findCase_(sh,caseId),row=found.data;
    if(row[10]==='DRAFT')throw Error('คำร้องยังไม่ได้ส่ง');
    const replies=ensureResponsesSheet_(sh.getParent());
    const existing=findResponseRow_(replies,caseId);
    const now=new Date();
    const values=[caseId,now,next,sheetText_(message),actor];
    if(existing)replies.getRange(existing,1,1,5).setValues([values]);
    else replies.appendRow(values);
    sh.getRange(found.row,11).setValue(next);
    writeAudit_('STAFF_CASE_STATUS_UPDATE',caseId,actor,'STAFF','SUCCESS');
    return {caseId,status:next,updatedAt:now.toISOString()};
  }finally{lock.releaseLock();}
}

/**
 * Daily counts of fully submitted complaint records only.
 * One case counts once, even when it has several evidence files.
 * No email, citizen name, identity number or evidence is returned.
 * No financial amounts are stored or inferred from reward intent.
 */
function staffDailySummary(input) {
  const actor=staffIdentity_(input&&input.idToken);
  const date=cleaned_(input&&input.date,10)||caseDate_(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
     caseDate_(new Date(date+'T12:00:00+07:00'))!==date)
    throw Error('กรุณาระบุวันที่รูปแบบ YYYY-MM-DD');
  const sh=sheet_();
  ensureSubmissionColumn_(sh);
  const last=sh.getLastRow();
  const summary={date,total:0,reward:0,noReward:0};
  if(last<2)return summary;
  const values=sh.getRange(2,1,last-1,15).getValues();
  const counted=new Set();
  for(const row of values) {
    const id=String(row[0]||'');
    const intent=String(row[2]||'');
    const state=String(row[10]||'');
    const submitted=row[14];
    if(!id||counted.has(id)||state==='DRAFT'||!submitted)continue;
    if(!(submitted instanceof Date) || !Number.isFinite(submitted.getTime()))continue;
    if(caseDate_(submitted)!==date)continue;
    if(intent!=='reward'&&intent!=='no-reward')continue;
    counted.add(id);
    summary.total++;
    if(intent==='reward')summary.reward++;else summary.noReward++;
  }
  writeAudit_('STAFF_DAILY_SUMMARY','',actor,'STAFF','SUCCESS');
  return summary;
}
