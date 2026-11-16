/**
 * E-Complaint public intake (separate Apps Script project).
 * Deploy as Web App: execute as owner, access anyone.
 * Never place citizen evidence in a folder shared to "anyone with link".
 * Run setupIntake() in the Apps Script editor AFTER fixing folder permissions.
 */
const INTAKE = Object.freeze({
  ROOT: '1Oc4B-M5IHtH5m3SZ-0-dyNIrfqg9epsI',
  REWARD: '1KE7EaI9nzHMRMnMs-jf0jmcV-yKIBM6O',
  NO_REWARD: '1xFIrH53Ozn0GGE7R7aad5n3t1Lvl8tGT',
  GOOGLE_CLIENT_ID: 'SET_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
  SHEET_PROP: 'INTAKE_SPREADSHEET_ID',
  HEADERS: ['เลขรับเรื่อง','วันที่บันทึก','สินบนนำจับ','บัญชีผู้ยื่น','ชื่อผู้ยื่น','โทรศัพท์','เรื่อง','สถานที่','รายละเอียด','แจ้งผล','สถานะ','โฟลเดอร์','clientNonce','หลักฐาน_JSON']
});
const REQUIRED_REWARD_DOCS = []; // The latest reward-intent form requires an identity-card image instead of four PDFs.

function doGet(e) {
  const intent = (e && e.parameter && e.parameter.intent) === 'reward' ? 'reward' : 'no-reward';
  const t = HtmlService.createTemplateFromFile('Intake');
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
  if (props.getProperty(INTAKE.SHEET_PROP)) return 'ตั้งค่าฐานข้อมูลแล้ว';
  const ss = SpreadsheetApp.create('E-Complaint Intake Registry - Confidential');
  const sh = ss.getSheets()[0];
  sh.setName('Cases'); sh.appendRow(INTAKE.HEADERS);
  sh.setFrozenRows(1);
  props.setProperty(INTAKE.SHEET_PROP, ss.getId());
  return ss.getUrl();
}
function assertPrivateFolders_() {
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
function sheet_() {
  const id=PropertiesService.getScriptProperties().getProperty(INTAKE.SHEET_PROP);
  if(!id) throw Error('Backend ยังไม่ได้ตั้งค่า กรุณาเรียก setupIntake() ก่อน');
  return SpreadsheetApp.openById(id).getSheetByName('Cases');
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
    const caseId='NPT-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd')+
      '-'+Utilities.getUuid().slice(0,8).toUpperCase();
    const parent=DriveApp.getFolderById(intent==='reward'?INTAKE.REWARD:INTAKE.NO_REWARD);
    const folder=parent.createFolder(caseId);
    // Personal data is written only after permissions have been verified.
    const payload={caseId,createdAt:new Date().toISOString(),intent,email,name,phone,
      subject,place,details,nationalId:intent==='reward'?nationalId:null,
      age,issuer,address,contactAddress,altEmail,lineId,desiredAction,eventDate,
      acceptTerms:intent==='reward'?true:!!input.acceptTerms,
      wantsReply:input.wantsReply==='yes'};
    folder.createFile(Utilities.newBlob(JSON.stringify(payload,null,2),'application/json','คำร้อง.json'));
    sh.appendRow([caseId,new Date(),intent,email,sheetText_(name),sheetText_(phone),sheetText_(subject),sheetText_(place),sheetText_(details),
      input.wantsReply==='yes'?'ต้องการแจ้งผล':'ไม่ต้องการแจ้งผล','DRAFT',folder.getId(),nonce,'{}']);
    return {caseId,status:'DRAFT'};
  } finally {lock.releaseLock(); }
}
function uploadEvidence(input) {
  const email=identity_(input&&input.idToken), id=cleaned_(input.caseId,50);
  const kind=cleaned_(input.kind,30),b64=String(input.base64||'');
  const kinds=['image','video','identityCard',...REQUIRED_REWARD_DOCS];
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
  const imageValid=(mime==='image/jpeg'&&isJPG)||(mime==='image/png'&&isPNG)||(mime==='image/webp'&&isWEBP);
  const videoValid=mime==='video/mp4'&&isMP4;
  if(kind==='identityCard' ? !imageValid : kind==='image' ? !imageValid : kind==='video' ? !videoValid : !(mime==='application/pdf'&&isPDF))
    throw Error('รูปแบบไฟล์ไม่ตรงตามที่กำหนด');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    assertPrivateFolders_();
    const sh=sheet_(),found=findCase_(sh,id),row=found.data;
    if(row[3]!==email||row[10]!=='DRAFT') throw Error('ไม่สามารถเพิ่มหลักฐานให้เรื่องนี้ได้');
    if(kind!=='image'&&kind!=='video'&&row[2]!=='reward') throw Error('ไม่มีสิทธิ์แนบเอกสารสินบนนำจับ');
    const uploads=JSON.parse(row[13]||'{}'),arr=uploads[kind]||[];
    if(arr.length>=(kind==='image'?5:1)) throw Error('จำนวนไฟล์ชนิดนี้ครบแล้ว');
    const extension=(kind==='image'||kind==='identityCard')?(mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'):
      kind==='video'?'mp4':'pdf';
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
    sh.getRange(found.row,11).setValue('SUBMITTED');
    return {caseId:id,status:'SUBMITTED'};
  }finally{lock.releaseLock();}
}
function myComplaintStatus(input) {
  const email=identity_(input&&input.idToken),found=findCase_(sheet_(),cleaned_(input.caseId,50));
  if(found.data[3]!==email) throw Error('ไม่สามารถดูข้อมูลเรื่องนี้ได้');
  return {caseId:found.data[0],status:found.data[10],submittedAt:found.data[1]};
}
