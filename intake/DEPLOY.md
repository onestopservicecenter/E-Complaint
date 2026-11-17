# E-Complaint — ชุดไฟล์สำหรับตรวจสอบและนำไป Deploy (ยังไม่เปิดรับข้อมูลจริง)

**สถานะวันที่ 17 พ.ย. 2569:** จัดไฟล์ Google Apps Script สำหรับ 4 ประเภทคำร้องแล้ว แต่ยังไม่มี Google OAuth Client ID, Deployment URL ที่ยืนยัน, ระบบ Admin/Staff แบบ Username/Password และโฟลเดอร์ Production ส่วนตัวครบทั้งสี่ประเภทภายใต้ `ossc73@gmail.com`. ห้ามรับข้อมูลประชาชนจนกว่าทุกข้อผ่านการทดสอบ

## รายการไฟล์ที่ใช้ทั้งหมด

| ไฟล์ใน GitHub | ชื่อไฟล์ใน Google Apps Script | หน้าที่ |
|---|---|---|
| `intake/Code.gs` | `Code.gs` | Backend การรับเรื่อง เก็บไฟล์ ตรวจ Google ID Token และ audit |
| `intake/Reward.html` | `Reward.html` | ฟอร์มประสงค์ขอรับเงินสินบนนำจับ |
| `intake/Intake.html` | `Intake.html` | ฟอร์มไม่ประสงค์ขอรับเงินสินบนนำจับ (ยังต้องยืนยันข้อกำหนด) |
| `intake/Inspection.html` | `Inspection.html` | ฟอร์มแจ้งตรวจสอบมาตรฐานผลิตภัณฑ์/สถานประกอบการ | 
| `intake/Ossc.html` | `Ossc.html` | ฟอร์มร้องเรียนการบริการ OSSC | 
| `intake/Staff.html` | `Staff.html` | Dashboard เจ้าหน้าที่ต้นแบบ Google Login (ยังไม่ใช่ Username/Password ตามข้อกำหนดล่าสุด) |
| `intake/CitizenStatus.html` | `CitizenStatus.html` | หน้าติดตามสถานะด้วยบัญชี Google ผู้ร้อง |
| `intake/appsscript.json` | `appsscript.json` | ตั้งค่า V8 และ Scope ของ Apps Script |

ไฟล์ README และ DEPLOY ใช้สำหรับอ่านคำแนะนำ **ไม่ต้อง** อัปโหลดเป็นไฟล์รันของ Apps Script.

## ขั้นตอนติดตั้งในบัญชีกลาง

1. ลงชื่อเข้าใช้ Google ด้วยบัญชีที่หน่วยงานกำหนดให้เป็นเจ้าของระบบ: `ossc73@gmail.com` (อย่าส่งรหัสผ่านผ่านแชท)
2. สร้างโฟลเดอร์ส่วนตัวใหม่จาก **My Drive ของบัญชีกลางนี้**: `E-Complaint Confidential Intake`. สร้างโฟลเดอร์ย่อย 4 โฟลเดอร์: `ประสงค์ขอรับเงินสินบนนำจับ`, `ไม่ประสงค์ขอรับเงินสินบนนำจับ`, `แจ้งตรวจสอบมาตรฐานผลิตภัณฑ์/สถานประกอบการ` และ `ร้องเรียนการบริการ OSSC`. **ไม่เลือก Anyone with the link**. อย่าดัดแปลงโฟลเดอร์ที่ใช้ร่วมกับเว็บไซต์สาธารณะ
3. คัดลอก Folder ID ใหม่ทั้ง 5 ไปแทนที่ `ROOT`, `REWARD`, `NO_REWARD`, `INSPECTION`, `OSSC` ใน `Code.gs`. ตรวจว่ากรรมสิทธิ์เป็น `ossc73@gmail.com`; โปรแกรมมี `verifyProductionOwnership_()` บล็อกอัตโนมัติถ้ายังใช้โฟลเดอร์ Editor
4. เปิด https://script.google.com/home/projects/create **ขณะลงชื่อเข้าใช้บัญชีกลาง** แล้วสร้างโปรเจกต์ใหม่ ตั้งชื่อ `E-Complaint Production` (ไม่ทับ Apps Script เดิม)
5. วางโค้ดใน `Code.gs`, สร้างไฟล์ HTML **ชื่อเหมือนตาราง** ให้ครบ 6 หน้า ได้แก่ Reward, Intake, Inspection, Ossc, Staff, CitizenStatus และวางเนื้อหาทั้งหมดจาก GitHub; เปิด Project Settings → Show "appsscript.json" manifest file in editor แล้วคัดลอกไฟล์ manifest
6. เปิด https://console.cloud.google.com/ ภายใต้ Google Cloud Project ของหน่วยงาน ตั้งค่า Google Auth Platform / OAuth consent screen ตามนโยบายและสร้าง OAuth Client ID ประเภท Web application. กำหนด Authorized JavaScript origins ตาม URL ต้นทางที่ Google Identity Services ใช้งานจริง; ไม่ควรเดา URL นี้. วาง Client ID (ไม่ใช่ Client Secret) ใน `GOOGLE_CLIENT_ID`. ตรวจ Google Login จริงใน Apps Script HTML Service
7. Project Settings → Script properties เพิ่ม `STAFF_EMAILS` เฉพาะบัญชีเจ้าหน้าที่ที่มีสิทธิ์ **สำหรับทดสอบเท่านั้น**. ระบบ Production ที่สรุปไว้ต้องให้ Admin จัดการ Username/Password ผ่านระบบ Authentication ที่เหมาะสม (ยังไม่ได้สร้าง) จึง **ยังห้ามเปิด Staff หน้านี้ให้ทำงานกับข้อมูลจริง**
8. ใน Apps Script Editor เรียก `setupIntake()` เพื่อสร้างทะเบียน Sheets ส่วนตัว (Cases / AuditLog / CaseResponses). โปรดตรวจว่าทะเบียนใหม่เป็นของบัญชีกลาง และไม่เปิดสิทธิ์สาธารณะ
9. เรียก `checkDeploymentReadiness()` ต้องไม่เกิดข้อผิดพลาดและต้องรายงานผ่านบัญชีเจ้าของ โฟลเดอร์ส่วนตัว และทะเบียน
10. Deploy → New deployment → Web app; ระบุ Execute as: Me (เจ้าของบัญชีกลาง) และตั้งสิทธิ์ให้ตรงกลุ่มผู้ทดสอบ. หากต้องให้ประชาชนเข้าสู่หน้า Web App ได้ในอนาคต ต้องตรวจ OAuth/สิทธิ์อีกครั้งก่อนเลือกการเข้าถึงแบบสาธารณะ
11. ทดสอบหน้าด้วย URL ที่ Google Apps Script คืนมาเท่านั้น:
   - `/exec?intent=reward` — ฟอร์มประสงค์
   - `/exec?intent=no-reward` — ฟอร์มไม่ประสงค์
   - `/exec?intent=inspection` — แจ้งตรวจสอบมาตรฐานผลิตภัณฑ์/สถานประกอบการ
   - `/exec?intent=ossc` — ร้องเรียนการบริการ OSSC
   - `/exec?view=citizen` — ติดตามเรื่อง
   - `/exec?view=staff` — Dashboard เจ้าหน้าที่ต้นแบบ
12. ใช้ **ข้อมูลสมมติเท่านั้น** ทดสอบ Google Login, การส่งเรื่อง, 1 เรื่อง = 1 โฟลเดอร์, สถิติรายวัน, Audit Log, การปฏิเสธบัญชีอื่น, การแจ้งผลโดยไม่ส่งรายละเอียดผ่าน Gmail และการส่งซ้ำ. ลบข้อมูลทดสอบอย่างมีขั้นตอนหลังเสร็จ
13. หลังผ่านการทดสอบความปลอดภัย การอนุมัติ PDPA, ระบบ Admin/Staff ชื่อผู้ใช้และรหัสผ่าน และการย้ายข้อมูลภายใต้บัญชีกลางแล้ว **จึง** เปลี่ยนลิงก์ `index.html` ของเว็บไซต์เดิมไปยัง Web App `target="_blank"`

## ความเสี่ยงที่ยังต้องจัดการก่อน Production

- ปัจจุบัน `Code.gs` ใน GitHub ยังชี้โฟลเดอร์ **staging** ของ Editor `thanaporn.map@thaimooc.ac.th`. ทำให้ `checkDeploymentReadiness()` และการสร้างคำร้องถูกบล็อกโดยตั้งใจ จนกว่าจะเปลี่ยนเป็น Folder ID ของบัญชีกลาง
- OAuth Client ID ยังเป็น `SET_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com`; ยังไม่ทดสอบ Google Identity Services ใน Apps Script HTML Service
- หน้า Staff ยังล็อกอิน Google + รายชื่อ `STAFF_EMAILS`; **ยังไม่มี** Admin สร้าง Username/Password ที่กำหนดไว้ จึงไม่ใช่ระบบ Staff Production
- ยังไม่ได้ตรวจอนุญาตการเปิดเผยข้อมูลส่วนบุคคล ระยะเวลาเก็บเอกสาร และกระบวนการตอบกลับของหน่วยงาน
- ไฟล์ 10 MB ต่อไฟล์ตามหน้าฟอร์มอาจติดข้อจำกัดขนาด/เวลา Apps Script; ต้องทดสอบจริงด้วยข้อมูลจำลองก่อนเปิดใช้
- ประวัติ AuditLog ปัจจุบันเก็บใน Sheets ไม่ใช่ระบบที่ป้องกันการแก้ไขย้อนหลัง (immutable)
- ไม่มีข้อมูล URL Web App จริงหรือผลทดสอบ End-to-End จากบัญชีกลาง ณ เวลาจัดชุดนี้

## เอกสารอ้างอิงการติดตั้ง

- Google Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- HTML Service: https://developers.google.com/apps-script/guides/html
- Google Identity Services: https://developers.google.com/identity/gsi/web/guides/overview
- Google OAuth setup: https://developers.google.com/identity/protocols/oauth2
- Google Apps Script deployment: https://developers.google.com/apps-script/concepts/deployments

**ข้อมูลข้างต้นเป็นคำแนะนำการติดตั้งจากแนวทางผลิตภัณฑ์ ไม่ใช่หลักฐานว่าระบบบัญชีนี้ได้รับอนุญาตหรือ Deploy แล้ว**

## การตรวจสอบหน้าเว็บไซต์ GitHub ก่อน Deploy

ผู้ใช้สามารถดูตัวอย่างแบบอ่านอย่างเดียวได้จากหน้า `complaint-reward.html`, `complaint-no-reward.html`, `complaint-inspection.html`, `complaint-ossc.html` โดยไม่ต้องเชื่อม Google Drive และไม่มีการบันทึกข้อมูลส่วนบุคคล หน้า `index.html#complaint` มีลิงก์ไปหน้าตรวจสอบหัวข้อ 2 และ 3 แล้ว ขณะที่หัวข้อ 1 ยังใช้ Google Form เดิมตามที่หน่วยงานกำหนดจนกว่าจะเปิดระบบใหม่อย่างปลอดภัย

**ข้อควรระวังใน Apps Script Project ที่ผู้ใช้สร้างไว้:** ต้องคัดลอก `intake/Code.gs` ฉบับล่าสุดเข้า `รหัส.gs` อีกครั้ง เพราะเวอร์ชันแรกก่อนหน้านี้ยังไม่รู้จักประเภท `inspection` และ `ossc`. โปรดตรวจชื่อไฟล์ HTML ใหม่ที่ซอร์ส `doGet` เรียกใช้ให้ตรงกันทุกตัวอักษร. ยังไม่ควรกด Deploy รับข้อมูลจริงจนกว่า `checkDeploymentReadiness()` ผ่านและบัญชีเจ้าของ/สิทธิ์ Staff ผ่านการทดสอบ
