/* Single-page PDF wrapper for public infographic images. No external service. */
(function(root){
 'use strict';
 const encode=s=>new TextEncoder().encode(s);
 function jpegPdf(jpeg,width,height){
  if(!(jpeg instanceof Uint8Array)||jpeg.length<4||jpeg[0]!==255||jpeg[1]!==216||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('ภาพสำหรับสร้าง PDF ไม่ถูกต้อง');
  const pageWidth=595.28,pageHeight=Number((pageWidth*height/width).toFixed(2));
  const chunks=[],offsets=[0];let length=0;
  const push=data=>{const bytes=typeof data==='string'?encode(data):data;chunks.push(bytes);length+=bytes.length};
  const object=(id,data)=>{offsets[id]=length;push(id+' 0 obj\n'+data+'\nendobj\n')};
  push('%PDF-1.4\n');push(new Uint8Array([37,226,227,207,211,10]));
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=length;push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n');push(jpeg);push('\nendstream\nendobj\n');
  const commands='q\n'+pageWidth+' 0 0 '+pageHeight+' 0 0 cm\n/Im0 Do\nQ\n';
  object(5,'<< /Length '+encode(commands).length+' >>\nstream\n'+commands+'endstream');
  const xref=length;push('xref\n0 6\n0000000000 65535 f \n');
  for(let id=1;id<=5;id++)push(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
  push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
 }
 function bytesOf(p){if(!p||typeof p.base64!=='string'||!p.base64.length||p.base64.length>28000000)throw Error('ไฟล์ไม่พร้อมใช้งาน');return Uint8Array.from(atob(p.base64),x=>x.charCodeAt(0))}
 async function fromPayload(p){
  const bytes=bytesOf(p);
  if(p.mime==='application/pdf'){
   if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('ไฟล์ PDF ไม่ถูกต้อง');
   return new Blob([bytes],{type:'application/pdf'});
  }
  if(!['image/png','image/jpeg','image/webp'].includes(p.mime))throw Error('รองรับเฉพาะภาพและ PDF');
  const source=URL.createObjectURL(new Blob([bytes],{type:p.mime}));
  const img=new Image();img.loading='eager';
  try{
   img.src=source;await img.decode();
   if(!img.naturalWidth||!img.naturalHeight)throw Error('เปิดภาพไม่ได้');
   // Bound canvas memory on phones, preserving aspect ratio and all content.
   const scale=Math.min(1,8000/Math.max(img.naturalWidth,img.naturalHeight),Math.sqrt(16000000/(img.naturalWidth*img.naturalHeight)));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('อุปกรณ์นี้ไม่พร้อมแสดงภาพเป็น PDF');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('สร้าง PDF ไม่สำเร็จ')),'image/jpeg',0.96));
   const pdf=jpegPdf(new Uint8Array(await jpeg.arrayBuffer()),canvas.width,canvas.height);
   canvas.width=canvas.height=1;return pdf;
  }finally{URL.revokeObjectURL(source)}
 }
 root.PublicDocumentPdf={fromPayload,jpegPdf};
})(window);
