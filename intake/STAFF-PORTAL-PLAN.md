# E-Complaint — เป้าหมาย Staff / Admin Portal (อ้างอิงภาพ OSSC)

## ต้นแบบบน GitHub Pages
- `staff-portal-preview.html`: หน้าเข้าสู่ระบบ Username/Password และ Layout Dashboard สีเขียวเข้ม-ขาว Sidebar แบบตัวอย่าง OSSC
- `staff.html`: หน้าเจ้าหน้าที่ E-Complaint เดิม **คงไว้ไม่เขียนทับ** เพิ่มเฉพาะลิงก์ดูหน้าใหม่
- เปิด `staff-portal-preview.html?preview=admin` เพื่อดูเค้าโครงเมนู Admin (โหมดแสดงผล **ไม่ได้ให้อำนาจจริง**)
- ขณะนี้หน้า Preview **ไม่มีการ login จริง ไม่มีข้อมูลจาก Backend ไม่มีการสร้างผู้ใช้งานหรือส่งผลกลับ** ทุกปุ่มเขียนข้อมูลถูกปิด เพื่อกันข้อมูลอ่อนไหวรั่วไหล

## บทบาทและสิทธิ์ที่ต้องใช้จริง

| การทำงาน | ประชาชน | Staff | Admin |
| --- | --- | --- | --- |
| เข้าด้วย Google เพื่อยื่นและติดตาม | เฉพาะตนเอง | — | — |
| ดูรายการร้องเรียน | — | เฉพาะหมวด/เรื่องที่มอบหมาย | ทุกหมวดตามนโยบาย |
| เปิดรายละเอียดและหลักฐาน | เฉพาะคำร้องของตน | ตามสิทธิ์ | ตามสิทธิ์บริหาร |
| บันทึกผล / ส่งตอบกลับ | — | ตามสิทธิ์ที่ Admin อนุมัติ | ตามสิทธิ์บริหาร |
| สร้าง Staff username/password | — | — | Admin เท่านั้น |
| กำหนดสิทธิ์ เปิด-ปิดบัญชี | — | — | Admin เท่านั้น |
| Audit Log ทั้งระบบ | — | เฉพาะเหตุการณ์ที่อนุญาต | Admin / ผู้ตรวจสอบที่อนุมัติ |

การซ่อนเมนูใน GitHub ไม่ถือเป็นการยืนยันสิทธิ์. ทุกการเรียก API ต้องตรวจ session/role/permission ฝั่ง Backend เป็นหลัก.

## กระบวนการส่งคำตอบกลับ

1. ประชาชนยื่นด้วย Google Login; Backend เก็บ subject identity และอีเมลที่ยืนยันแล้วผูกกับเลขรับเรื่อง (ไม่ใช่อีเมลที่ผู้ร้องพิมพ์เอง)
2. Staff ลงชื่อเข้าใช้ด้วย Username/Password ที่ Admin สร้างผ่านผู้ให้บริการ Authentication ที่จัดการรหัสผ่าน/รีเซ็ต/เซสชันอย่างปลอดภัย พร้อมป้องกัน brute-force
3. Staff เห็นเฉพาะเรื่องตามหมวดและสิทธิ์ แสดงหลักฐานผ่าน API เมื่อได้รับอนุญาต
4. Staff เลือกสถานะ เพิ่มข้อความบันทึกภายใน (แยกจากคำตอบสาธารณะ) และแนบไฟล์ผลการดำเนินการตามสิทธิ์
5. หากหน่วยงานกำหนดการอนุมัติผล ต้องมีขั้นตอนอนุมัติและ revision history ก่อนเผยแพร่คำตอบ
6. Backend ผูกข้อความ/ไฟล์ตอบกลับกับ case ID และตรวจความเป็นเจ้าของของผู้ร้องเมื่อเปิดอ่าน
7. ผู้ร้องเปิดหน้า `CitizenStatus` ด้วย Google Account เดิมเพื่อดูผล; การแจ้งเตือนทางอีเมลต้องไม่มีรายละเอียดคำร้อง เลขบัตรประชาชน หรือหลักฐานแนบ
8. ทุกเหตุการณ์ถูกบันทึก Audit Log ได้แก่ actor ID, เวลา, case ID, action, role, outcome; ไม่เก็บ password, token หรือไฟล์เนื้อหาใน Audit Log

## Backend ที่มีอยู่และยังขาด

- มีต้นแบบ `intake/Code.gs` เก็บคำร้อง 4 ประเภท แยกโฟลเดอร์วันที่ มี `CaseResponses`, `AuditLog`, `staffUpdateCase` และ `myComplaintStatus` (ยังต้องทดสอบ end-to-end)
- `intake/Staff.html` เดิมเป็น HTMLService ใช้ Google Login และ allowlist; ไม่ใช่ Username/Password ตามข้อกำหนด
- ยังไม่มี Secure API Gateway สำหรับ GitHub Pages, Admin User Management, Auth Provider ของ Staff, สิทธิ์ละเอียดต่อ case, การอนุมัติก่อนส่งผล, รวมถึงการแนบไฟล์ตอบกลับใน API ใหม่
- ต้อง Deploy/ทดสอบในบัญชีกลาง `ossc73@gmail.com` พร้อมโฟลเดอร์ Production ส่วนตัว ไม่ใช่ชุด Editor/staging หรือโฟลเดอร์ anyone-link
- ก่อนเปิดใช้จริง ต้องผ่านการทดสอบสิทธิ์ Role Matrix, IDOR / Broken Object Level Authorization, Audit Log, การจัดการรหัสผ่าน, PDPA, file scanning และการเก็บรักษาข้อมูล

## แนวทางเปิดใช้งาน

ยึดรูปแบบ Frontend 3 ส่วนบน GitHub: public site, Staff Portal, Admin Portal. Backend ที่ให้บริการจากเซิร์ฟเวอร์ตรวจสิทธิ์ทุก endpoint ก่อนอ่านหรือเปลี่ยนข้อมูล. การดำเนินงานใน Google Drive/Sheets/Apps Script เป็นหน้าที่บัญชีกลางของหน่วยงาน; Staff และประชาชนไม่ต้องเข้าเครื่องมือเหล่านี้

**สถานะ: DESIGN PREVIEW / NOT PRODUCTION.**
