const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),front=fs.existsSync(path.join(root,'frontend'))?path.join(root,'frontend'):root;
const jpeg=Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAeABQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5Xooor+5D+OwooooAKKKKACiiigD/2Q==','base64'));
const canvasCalls=[];const urls=[];
const ctx={window:{},TextEncoder,Uint8Array,Blob,atob,URL:{createObjectURL:()=>{urls.push('blob:test');return 'blob:test'},revokeObjectURL:u=>urls.push('revoked:'+u)},Image:class{constructor(){this.naturalWidth=20;this.naturalHeight=30}decode(){return Promise.resolve()}},document:{createElement:name=>({width:0,height:0,getContext:()=>({fillRect(){},drawImage:(...args)=>canvasCalls.push(args.slice(1))}),toBlob:callback=>callback(new Blob([jpeg],{type:'image/jpeg'}))})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(front,'public-document.js'),'utf8'),ctx);
(async()=>{
const pdf=ctx.window.PublicDocumentPdf.jpegPdf(jpeg,20,30);assert.equal(pdf.type,'application/pdf');
const bytes=Buffer.from(await pdf.arrayBuffer()),text=bytes.toString('latin1');assert(text.startsWith('%PDF-1.4'));assert(text.includes('/MediaBox [0 0 595.28 892.92]'));
const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
const entries=text.slice(xref).split('\n').slice(3,8);entries.forEach((entry,i)=>{const offset=Number(entry.slice(0,10));assert.equal(text.slice(offset,offset+7),(i+1)+' 0 obj')});
const direct=await ctx.window.PublicDocumentPdf.fromPayload({mime:'application/pdf',base64:bytes.toString('base64')});assert.deepEqual(Buffer.from(await direct.arrayBuffer()),bytes,'PDF files pass through unchanged');
const converted=await ctx.window.PublicDocumentPdf.fromPayload({mime:'image/png',base64:Buffer.from('image fixture').toString('base64')});assert.equal(converted.type,'application/pdf');assert.deepEqual(canvasCalls[0],[0,0,20,30]);assert(urls.includes('revoked:blob:test'));
await assert.rejects(()=>ctx.window.PublicDocumentPdf.fromPayload({mime:'application/pdf',base64:Buffer.from('not a PDF').toString('base64')}),/PDF/);
await assert.rejects(()=>ctx.window.PublicDocumentPdf.fromPayload({mime:'text/html',base64:'AA=='}),/รองรับ/);
assert.throws(()=>ctx.window.PublicDocumentPdf.jpegPdf(new Uint8Array([0,0,0,0]),20,30));
if(process.env.PDF_TEST_OUTPUT)fs.writeFileSync(process.env.PDF_TEST_OUTPUT,bytes);
console.log('PASS: valid PDF cross-reference offsets, full image aspect ratio, PDF passthrough, image conversion, URL cleanup and invalid file handling');
})().catch(e=>{console.error(e);process.exitCode=1});
