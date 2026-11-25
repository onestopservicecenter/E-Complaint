const CONTENT_FOLDERS_={banner:'1qcdLbbSm_iqjq9pS1t8nwKhRf5T98mvX',news:'1NcwDztc1GVXGrE_pOV1DfagpbnoTPS9r',alert:'12tPWpOi6eESO-oub_2Cx_kF07sYsM3qj'};
/** V2: separate tables; original NPT_ data remains untouched. */
const CATS_=['อาหาร','ยา','สมุนไพร','เครื่องสำอาง','วัตถุอันตราย','เครื่องมือแพทย์','สถานพยาบาลและคลินิก','สถานประกอบการเพื่อสุขภาพ','โฆษณาผลิตภัณฑ์สุขภาพ','อื่น ๆ'];
const STATUSES_=['รับเรื่องแล้ว','กำลังตรวจสอบ','ประสานหน่วยงาน','ยุติเรื่อง'];
const T_={Cases:['id','requestId','ownerSub','email','category','subject','details','location','name','phone','evidence','at','deleted'],Updates:['id','caseId','at','status','note','internal','files','links','actor','requestId'],Content:['id','type','title','body','link','sort','published','fileId','mime','updatedAt','deleted'],Staff:['email','displayName','active','permissions'],Sessions:['hash','sub','email','name','expiresAt'],Audit:['at','actor','action','target']};
function prop_(){return PropertiesService.getScriptProperties();}function cfg_(){const s=prop_().getProperty('CONFIG_V2');if(!s)throw Error('ยังไม่ได้ตั้งค่าระบบ');return JSON.parse(s)}function db_(){return SpreadsheetApp.openById(cfg_().sheetId)}
function safe_(x){const s=String(x??'');return /^[=+@\-\t\r]/.test(s)?"'"+s:s}function now_(){return new Date().toISOString()}function random_(){return (Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'')}function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(n=>('0'+((n+256)%256).toString(16)).slice(-2)).join('')}
function text_(s,max,min=0){if(typeof s!=='string'||s.trim().length<min||s.trim().length>max)throw Error('ข้อมูลไม่ถูกต้อง');return s.trim()}function lock_(fn){const l=LockService.getScriptLock();l.waitLock(30000);try{return fn()}finally{l.releaseLock()}}
function rows_(name){const v=db_().getSheetByName('NPT2_'+name).getDataRange().getValues();v.shift();return v.map((r,i)=>{const o={_row:i+2};T_[name].forEach((k,j)=>o[k]=r[j]);return o}).filter(o=>o[T_[name][0]]!=='')}
function add_(name,o){db_().getSheetByName('NPT2_'+name).appendRow(T_[name].map(k=>safe_(o[k]??'')))}function replace_(name,row,o){db_().getSheetByName('NPT2_'+name).getRange(row,1,1,T_[name].length).setValues([T_[name].map(k=>safe_(o[k]??''))])}
function audit_(u,action,target){add_('Audit',{at:now_(),actor:u.email,action,target})}function bool_(v){return v===true||v==='true'}
function ensureTables_(ss){
 Object.keys(T_).forEach(name=>{
  const title='NPT2_'+name,headers=T_[name];
  let sh=ss.getSheetByName(title);
  if(!sh)sh=ss.insertSheet(title);
  if(sh.getLastRow()===0)sh.appendRow(headers);
  else{
   const actual=sh.getRange(1,1,1,headers.length).getValues()[0];
   if(headers.some((value,i)=>actual[i]!==value))throw Error('หัวตาราง '+title+' ไม่ตรง หยุดเพื่อป้องกันการเขียนทับข้อมูล');
  }
  sh.setFrozenRows(1);
 });
}
function initializeV2(){return lock_(()=>{
 const me=Session.getActiveUser().getEmail().toLowerCase();
 if(!me||me!==Session.getEffectiveUser().getEmail().toLowerCase())throw Error('รันจาก Apps Script editor ด้วยบัญชีผู้ดูแล');
 const p=prop_();
 if(p.getProperty('CONFIG_V2')){
  const c=cfg_();if(c.adminEmail!==me)throw Error('ไม่มีสิทธิ์');
  ensureTables_(SpreadsheetApp.openById(c.sheetId));
  return 'ตรวจสอบตารางระบบ V2 แล้ว';
 }
 const ss=SpreadsheetApp.getActiveSpreadsheet();
 if(!ss)throw Error('สร้าง Apps Script จากชีตของหน่วยงาน');
 const pending=p.getProperty('INIT_V2_STATE');
 let state;
 if(pending){
  state=JSON.parse(pending);
  if(state.adminEmail!==me||state.sheetId!==ss.getId())throw Error('ข้อมูลการติดตั้งค้างไม่ตรงบัญชีหรือชีต');
 }else{
  if(Object.keys(T_).some(k=>ss.getSheetByName('NPT2_'+k)))throw Error('พบชีตชื่อซ้ำ ห้ามติดตั้งทับข้อมูล');
  state={sheetId:ss.getId(),adminEmail:me,folders:{...CONTENT_FOLDERS_},contact:'',privacyText:''};
  p.setProperty('INIT_V2_STATE',JSON.stringify(state));
 }
 if(!state.rootId){state.rootId=DriveApp.createFolder('NPT Complaint V2 — Private').getId();p.setProperty('INIT_V2_STATE',JSON.stringify(state));}
 const root=DriveApp.getFolderById(state.rootId);
 ['reply','evidence'].forEach(k=>{if(!state.folders[k]){state.folders[k]=root.createFolder(k).getId();p.setProperty('INIT_V2_STATE',JSON.stringify(state));}});
 ensureTables_(ss);
 const {rootId,...config}=state;
 p.setProperty('CONFIG_V2',JSON.stringify(config));
 return 'ติดตั้งแล้ว ตั้ง Script Properties: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET และ Deploy เว็บแอป';
})}
function thaiDay_(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return Utilities.formatDate(date,'Asia/Bangkok','yyyy-MM-dd')}
function siteOrigin_(){const value=(prop_().getProperty('SITE_ORIGIN')||'https://onestopservicecenter.github.io').trim().replace(/\/+$/,'');if(!/^https:\/\/[^/?#\s]+$/.test(value))throw Error('SITE_ORIGIN ต้องเป็น HTTPS origin โดยไม่ใส่ path');return value}
function doGet(e){const t=HtmlService.createTemplateFromFile('Bridge');t.siteOrigin=siteOrigin_();t.channel=/^[a-f0-9-]{36}$/i.test(e?.parameter?.channel||'')?e.parameter.channel:'';return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)}
function jsonFetch_(url,options={}){const r=UrlFetchApp.fetch(url,{...options,muteHttpExceptions:true,followRedirects:false});if(r.getResponseCode()!==200)throw Error('ไม่สามารถยืนยันบัญชี Google ได้');return JSON.parse(r.getContentText())}
function beginLogin_(d){
 const key=text_(d.browserKey,150,30),state=random_(),stateKey=hash_(state),keyHash=hash_(key);
 CacheService.getScriptCache().put('oauth:'+stateKey,keyHash,900);
 // Script Cache is best-effort; persist the short-lived nonce to avoid false expirations.
 const properties=prop_(),now=Date.now();
 // Remove abandoned login challenges; do not touch CONFIG_V2 or other properties.
 for(const [name,value] of Object.entries(properties.getProperties())){
  if(!name.startsWith('idnonce:'))continue;
  try{if(now-JSON.parse(value).createdAt>900000)properties.deleteProperty(name)}
  catch(_){properties.deleteProperty(name)}
 }
 properties.setProperty('idnonce:'+stateKey,JSON.stringify({keyHash,createdAt:now}));
 return {state};
}
function completeLogin_(d){const state=text_(d.state,100,30),key=text_(d.browserKey,150,30),code=text_(d.code,3000,1),cache=CacheService.getScriptCache();const cacheKey='oauth:'+hash_(state);if(cache.get(cacheKey)!==hash_(key))throw Error('คำขอเข้าสู่ระบบหมดอายุ กรุณาลองใหม่');cache.remove(cacheKey);const p=prop_();const token=jsonFetch_('https://oauth2.googleapis.com/token',{method:'post',payload:{code,client_id:p.getProperty('GOOGLE_CLIENT_ID'),client_secret:p.getProperty('GOOGLE_CLIENT_SECRET'),redirect_uri:siteOrigin_(),grant_type:'authorization_code'}});const identity=jsonFetch_('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+token.access_token}});if(!identity.sub||!identity.email||identity.email_verified!==true)throw Error('บัญชี Google ยังไม่ยืนยันอีเมล');if(!identity.email.toLowerCase().endsWith('@gmail.com')&&!identity.hd)throw Error('รองรับบัญชี Gmail หรือ Google Workspace ที่ยืนยันแล้ว');const secret=random_(),u={sub:identity.sub,email:identity.email.toLowerCase(),name:identity.name||identity.email};add_('Sessions',{hash:hash_(secret),sub:u.sub,email:u.email,name:u.name,expiresAt:new Date(Date.now()+3600000).toISOString()});audit_(u,'login','');return {session:secret,user:publicUser_(u)}}
// Google Sign-In ID Token verification for the limited OAuth testing phase.
// Google tokeninfo validates signature/issuer/expiry; we additionally bind the
// token to our configured audience and one-time browser nonce. Before opening
// public production access, replace tokeninfo with a maintained local JWT verifier.
function completeIdLogin_(d){
 const state=text_(d.state,100,30),key=text_(d.browserKey,150,30);
 const credential=text_(d.credential,10000,100),cache=CacheService.getScriptCache();
 const stateHash=hash_(state),cacheKey='oauth:'+stateHash;
 const stored=prop_().getProperty('idnonce:'+stateHash);
 let nonce=null;
 try{nonce=stored?JSON.parse(stored):null}catch(_){}
 if(!nonce||nonce.keyHash!==hash_(key)||!Number.isFinite(nonce.createdAt)||Date.now()-nonce.createdAt>900000||nonce.createdAt>Date.now()+60000){
  throw Error('คำขอเข้าสู่ระบบหมดอายุ กรุณาโหลดหน้าใหม่');
 }
 prop_().deleteProperty('idnonce:'+stateHash);
 cache.remove(cacheKey);
 const clientId=prop_().getProperty('GOOGLE_CLIENT_ID');
 if(!clientId)throw Error('ยังไม่กำหนด GOOGLE_CLIENT_ID');
 const identity=jsonFetch_('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential));
 if(identity.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(identity.iss))throw Error('Google Token ไม่ตรงกับระบบ');
 if(identity.nonce!==state)throw Error('ข้อมูลยืนยันตัวตนไม่ตรงกับคำขอ');
 if(!/^\d+$/.test(String(identity.exp||''))||Number(identity.exp)*1000<=Date.now())throw Error('Google Token หมดอายุ');
 if(!identity.sub||!identity.email||!(identity.email_verified===true||identity.email_verified==='true'))throw Error('บัญชี Google ยังไม่ยืนยันอีเมล');
 if(!identity.email.toLowerCase().endsWith('@gmail.com')&&!identity.hd)throw Error('รองรับบัญชี Gmail หรือ Google Workspace ที่ยืนยันแล้ว');
 const u={sub:String(identity.sub),email:String(identity.email).toLowerCase(),name:identity.name||identity.email};
 const session=random_();
 add_('Sessions',{hash:hash_(session),sub:u.sub,email:u.email,name:u.name,expiresAt:new Date(Date.now()+3600000).toISOString()});
 audit_(u,'login','');
 return {session,user:publicUser_(u)};
}
function publicUser_(u){const c=cfg_();if(u.email===c.adminEmail)return {...u,role:'admin',permissions:{}};const s=rows_('Staff').find(s=>s.email===u.email&&bool_(s.active));return {...u,role:s?'staff':'citizen',permissions:s?JSON.parse(s.permissions):{}}}
function auth_(session){if(typeof session!=='string'||!/^[a-f0-9]{64}$/i.test(session))throw Error('กรุณาเข้าสู่ระบบ');const s=rows_('Sessions').find(s=>s.hash===hash_(session)&&Date.parse(s.expiresAt)>Date.now());if(!s)throw Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');return publicUser_({sub:s.sub,email:s.email,name:s.name})}
function permit_(u,module,op,category){if(u.role==='admin')return;if(u.role!=='staff'||!(module==='cases'?u.permissions.cases?.[category]?.[op]:u.permissions[module]?.[op]))throw Error('ไม่มีสิทธิ์ดำเนินการ')}
function admin_(u){if(u.role!=='admin')throw Error('เฉพาะผู้ดูแลระบบ')}
function case_(id){const c=rows_('Cases').find(c=>c.id===id&&!bool_(c.deleted));if(!c)throw Error('ไม่พบเรื่อง');return c}
function accessCase_(u,c){if(u.sub===c.ownerSub)return;permit_(u,'cases','view',c.category)}
function updates_(id){return rows_('Updates').filter(x=>x.caseId===id)}function status_(id){const a=updates_(id);return a.length?a[a.length-1].status:STATUSES_[0]}
function intakeDetails_(caseId){
 const sh=db_().getSheetByName('NPT2_CaseDetails');
 if(!sh||sh.getLastRow()<2)return null;
 const values=sh.getRange(2,1,sh.getLastRow()-1,4).getValues();
 const row=values.find(r=>r[0]===caseId);
 return row?{intakeType:row[1],intakeFields:JSON.parse(row[2]||'{}')}:null;
}
function viewCase_(u,id,staff=false){const c=case_(text_(id,70,1));if(staff)permit_(u,'cases','view',c.category);else if(u.sub!==c.ownerSub)throw Error('ไม่มีสิทธิ์เข้าถึงเรื่องนี้');audit_(u,staff?'staff-read':'owner-read',id);const updates=updates_(id).map(x=>({at:x.at,status:x.status,note:x.note,files:JSON.parse(x.files||'[]'),links:JSON.parse(x.links||'[]'),...(staff?{internal:x.internal,actor:x.actor}:{})}));return {id:c.id,subject:c.subject,category:c.category,status:status_(id),updates,...(staff?{email:c.email,name:c.name,phone:c.phone,location:c.location,details:c.details,evidence:JSON.parse(c.evidence||'[]'),intakeDetails:intakeDetails_(c.id)}:{})}}
function checkedFiles_(files){if(!Array.isArray(files)||files.length>3)throw Error('แนบได้ไม่เกิน 3 ไฟล์');return files.map(f=>{const name=text_(f.name,180,1),b64=text_(f.base64,7000000,1);let bytes;try{bytes=Utilities.base64Decode(b64)}catch(e){throw Error('ไฟล์ไม่ถูกต้อง')}if(bytes.length>5242880||!bytes.length)throw Error('ไฟล์เกิน 5 MB หรือไฟล์ว่าง');const b=i=>(bytes[i]+256)%256;let mime='';if(b(0)===255&&b(1)===216&&b(2)===255)mime='image/jpeg';else if([137,80,78,71,13,10,26,10].every((v,i)=>b(i)===v))mime='image/png';else if([37,80,68,70,45].every((v,i)=>b(i)===v))mime='application/pdf';if(!mime)throw Error('อนุญาตเฉพาะ JPG PNG PDF');return {name,mime,bytes}})}
// New complaints: all citizen evidence and staff replies share one private folder.
// Legacy cases already stored in the old shared folders are not moved automatically.
function caseFolder_(caseId){
 if(!/^NPT-\d{8}-[A-F0-9]{12}$/.test(caseId))throw Error('เลขรับเรื่องไม่ถูกต้อง');
 const root=DriveApp.getFolderById(cfg_().folders.evidence);
 if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('โฟลเดอร์หลักฐานไม่ได้ตั้งเป็นส่วนตัว');
 const date=caseId.slice(4,8)+'-'+caseId.slice(8,10)+'-'+caseId.slice(10,12);
 const days=root.getFoldersByName(date);
 const day=days.hasNext()?days.next():root.createFolder(date);
 if(day.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('โฟลเดอร์รายวันไม่ได้ตั้งเป็นส่วนตัว');
 const cases=day.getFoldersByName(caseId);
 const folder=cases.hasNext()?cases.next():day.createFolder(caseId);
 if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('โฟลเดอร์รายคำร้องไม่ได้ตั้งเป็นส่วนตัว');
 return folder;
}
function storeFiles_(checked,module,caseId){const created=[];try{checked.forEach(x=>{const f=(caseId?caseFolder_(caseId):DriveApp.getFolderById(CONTENT_FOLDERS_[module]||cfg_().folders[module])).createFile(Utilities.newBlob(x.bytes,x.mime,x.name));created.push({id:f.getId(),name:x.name,mime:x.mime})});return created}catch(e){trash_(created);throw Error('บันทึกไฟล์ไม่ได้')}}function trash_(a){a.forEach(f=>{try{DriveApp.getFileById(f.id).setTrashed(true)}catch(e){}})}

const INTAKE_TYPES_=['reward','no-reward','inspection','ossc'];
function intakeExtra_(d){
 if(!INTAKE_TYPES_.includes(d.intakeType))throw Error('ประเภทแบบฟอร์มไม่ถูกต้อง');
 if(!d.extra||typeof d.extra!=='object'||Array.isArray(d.extra))throw Error('ไม่มีข้อมูลแบบฟอร์ม');
 const result={};
 const entries=Object.entries(d.extra);
 if(entries.length>80)throw Error('มีช่องข้อมูลมากเกินไป');
 entries.forEach(([key,value])=>{
  if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(key)||!['string','boolean','number'].includes(typeof value))throw Error('ช่องข้อมูลไม่ถูกต้อง');
  result[key]=text_(String(value),3000);
 });
 if(JSON.stringify(result).length>40000)throw Error('รายละเอียดแบบฟอร์มเกินขนาด');
 return result;
}
function intakeDetailsSheet_(){
 const ss=db_();
 let sh=ss.getSheetByName('NPT2_CaseDetails');
 if(!sh){
  sh=ss.insertSheet('NPT2_CaseDetails');
  sh.appendRow(['caseId','intakeType','fieldsJson','at']);
  sh.setFrozenRows(1);
 }
 const headers=sh.getRange(1,1,1,4).getValues()[0];
 if(['caseId','intakeType','fieldsJson','at'].some((k,i)=>headers[i]!==k))throw Error('ตารางรายละเอียดไม่ตรง');
 return sh;
}
function stagedFolder_(){
 const root=DriveApp.getFolderById(cfg_().folders.evidence);
 if(root.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('พื้นที่หลักฐานต้องเป็นส่วนตัว');
 const folders=root.getFoldersByName('_pending_intake');
 const folder=folders.hasNext()?folders.next():root.createFolder('_pending_intake');
 if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('พื้นที่พักไฟล์ต้องเป็นส่วนตัว');
 return folder;
}
function validateIntakeFile_(d){
 const name=text_(d.name,180,1),base64=text_(d.base64,14000000,1);
 let bytes;
 try{bytes=Utilities.base64Decode(base64)}catch(_){throw Error('ข้อมูลไฟล์ไม่ถูกต้อง')}
 if(!bytes.length||bytes.length>10485760)throw Error('แนบได้สูงสุดไฟล์ละ 10 MB');
 const b=i=>(bytes[i]+256)%256;
 let mime='';
 if(b(0)===255&&b(1)===216&&b(2)===255)mime='image/jpeg';
 else if([137,80,78,71,13,10,26,10].every((v,i)=>b(i)===v))mime='image/png';
 else if([37,80,68,70,45].every((v,i)=>b(i)===v))mime='application/pdf';
 else if([82,73,70,70].every((v,i)=>b(i)===v)&&[87,69,66,80].every((v,i)=>b(i+8)===v))mime='image/webp';
 else if([82,73,70,70].every((v,i)=>b(i)===v)&&[87,65,86,69].every((v,i)=>b(i+8)===v))mime='audio/wav';
 else if([79,103,103,83].every((v,i)=>b(i)===v))mime='audio/ogg';
 else if([73,68,51].every((v,i)=>b(i)===v)||(b(0)===255&&(b(1)&224)===224))mime='audio/mpeg';
 else if([102,116,121,112].every((v,i)=>b(i+4)===v))mime='video/mp4';
 if(!mime)throw Error('ชนิดไฟล์ไม่รองรับ');
 return {name,mime,bytes};
}
function cleanupStaged_(){
 const properties=prop_(),now=Date.now();
 Object.entries(properties.getProperties()).forEach(([key,value])=>{
  if(!key.startsWith('intakeFile:'))return;
  let metadata=null;
  try{metadata=JSON.parse(value)}catch(_){}
  if(metadata&&now-metadata.createdAt<=3600000)return;
  if(metadata?.fileId){try{DriveApp.getFileById(metadata.fileId).setTrashed(true)}catch(_){}}
  properties.deleteProperty(key);
 });
}
function stageEvidence_(u,d){
 if(!cfg_().privacyText||!cfg_().contact)throw Error('ยังไม่เปิดรับหลักฐาน กรุณารอข้อมูลติดต่อและประกาศความเป็นส่วนตัวของหน่วยงาน');
 cleanupStaged_();
 const f=validateIntakeFile_(d),uploadId=random_();
 const saved=stagedFolder_().createFile(Utilities.newBlob(f.bytes,f.mime,uploadId));
 prop_().setProperty('intakeFile:'+uploadId,JSON.stringify({ownerSub:u.sub,fileId:saved.getId(),name:f.name,mime:f.mime,size:f.bytes.length,createdAt:Date.now()}));
 audit_(u,'stage-file',uploadId);
 return {uploadId,name:f.name,size:f.bytes.length};
}
function finalizeStagedFiles_(u,ids,caseId){
 if(!Array.isArray(ids)||ids.length>5||new Set(ids).size!==ids.length)throw Error('แนบได้ไม่เกิน 5 ไฟล์');
 const properties=prop_(),now=Date.now(),all=ids.map(id=>{
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/i.test(id))throw Error('รหัสไฟล์ไม่ถูกต้อง');
  const value=properties.getProperty('intakeFile:'+id);
  if(!value)throw Error('ไฟล์หมดอายุ กรุณาแนบใหม่');
  const metadata=JSON.parse(value);
  if(metadata.ownerSub!==u.sub||now-metadata.createdAt>3600000||metadata.createdAt>now+60000)throw Error('ไม่มีสิทธิ์ใช้ไฟล์หรือไฟล์หมดอายุ');
  return {id,metadata};
 });
 const target=caseFolder_(caseId),moved=[];
 all.forEach(({id,metadata})=>{
  const file=DriveApp.getFileById(metadata.fileId);
  if(file.isTrashed()||file.getSize()!==metadata.size||file.getMimeType()!==metadata.mime)throw Error('ไฟล์หลักฐานไม่ถูกต้อง');
  file.moveTo(target);
  file.setName(metadata.name);
  properties.deleteProperty('intakeFile:'+id);
  moved.push({id:file.getId(),name:metadata.name,mime:metadata.mime});
 });
 return moved;
}
function submit_(u,d){if(!cfg_().privacyText||!cfg_().contact)throw Error('หน่วยงานยังไม่ได้เปิดรับเรื่อง กรุณารอการตั้งค่าข้อมูลติดต่อและประกาศความเป็นส่วนตัว');const requestId=text_(d.requestId,80,16),old=rows_('Cases').find(c=>c.requestId===requestId&&c.ownerSub===u.sub);if(old)return {id:old.id};if(rows_('Cases').filter(c=>c.ownerSub===u.sub&&thaiDay_(c.at)===thaiDay_(now_())).length>=10)throw Error('ส่งได้ไม่เกิน 10 เรื่องต่อวัน');const category=text_(d.category,100,1);if(!CATS_.includes(category)||d.acknowledge!==true)throw Error('ข้อมูลหมวดหรือการรับทราบไม่ถูกต้อง');const subject=text_(d.subject,200,1),details=text_(d.details,10000,20),location=text_(d.location,500,1),name=text_(d.name,120,1),phone=text_(d.phone,25,8);if(!/^[0-9+() -]{8,25}$/.test(phone))throw Error('โทรศัพท์ไม่ถูกต้อง');const detailsSheet=intakeDetailsSheet_(),extra=intakeExtra_(d),staged=Array.isArray(d.stagedFileIds)?d.stagedFileIds:null;const checked=staged?[]:checkedFiles_(d.files||[]);const id='NPT-'+Utilities.formatDate(new Date(),'Asia/Bangkok','yyyyMMdd')+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();caseFolder_(id);const created=staged?finalizeStagedFiles_(u,staged,id):storeFiles_(checked,'evidence',id);let committed=false;try{add_('Cases',{id,requestId,ownerSub:u.sub,email:u.email,category,subject,details,location,name,phone,evidence:JSON.stringify(created),at:now_(),deleted:false});committed=true;detailsSheet.appendRow([safe_(id),safe_(d.intakeType),safe_(JSON.stringify(extra)),now_()]);add_('Updates',{id:Utilities.getUuid(),caseId:id,at:now_(),status:STATUSES_[0],note:'รับเรื่องแล้ว รอเจ้าหน้าที่ตรวจสอบ',internal:'',files:'[]',actor:'system',requestId:'intake-'+requestId});audit_(u,'submit',id);return {id}}catch(e){if(!committed)trash_(created);throw Error(committed?'ระบบรับข้อมูลแล้ว โปรดตรวจรายการก่อนส่งซ้ำ':'บันทึกไม่สำเร็จ')}}
function reply_(u,d){const c=case_(d.id);permit_(u,'cases','view',c.category);const rights=u.role==='admin'?{edit:true,upload:true,addLink:true}:(u.permissions.cases?.[c.category]||{});if(!rights.edit&&!rights.upload&&!rights.addLink)throw Error('ไม่มีสิทธิ์ตอบกลับ');const requestId=text_(d.requestId,80,16);const duplicate=rows_('Updates').find(x=>x.requestId===requestId);if(duplicate){if(duplicate.caseId!==c.id)throw Error('คำขอซ้ำผิดเรื่อง');return {ok:true}}const status=text_(d.status,60,1),note=text_(d.note,3000,1),internal=text_(d.internal||'',3000);if(!STATUSES_.includes(status))throw Error('สถานะไม่ถูกต้อง');if(!rights.edit&&(status!==status_(c.id)||internal))throw Error('ไม่มีสิทธิ์แก้สถานะหรือบันทึกภายใน');if((d.files||[]).length&&!rights.upload)throw Error('ไม่มีสิทธิ์อัปโหลด');const links=Array.isArray(d.links)?d.links:[];if(links.length>5)throw Error('แนบลิงก์ได้ไม่เกิน 5 ลิงก์');const checkedLinks=links.map(x=>({title:text_(x.title,200,1),url:validUrl_(x.url)}));if(checkedLinks.length&&!rights.addLink)throw Error('ไม่มีสิทธิ์เพิ่มลิงก์');if(!rights.edit&&!(d.files||[]).length&&!checkedLinks.length)throw Error('กรุณาแนบไฟล์หรือลิงก์ตามสิทธิ์');const created=storeFiles_(checkedFiles_(d.files||[]),'reply',c.id);let committed=false;try{add_('Updates',{id:Utilities.getUuid(),caseId:c.id,at:now_(),status,note,internal,files:JSON.stringify(created),links:JSON.stringify(checkedLinks),actor:u.email,requestId});committed=true;audit_(u,'reply',c.id);return {ok:true}}catch(e){if(!committed)trash_(created);throw Error(committed?'บันทึกผลแล้ว กรุณารีเฟรชตรวจสอบ':'บันทึกไม่สำเร็จ')}}

function sourceStates_(){const sh=db_().getSheetByName('NPT2_SourceState');if(!sh||sh.getLastRow()<2)return [];return sh.getRange(2,1,sh.getLastRow()-1,3).getValues().map(r=>({fileId:r[0],state:r[1],at:r[2]}));}
function suppressSource_(fileId){let sh=db_().getSheetByName('NPT2_SourceState');if(!sh){sh=db_().insertSheet('NPT2_SourceState');sh.appendRow(['fileId','state','at']);sh.setFrozenRows(1);}sh.appendRow([fileId,'suppressed',now_()]);}
function driveContent_(typeFilter,managedRows){const managed=managedRows||rows_('Content'),blocked=new Set([...managed.map(c=>c.fileId).filter(Boolean),...sourceStates_().map(x=>x.fileId)]);const items=[],issues=[];
 Object.keys(CONTENT_FOLDERS_).filter(type=>!typeFilter||type===typeFilter).forEach(type=>{try{const files=DriveApp.getFolderById(CONTENT_FOLDERS_[type]).getFiles();while(files.hasNext()){const f=files.next(),mime=f.getMimeType();if(f.isTrashed()||blocked.has(f.getId())||!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime)||type==='banner'&&!mime.startsWith('image/'))continue;const name=f.getName(),prefix=name.match(/^(\d{1,4})[ ._-]/);items.push({id:'drive:'+f.getId(),type,title:name.replace(/\.[^.]+$/,''),body:f.getDescription()||'',link:'',sort:prefix?Number(prefix[1]):9999,published:true,fileId:f.getId(),mime,updatedAt:f.getLastUpdated().toISOString(),deleted:false,external:true});}}catch(e){issues.push(type);}});return {items,issues};}
function contentCatalog_(typeFilter,includeDrafts=false){
 const records=rows_('Content'),source=driveContent_(typeFilter,records),issues=[...source.issues],managed=[];
 records.filter(c=>(!typeFilter||c.type===typeFilter)&&!bool_(c.deleted)&&(includeDrafts||bool_(c.published))).forEach(({_row,...record})=>{
  const c={...record,published:bool_(record.published)};
  if(c.fileId){
   try{
    const f=DriveApp.getFileById(c.fileId);
    if(f.isTrashed())return;
    const fileDate=f.getLastUpdated().toISOString();
    if(!c.updatedAt||fileDate>String(c.updatedAt))c.updatedAt=fileDate;
    c.mime=f.getMimeType();
   }catch(e){issues.push(c.type);return;}
  }
  managed.push(c);
 });
 return {items:[...managed,...source.items].sort((a,b)=>Number(a.sort)-Number(b.sort)||String(b.updatedAt).localeCompare(String(a.updatedAt))),sourceIssues:[...new Set(issues)]};
}
// Authorize one public file without enumerating every content folder.
// Read current publication records on every request so draft/deletion changes take effect.
function publicFile_(id){
 const fileId=text_(id,200,1),records=rows_('Content').filter(c=>c.fileId===fileId);
 if(records.length){
  if(!records.some(c=>!bool_(c.deleted)&&bool_(c.published)))throw Error('ไม่พบไฟล์ที่เผยแพร่');
  return fileId;
 }
 if(sourceStates_().some(c=>c.fileId===fileId))throw Error('ไม่พบไฟล์ที่เผยแพร่');
 let f;
 try{f=DriveApp.getFileById(fileId)}catch(e){throw Error('ไม่พบไฟล์ที่เผยแพร่')}
 if(f.isTrashed())throw Error('ไม่พบไฟล์ที่เผยแพร่');
 const mime=f.getMimeType();
 if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime))throw Error('ชนิดไฟล์ไม่ถูกต้อง');
 const parents=f.getParents();
 while(parents.hasNext()){
  const parentId=parents.next().getId();
  if(Object.keys(CONTENT_FOLDERS_).some(type=>CONTENT_FOLDERS_[type]===parentId&&(type!=='banner'||mime.startsWith('image/'))))return fileId;
 }
 throw Error('ไม่พบไฟล์ที่เผยแพร่');
}

function validUrl_(s){if(!s)return '';const v=text_(s,1000,1);if(!/^https:\/\/[^\s]+$/.test(v))throw Error('ลิงก์ต้องเป็น HTTPS');return v}
function saveContent_(u,d){if(!['banner','news','alert'].includes(d.type))throw Error('ส่วนงานไม่ถูกต้อง');const stored=d.id?rows_('Content').find(c=>c.id===d.id&&!bool_(c.deleted)):null;const old=stored||(d.id?driveContent_(d.type).items.find(c=>c.id===d.id):null);if(d.id&&!old)throw Error('ไม่พบรายการ');if(old&&old.type!==d.type)throw Error('เปลี่ยนส่วนงานไม่ได้');permit_(u,d.type,old?'edit':'add');const title=text_(d.title,200,1),body=text_(d.body||'',15000),link=validUrl_(d.link),sort=Math.max(0,Math.min(9999,Number(d.sort)||0));const checked=d.file?checkedFiles_([d.file]):[];if(d.type==='banner'&&checked.some(f=>!f.mime.startsWith('image/')))throw Error('แบนเนอร์ใช้รูปภาพเท่านั้น');if(d.type==='banner'&&!old?.fileId&&!checked.length)throw Error('กรุณาแนบรูปแบนเนอร์');const created=storeFiles_(checked,d.type);const o={id:old?.id||Utilities.getUuid(),type:d.type,title,body,link,sort,published:!!d.published,fileId:created[0]?.id||old?.fileId||'',mime:created[0]?.mime||old?.mime||'',updatedAt:now_(),deleted:false};let committed=false;try{stored?replace_('Content',stored._row,o):add_('Content',o);committed=true;if(old?.fileId&&old.fileId!==o.fileId)suppressSource_(old.fileId);audit_(u,'save-'+d.type,o.id);return {ok:true,id:o.id}}catch(e){if(!committed)trash_(created);throw Error(committed?'บันทึกแล้ว กรุณารีเฟรช':'บันทึกไม่สำเร็จ')}}
function cleanPermissions_(p){const result={cases:{}};const ops=['view','add','edit','delete'];['banner','news','alert'].forEach(k=>{result[k]={};ops.forEach(op=>result[k][op]=p?.[k]?.[op]===true)});CATS_.forEach(cat=>{result.cases[cat]={};['view','addLink','upload','edit','delete'].forEach(op=>result.cases[cat][op]=p?.cases?.[cat]?.[op]===true)});return result}
function filePayload_(id,thumbnail=false,maxBytes=5242880){
 const f=DriveApp.getFileById(id);
 if(f.isTrashed())throw Error('ไฟล์ไม่พร้อมใช้งาน');
 let blob;
 if(thumbnail){
  // A large source image may have a small Drive thumbnail. Read that first.
  blob=f.getThumbnail();
  if(!blob){if(f.getSize()>5242880)throw Error('ภาพตัวอย่างยังไม่พร้อม กรุณาลองใหม่ภายหลัง');blob=f.getBlob();}
 }else{
  if(f.getSize()>maxBytes)throw Error('ไฟล์เกินขนาดที่ระบบรองรับ');
  blob=f.getBlob();
 }
 const mime=blob.getContentType();
 if(!['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/wav','audio/ogg','video/mp4'].includes(mime)||thumbnail&&!mime.startsWith('image/'))throw Error('ชนิดไฟล์ไม่ถูกต้อง');
 const bytes=blob.getBytes();
 if(!bytes.length||bytes.length>(thumbnail?5242880:maxBytes))throw Error('ไฟล์เกินขนาดที่ระบบรองรับหรือไฟล์ว่าง');
 return {name:f.getName(),mime,base64:Utilities.base64Encode(bytes)};
}
function allowedFile_(u,id){const cs=rows_('Cases').filter(c=>!bool_(c.deleted));for(const c of cs){const found=JSON.parse(c.evidence||'[]').some(f=>f.id===id)||updates_(c.id).some(x=>JSON.parse(x.files||'[]').some(f=>f.id===id));if(found){accessCase_(u,c);audit_(u,'file-read',c.id);return;}}throw Error('ไม่มีสิทธิ์เข้าถึงไฟล์')}
function api(r){if(!r||typeof r.action!=='string')throw Error('คำขอไม่ถูกต้อง');const a=r.action,d=r.data||{};if(JSON.stringify(d).length>22000000)throw Error('ข้อมูลเกินขนาด');
 if(a==='catalog'){const c=cfg_();return {...contentCatalog_(),contact:c.contact,privacyText:c.privacyText}}
 if(a==='publicImage'||a==='publicFile'){const id=publicFile_(d.id);return filePayload_(id,a==='publicImage',20971520)}
 if(a==='beginLogin')return beginLogin_(d);if(a==='completeLogin')return lock_(()=>completeLogin_(d));if(a==='completeIdLogin')return lock_(()=>completeIdLogin_(d));
 const u=auth_(r.session);
 if(a==='me')return u;
 if(a==='logout')return lock_(()=>{const s=rows_('Sessions').find(s=>s.hash===hash_(r.session));if(s)replace_('Sessions',s._row,{...s,expiresAt:'1970-01-01T00:00:00Z'});return {ok:true}});
 if(a==='stageEvidence')return lock_(()=>stageEvidence_(u,d));
 if(a==='submit')return lock_(()=>submit_(u,d));
 if(a==='myCases')return rows_('Cases').filter(c=>c.ownerSub===u.sub&&!bool_(c.deleted)).reverse().map(c=>({id:c.id,subject:c.subject,status:status_(c.id),at:c.at}));
 if(a==='case')return viewCase_(u,d.id);
 if(a==='file'){allowedFile_(u,d.id);return filePayload_(d.id,false,10485760)}
 if(a==='staffCases'){const category=text_(d.category,100,1);if(!CATS_.includes(category))throw Error('เลือกหมวดก่อน');permit_(u,'cases','view',category);const search=String(d.search||'').toLowerCase().slice(0,200),page=Math.max(1,Math.floor(Number(d.page)||1));const all=rows_('Cases').filter(c=>!bool_(c.deleted)&&c.category===category&&(!search||[c.id,c.subject].some(v=>String(v).toLowerCase().includes(search)))).reverse();audit_(u,'staff-list',category);return {items:all.slice((page-1)*20,page*20).map(c=>({id:c.id,subject:c.subject,status:status_(c.id)})),more:page*20<all.length}}
 if(a==='staffCase')return viewCase_(u,d.id,true);
 if(a==='reply')return lock_(()=>reply_(u,d));
 if(a==='deleteCase')return lock_(()=>{const c=case_(d.id);permit_(u,'cases','delete',c.category);replace_('Cases',c._row,{...c,deleted:true});audit_(u,'delete-case',c.id);return {ok:true}});
 if(a==='staffContent'){permit_(u,d.type,'view');return contentCatalog_(d.type,true).items}
 if(a==='saveContent')return lock_(()=>saveContent_(u,d));
 if(a==='deleteContent')return lock_(()=>{const stored=rows_('Content').find(c=>c.id===d.id&&!bool_(c.deleted));const c=stored||driveContent_().items.find(c=>c.id===d.id);if(!c)throw Error('ไม่พบรายการ');permit_(u,c.type,'delete');const deleted={...c,deleted:true,published:false};stored?replace_('Content',stored._row,deleted):add_('Content',deleted);audit_(u,'delete-'+c.type,c.id);return {ok:true}});
 if(a==='staffAccounts'){admin_(u);return rows_('Staff').map(s=>({email:s.email,displayName:s.displayName,active:bool_(s.active),permissions:JSON.parse(s.permissions)}))}
 if(a==='saveStaff'){admin_(u);return lock_(()=>{const email=text_(d.email,254,5).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===cfg_().adminEmail)throw Error('อีเมลไม่ถูกต้องหรือเป็นผู้ดูแลหลัก');const o={email,displayName:text_(d.displayName,120,1),active:!!d.active,permissions:JSON.stringify(cleanPermissions_(d.permissions))};const old=rows_('Staff').find(s=>s.email===email);old?replace_('Staff',old._row,o):add_('Staff',o);audit_(u,'staff-permissions',email);return {ok:true}})}
 if(a==='siteSettings'){admin_(u);const c=cfg_();return {contact:c.contact,privacyText:c.privacyText}}
 if(a==='saveSiteSettings'){admin_(u);return lock_(()=>{const c=cfg_();c.contact=text_(d.contact||'',1000);c.privacyText=text_(d.privacyText||'',5000);prop_().setProperty('CONFIG_V2',JSON.stringify(c));audit_(u,'site-settings','');return {ok:true}})}
 throw Error('ไม่พบคำสั่ง');
}
