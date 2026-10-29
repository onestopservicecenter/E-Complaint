function uid(){const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
const cfg=window.APP_CONFIG,$=s=>document.querySelector(s),make=(t,s='')=>{const e=document.createElement(t);e.textContent=s;return e};
const CATEGORIES=['อาหาร','ยา','สมุนไพร','เครื่องสำอาง','วัตถุอันตราย','เครื่องมือแพทย์','สถานพยาบาลและคลินิก','สถานประกอบการเพื่อสุขภาพ','โฆษณาผลิตภัณฑ์สุขภาพ','อื่น ๆ'];
let session='',user=null,bridgeWindow=null,bridgeOrigin='',bridgeReady=false,loginClient=null,loginState=null,loginPreparation=null;
const pending=new Map(),channel=uid(),browserKey=uid()+uid();
function notice(s){$('#toast').textContent=s;$('#toast').classList.add('shown');setTimeout(()=>$('#toast').classList.remove('shown'),6000)}
function endpoint(){try{const u=new URL(cfg.webAppUrl);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)?u:null}catch{return null}}
window.addEventListener('message',e=>{const d=e.data;if(!d||d.channel!==channel||!/^https:\/\/[a-z0-9.-]*googleusercontent\.com$/.test(e.origin))return;if(d.type==='NPT2_READY'&&!bridgeReady){bridgeWindow=e.source;bridgeOrigin=e.origin;bridgeReady=true;document.dispatchEvent(new Event('service-ready'));return}if(e.source!==bridgeWindow||e.origin!==bridgeOrigin||d.type!=='NPT2_RESPONSE')return;const p=pending.get(d.id);if(p){clearTimeout(p.timer);pending.delete(d.id);d.ok?p.resolve(d.data):p.reject(Error(d.error||'ระบบไม่พร้อมใช้งาน'));if(!d.ok&&String(d.error).includes('หมดเวลาเข้าสู่ระบบ')){session='';user=null;renderIdentity()}}});
async function api(action,data={}){if(!endpoint())throw Error('ระบบอยู่ระหว่างการตั้งค่า กรุณาลองใหม่ภายหลัง');if(!bridgeReady)throw Error('กำลังเชื่อมต่อบริการ กรุณารอสักครู่');return new Promise((resolve,reject)=>{const id=uid(),timer=setTimeout(()=>{pending.delete(id);reject(Error('หมดเวลารอ กรุณาตรวจสอบรายการก่อนส่งซ้ำ'))},120000);pending.set(id,{resolve,reject,timer});bridgeWindow.postMessage({type:'NPT2_REQUEST',channel,id,action,data,session},bridgeOrigin)})}
function renderIdentity(){const signed=!!user;$('#identity').textContent=signed?user.email:'ยังไม่ได้เข้าสู่ระบบ';$('#login').classList.toggle('hidden',signed);$('#logout').classList.toggle('hidden',!signed);document.querySelectorAll('.login-gate').forEach(e=>e.classList.toggle('hidden',signed));$('#complaintForm')?.classList.toggle('hidden',!signed);$('#refreshCases')?.classList.toggle('hidden',!signed);document.dispatchEvent(new Event('identity-changed'))}
async function prepareLogin(){if(loginPreparation)return loginPreparation;loginPreparation=(async()=>{if(!window.google?.accounts?.oauth2)throw Error('บริการเข้าสู่ระบบยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง');if(!cfg.googleClientId)throw Error('ระบบเข้าสู่ระบบอยู่ระหว่างการตั้งค่า');loginState=await api('beginLogin',{browserKey});loginClient=google.accounts.oauth2.initCodeClient({client_id:cfg.googleClientId,scope:'openid email profile',ux_mode:'popup',state:loginState.state,callback:async r=>{try{if(r.error||!r.code)throw Error('ไม่สามารถเข้าสู่ระบบได้');const answer=await api('completeLogin',{code:r.code,state:loginState.state,browserKey});session=answer.session;user=answer.user;renderIdentity();notice('เข้าสู่ระบบแล้ว');if($('#myCases'))await loadMyCases()}catch(e){notice(e.message)}finally{loginClient=null;loginPreparation=null;loginState=null;prepareLogin().catch(()=>{})}},error_callback:()=>notice('ไม่สามารถเปิดหน้าต่างเข้าสู่ระบบได้ กรุณาอนุญาตป๊อปอัปแล้วลองใหม่')});return loginClient})().catch(e=>{loginPreparation=null;throw e});return loginPreparation}
function login(){if(loginClient){loginClient.requestCode();return}prepareLogin().then(()=>notice('พร้อมเข้าสู่ระบบแล้ว กรุณากดปุ่มเข้าสู่ระบบอีกครั้ง')).catch(e=>notice(e.message))}
$('#login').onclick=login;document.querySelectorAll('.login-button').forEach(b=>b.onclick=login);$('#logout').onclick=async()=>{try{await api('logout')}catch{}session='';user=null;$('#myCases')?.replaceChildren();$('#caseBody')?.replaceChildren();$('#caseDialog')?.close();$('#staffCaseDialog')?.close();renderIdentity();notice('ออกจากระบบแล้ว')};document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
async function uploadFiles(input){const files=[...input.files];if(files.length>3||files.some(f=>f.size>5242880))throw Error('แนบได้ไม่เกิน 3 ไฟล์ ไฟล์ละไม่เกิน 5 MB');return Promise.all(files.map(f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:f.name,base64:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('อ่านไฟล์ไม่ได้'));reader.readAsDataURL(f)})))}
async function openFile(id,holder,publicAsset=false){const p=await api(publicAsset?'publicFile':'file',{id});const bytes=Uint8Array.from(atob(p.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:p.mime}));if(holder&&p.mime.startsWith('image/')){const img=make('img');img.src=url;img.alt=p.name;img.className='preview';holder.append(img)}const a=make('a','ดาวน์โหลด '+p.name);a.href=url;a.download=p.name;if(holder)holder.append(a);else a.click();setTimeout(()=>URL.revokeObjectURL(url),300000)}
function safeLink(s){try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}}
const publicImageCache=new Map(),publicImageRequests=new Map();
const BANNER_CACHE_KEY='npt-public-banner-v1:'+cfg.webAppUrl;
const BANNER_CACHE_TTL=24*60*60*1000;
function imageKey(c,fullSize=true){return JSON.stringify([c.fileId,String(c.updatedAt||''),fullSize])}
function validImagePayload(p){return p&&['image/jpeg','image/png','image/webp'].includes(p.mime)&&typeof p.base64==='string'&&p.base64.length>0&&p.base64.length<=7000000&&/^[A-Za-z0-9+/]*={0,2}$/.test(p.base64)}
function rememberImage(key,p){publicImageCache.delete(key);publicImageCache.set(key,p);while(publicImageCache.size>12)publicImageCache.delete(publicImageCache.keys().next().value)}
async function publicImage(c,fullSize){const key=imageKey(c,fullSize);if(publicImageCache.has(key))return publicImageCache.get(key);if(!fullSize){const saved=savedPreview(key);if(saved){rememberImage(key,saved);return saved}}if(publicImageRequests.has(key))return publicImageRequests.get(key);const task=(async()=>{const p=await api(fullSize?'publicFile':'publicImage',{id:c.fileId});if(!validImagePayload(p))throw Error('ข้อมูลภาพไม่ถูกต้อง');rememberImage(key,p);return p})();publicImageRequests.set(key,task);try{return await task}finally{publicImageRequests.delete(key)}}
async function imageFor(fileId,img,fullSize=false,updatedAt=''){img.hidden=true;img.loading='eager';try{const p=await publicImage({fileId,updatedAt},fullSize);img.src='data:'+p.mime+';base64,'+p.base64;if(typeof img.decode==='function')await img.decode();img.hidden=false;if(!fullSize)cachePreview({fileId,updatedAt},img);return true}catch{img.hidden=true;return false}}
function bannerStatus(text=''){const s=$('#bannerStatus');if(s){s.textContent=text;s.hidden=!text}}
function readPublicStorage(key){try{return localStorage.getItem(key)||sessionStorage.getItem(key)}catch{try{return sessionStorage.getItem(key)}catch{return null}}}
function writePublicStorage(key,value){try{localStorage.setItem(key,value);return}catch{}try{sessionStorage.setItem(key,value)}catch{}}
function removePublicStorage(key){try{localStorage.removeItem(key)}catch{}try{sessionStorage.removeItem(key)}catch{}}
function saveBannerCache(c){try{const p=publicImageCache.get(imageKey(c));if(p&&p.base64.length<=3000000)writePublicStorage(BANNER_CACHE_KEY,JSON.stringify({at:Date.now(),item:{fileId:c.fileId,updatedAt:c.updatedAt,title:c.title||'',link:c.link||''},image:p}))}catch{/* Storage may be disabled or full. Rendering must still work. */}}
function clearBannerCache(){try{removePublicStorage(BANNER_CACHE_KEY)}catch{}}
async function bannerElement(c){const a=make('a');a.className='published-banner hidden';a.dataset.fileKey=imageKey(c);const href=safeLink(c.link);if(href){a.href=href;a.target='_blank';a.rel='noopener noreferrer'}const img=make('img');img.alt=c.title||'แบนเนอร์ประชาสัมพันธ์';a.append(img);const ok=await imageFor(c.fileId,img,true,c.updatedAt);return ok?a:null}
async function restoreBannerCache(){if(!$('#banners'))return;try{const c=JSON.parse(readPublicStorage(BANNER_CACHE_KEY)||'null');if(!c||!Number.isFinite(c.at)||Date.now()-c.at>BANNER_CACHE_TTL||c.at>Date.now()||typeof c.item?.fileId!=='string'||!validImagePayload(c.image)){clearBannerCache();return}rememberImage(imageKey(c.item),c.image);const a=await bannerElement(c.item);if(!a||bannerCatalogSeen)return;slides=[a];$('#banners').replaceChildren(a);showSlide(0);bannerStatus()}catch{clearBannerCache()}}
let slides=[],slideIndex=0,bannerSignature='',bannerCatalogSeen=false,contentLoading=false;
const sectionSignatures=new Map();
function showSlide(n){if(!slides.length)return;slideIndex=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('hidden',i!==slideIndex));$('#bannerCount').textContent=(slideIndex+1)+' / '+slides.length}
async function renderBanners(items,sourceUnavailable=false){bannerCatalogSeen=true;if(sourceUnavailable){if(!slides.length)bannerStatus('โหลดแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่ภายหลัง');return}const signature=JSON.stringify(items.map(c=>[c.fileId,c.updatedAt,c.title,c.link]));if(signature===bannerSignature)return;if(!items.length){slides=[];slideIndex=0;$('#banners').replaceChildren();$('#bannerCount').textContent='';bannerSignature=signature;clearBannerCache();bannerStatus('ยังไม่มีแบนเนอร์ที่เผยแพร่');return}const staged=[];let failed=false;for(const c of items){const a=await bannerElement(c);if(!a){failed=true;continue}staged.push(a);if(!slides.length){slides=[a];$('#banners').replaceChildren(a);showSlide(0);bannerStatus();saveBannerCache(c)}}if(!staged.length){if(!slides.length)bannerStatus('โหลดภาพแบนเนอร์ไม่สำเร็จ กรุณาลองใหม่ภายหลัง');return}const current=slides[slideIndex]?.dataset.fileKey;slides=staged;$('#banners').replaceChildren(...slides);const selected=slides.findIndex(a=>a.dataset.fileKey===current);showSlide(selected<0?0:selected);bannerStatus();saveBannerCache(items.find(c=>imageKey(c)===slides[0].dataset.fileKey));if(!failed)bannerSignature=signature;}
const PREVIEW_STORAGE_KEY='npt-public-previews-v1:'+cfg.webAppUrl;
const CARD_STORAGE_KEY='npt-public-cards-v1:'+cfg.webAppUrl;
function readPublicCache(key){try{const value=JSON.parse(readPublicStorage(key)||'null');if(value&&Number.isFinite(value.at)&&Date.now()-value.at<86400000&&value.at<=Date.now()&&value.data&&typeof value.data==='object'&&!Array.isArray(value.data))return value.data}catch{}return {}}
const savedPreviews=readPublicCache(PREVIEW_STORAGE_KEY),savedCards=readPublicCache(CARD_STORAGE_KEY);
function savePublicCache(key,data){try{writePublicStorage(key,JSON.stringify({at:Date.now(),data}))}catch{}}
function savedPreview(key){const p=savedPreviews[key];return validImagePayload(p)?p:null}
function cachePreview(c,img){
 try{
  if(savedPreview(imageKey(c,false))||!img.naturalWidth||!img.naturalHeight)return;
  const canvas=document.createElement('canvas'),scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)return;
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
  const value=canvas.toDataURL('image/jpeg',0.86).split(',')[1];canvas.width=canvas.height=1;
  if(!value||value.length>600000)return;
  const key=imageKey(c,false);delete savedPreviews[key];savedPreviews[key]={mime:'image/jpeg',base64:value};
  let size=Object.values(savedPreviews).reduce((n,p)=>n+(p.base64?.length||0),0);
  for(const oldKey of Object.keys(savedPreviews)){if(size<=1200000)break;size-=savedPreviews[oldKey].base64?.length||0;delete savedPreviews[oldKey]}
  savePublicCache(PREVIEW_STORAGE_KEY,savedPreviews);
 }catch{/* Browsing must work even when canvas or storage is unavailable. */}
}
function contentTitle(c){const title=String(c.title||'').replace(/\.(png|jpe?g|webp|pdf)$/i,'').trim();return /^\d+$/.test(title)?'':title}
function contentFileUrl(c){return typeof c.fileId==='string'&&/^[A-Za-z0-9_-]+$/.test(c.fileId)?'https://drive.google.com/file/d/'+encodeURIComponent(c.fileId)+'/view':safeLink(c.link)}
function readMore(c){
 const href=contentFileUrl(c);
 if(href){const a=make('a','อ่านเพิ่มเติม →');a.className='read-more-button';a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
 const b=make('button','อ่านเพิ่มเติม →');b.className='read-more-button';b.onclick=()=>{const body=$('#articleBody');body.replaceChildren(make('h2',contentTitle(c)||(c.type==='alert'?'ข่าวเตือนภัย':'ข่าวประชาสัมพันธ์')),make('pre',c.body||''));$('#article').showModal()};return b;
}
function renderPublicCards(type,items,restoring=false){
 const holder=$(type==='news'?'#newsCards':'#alertCards');if(!holder)return;
 const signature=JSON.stringify(items);if(sectionSignatures.get(type)===signature)return;
 sectionSignatures.set(type,signature);holder.replaceChildren();
 if(!items.length){if(!restoring){savedCards[type]=[];savePublicCache(CARD_STORAGE_KEY,savedCards)}holder.append(make('p',type==='news'?'ยังไม่มีข่าวประชาสัมพันธ์ที่เผยแพร่':'ยังไม่มีข่าวเตือนภัยที่เผยแพร่'));return}
 items.forEach(c=>{
  const card=make('article');card.className='news-card';const title=contentTitle(c),href=contentFileUrl(c);
  if(c.fileId&&(String(c.mime).startsWith('image/')||c.mime==='application/pdf')){
   const img=make('img');img.alt=title||(type==='alert'?'ข่าวเตือนภัย':'ข่าวประชาสัมพันธ์');img.loading='eager';
   const link=make('a');link.className='news-image-button';link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label','เปิดไฟล์ '+img.alt);link.append(img);card.append(link);
   imageFor(c.fileId,img,false,c.updatedAt).then(ok=>{if(!ok)sectionSignatures.delete(type)});
  }
  card.append(make('small',new Date(c.updatedAt).toLocaleDateString('th-TH')));if(title)card.append(make('h3',title));card.append(readMore(c));holder.append(card);
 });
 if(!restoring){savedCards[type]=items.map(c=>({type:c.type,fileId:c.fileId,mime:c.mime,title:c.title,link:c.link,updatedAt:c.updatedAt}));savePublicCache(CARD_STORAGE_KEY,savedCards);}
}
function restorePublicCards(){
 ['news','alert'].forEach(type=>{
  const items=Array.isArray(savedCards[type])?savedCards[type].filter(c=>c&&c.type===type&&savedPreview(imageKey(c,false))):[];
  if(items.length)renderPublicCards(type,items,true);
 });
}
async function loadContent(){
 if(!$('#newsCards')||contentLoading)return;contentLoading=true;
 try{
  const r=await api('catalog');if(!r||!Array.isArray(r.items))throw Error('รายการเนื้อหาไม่ถูกต้อง');
  $('#contact').textContent=r.contact||'';if(r.privacyText)$('#privacyText').textContent=r.privacyText;
  ['news','alert'].forEach(type=>{if(!r.sourceIssues?.includes(type))renderPublicCards(type,r.items.filter(c=>c.type===type))});
  await renderBanners(r.items.filter(c=>c.type==='banner'),r.sourceIssues?.includes('banner'));
 }catch(e){if(!slides.length)bannerStatus('โหลดแบนเนอร์ไม่สำเร็จ: '+e.message);notice(e.message)}finally{contentLoading=false}
}

async function loadMyCases(){if(!user)return;try{const r=await api('myCases');const holder=$('#myCases');holder.replaceChildren();if(!r.length)holder.append(make('p','ยังไม่มีเรื่องร้องเรียนในบัญชีนี้'));r.forEach(c=>{const a=make('article');a.className='case-card';a.append(make('strong',c.id),make('h3',c.subject),make('span',c.status));const b=make('button','ดูสถานะและเอกสารตอบกลับ');b.onclick=()=>openMyCase(c.id);a.append(b);holder.append(a)});const id=new URLSearchParams(location.hash.slice(1)).get('case');if(id)await openMyCase(id)}catch(e){$('#trackMessage').textContent=e.message}}
async function openMyCase(id){try{const c=await api('case',{id}),holder=$('#caseBody');holder.replaceChildren(make('h2',c.id),make('h3',c.subject),make('p','สถานะ: '+c.status));c.updates.slice().reverse().forEach(u=>{const a=make('article');a.append(make('small',new Date(u.at).toLocaleString('th-TH')),make('h3',u.status),make('pre',u.note));u.files.forEach(f=>{const b=make('button',(f.mime.startsWith('image/')?'ดูรูปภาพ: ':'เปิดเอกสาร: ')+f.name);b.onclick=()=>openFile(f.id,a).catch(e=>notice(e.message));a.append(b)});(u.links||[]).forEach(l=>{const url=safeLink(l.url);if(url){const link=make('a',l.title+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';a.append(link)}});holder.append(a)});const details=make('details');details.append(make('summary','QR สำหรับกลับมาติดตามเรื่องนี้'));const qr=qrcode(0,'M');qr.addData(location.origin+location.pathname+'#case='+encodeURIComponent(c.id));qr.make();const div=make('div');div.className='qr';div.innerHTML=qr.createSvgTag({cellSize:4,margin:4,scalable:true});details.append(div,make('p','ต้องเข้าสู่ระบบด้วยบัญชีผู้ร้องเดิมเพื่อดูข้อมูล'));holder.append(details);$('#caseDialog').showModal()}catch(e){notice(e.message)}}
if($('#complaintForm')){CATEGORIES.forEach(c=>$('#category').add(new Option(c,c)));$('#prevAlert').onclick=()=>$('#alertCards').scrollBy({left:-380,behavior:'smooth'});$('#nextAlert').onclick=()=>$('#alertCards').scrollBy({left:380,behavior:'smooth'});$('#prevBanner').onclick=()=>showSlide(slideIndex-1);$('#nextBanner').onclick=()=>showSlide(slideIndex+1);setInterval(()=>{if(!document.hidden)showSlide(slideIndex+1)},7000);$('#refreshCases').onclick=loadMyCases;let submitId=uid();$('#complaintForm').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const form=e.target;if(!form.elements.namedItem('acknowledge').checked)throw Error('กรุณารับทราบการใช้ข้อมูล');const files=await uploadFiles(form.elements.namedItem('files'));const r=await api('submit',{requestId:submitId,category:form.elements.namedItem('category').value,subject:form.elements.namedItem('subject').value,details:form.elements.namedItem('details').value,location:form.elements.namedItem('location').value,name:form.elements.namedItem('name').value,phone:form.elements.namedItem('phone').value,acknowledge:true,files});$('#submitResult').textContent='รับเรื่องแล้ว เลขรับเรื่อง '+r.id;form.reset();submitId=uid();await loadMyCases()}catch(x){$('#submitResult').textContent=x.message}finally{b.disabled=false}}}
document.addEventListener('service-ready',()=>{loadContent();prepareLogin().catch(()=>{})});setTimeout(()=>{if(!bridgeReady&&!slides.length&&$('#bannerStatus'))$('#bannerStatus').textContent='ยังเชื่อมต่อบริการแบนเนอร์ไม่ได้ กรุณาลองใหม่ภายหลัง'},20000);setInterval(()=>{if(bridgeReady&&!document.hidden&&$('#newsCards'))loadContent()},60000);const url=endpoint();if(url){url.searchParams.set('channel',channel);$('#bridge').src=url.href}else{setTimeout(()=>notice('ระบบอยู่ระหว่างการตั้งค่า การเข้าสู่ระบบและรับเรื่องยังไม่เปิดใช้งาน'),500)}

if($('#menuToggle')){$('#menuToggle').onclick=()=>{const expanded=$('#menuToggle').getAttribute('aria-expanded')==='true';$('#menuToggle').setAttribute('aria-expanded',String(!expanded));$('#mainNav').classList.toggle('menu-open',!expanded)};$('#mainNav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#mainNav').classList.remove('menu-open');$('#menuToggle').setAttribute('aria-expanded','false')}))}

function routePage(){if(!$('#complaintForm'))return;const hash=location.hash.slice(1),name=hash.split('?')[0];const route=new URLSearchParams(hash).has('case')?'track':(['complaint','track','about','privacy'].includes(name)?name:'home');const home=route==='home';$('#news').hidden=!home;$('#alerts').hidden=!home;const banner=$('#bannerSection');banner.hidden=false;['complaint','track','about','privacy'].forEach(id=>$('#'+id).hidden=id!==route);$('#mainNav').querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+(home?'home':route)));if(!home)requestAnimationFrame(()=>$('#'+route).scrollIntoView({block:'start'}));}
window.addEventListener('hashchange',routePage);routePage();


restoreBannerCache();



restorePublicCards();
