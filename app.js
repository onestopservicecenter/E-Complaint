const cfg=window.APP_CONFIG;
const $=s=>document.querySelector(s);
function parseToken(value){const v=String(value||'').trim();if(/^[a-f0-9]{64}$/i.test(v))return v.toLowerCase();try{const u=new URL(v);const t=new URLSearchParams(u.hash.replace(/^#/, '')).get('t');return /^[a-f0-9]{64}$/i.test(t||'')?t.toLowerCase():''}catch{return ''}}
function appUrl(){try{const u=new URL(cfg.webAppUrl);if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname))return '';u.search='';u.hash='';return u.href}catch{return ''}}
function openTracking(value){const t=parseToken(value);if(!t)throw Error('ลิงก์หรือรหัสติดตามไม่ถูกต้อง กรุณาตรวจสอบใบรับเรื่อง');const base=appUrl();if(!base)throw Error('ยังไม่ได้ตั้งค่าเว็บแอปติดตามสถานะ กรุณาติดต่อผู้ดูแล');const u=base+'#t='+t;$('#trackFrame').src=u;$('#trackFrame').classList.remove('hidden');$('#openTrack').href=u;$('#openTrack').classList.remove('hidden');$('#trackMessage').textContent='หากกรอบไม่แสดงผล ให้กดเปิดหน้าติดตามในแท็บใหม่';$('#tracking').value='';history.replaceState(null,'',location.pathname+location.search+'#track');}
document.querySelectorAll('.form-link').forEach(a=>a.href=cfg.formUrl);
$('#connection').textContent=appUrl()?'ส่งเรื่องผ่าน Google Form · ติดตามด้วย QR เฉพาะเรื่อง':'เปิดแบบฟอร์มร้องเรียนได้ — ระบบติดตามยังไม่ได้ตั้งค่าเชื่อมต่อ';
const cats=['อาหาร','ยา','สมุนไพร','เครื่องสำอาง','วัตถุอันตราย','เครื่องมือแพทย์','สถานพยาบาลและคลินิก','สถานประกอบการเพื่อสุขภาพ','โฆษณาผลิตภัณฑ์สุขภาพ','อื่น ๆ'];
cats.forEach((c,i)=>{const a=document.createElement('a');a.className='category';a.href=cfg.formUrl;a.target='_blank';a.rel='noopener noreferrer';const span=document.createElement('span');span.textContent=['♧','✚','❧','✦','⚠','⊕','▣','❀','◉','⋯'][i];a.append(span,document.createTextNode(c));$('#categories').append(a)});
if(typeof qrcode==='function'){const qr=qrcode(0,'M');qr.addData(cfg.formUrl);qr.make();$('#formQr').innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});}
$('#trackForm').addEventListener('submit',e=>{e.preventDefault();try{openTracking($('#tracking').value)}catch(x){$('#trackMessage').textContent=x.message}});
const initial=new URLSearchParams(location.hash.slice(1)).get('t');if(initial){try{openTracking(initial);$('#track').scrollIntoView()}catch(x){$('#trackMessage').textContent=x.message}}
