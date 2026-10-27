# E-Complaint V2 — เว็บไซต์ร้องเรียน สสจ.นครปฐม

แก้เฉพาะ onestopservicecenter/E-Complaint ไม่แก้ระบบ OSSC หรือ repository อื่น

## สิ่งที่เปลี่ยน

- แยกส่วนแบนเนอร์, ข่าวประชาสัมพันธ์, ข่าวเตือนภัย พร้อมหน้าเจ้าหน้าที่จัดการแยกกัน
- ใช้ชื่อ กลุ่มงานคุ้มครองผู้บริโภคและเภสัชสาธารณสุข สำนักงานสาธารณสุขจังหวัดนครปฐม
- หน้าประชาชนไม่แสดงชื่อเครื่องมือหลังบ้าน ไม่พาเจ้าหน้าที่ไปเปิด Drive/Sheets
- ประชาชนเข้าสู่ระบบด้วยบัญชี Google (Gmail หรือ Google Workspace ที่ยืนยันแล้ว) แจ้งเรื่องจากหน้าเว็บและติดตามเฉพาะเรื่องตนเอง
- QR เป็นเพียงลิงก์ไปยังเรื่อง ต้องเข้าสู่ระบบด้วยบัญชีเจ้าของเรื่อง ไม่ใช่ bearer secret ที่ใครมี QR ก็เห็นไฟล์ได้
- เจ้าหน้าที่อัปโหลดหลักฐานตอบกลับและเพิ่มลิงก์ผ่านเว็บ ไฟล์ลงโฟลเดอร์ Drive ส่วนตัวของหน่วยงาน
- สิทธิ์เนื้อหาแยกเป็นดู/เพิ่ม/แก้ไข/ลบ สำหรับ banner/news/alert
- สิทธิ์เรื่องร้องเรียนแยกหมวด: ดู/เพิ่มลิงก์/อัปโหลด/แก้สถานะและตอบกลับ/ลบเรื่อง พร้อมเลือกทั้งหมดและล้างทั้งหมด
- ต้องเลือกหมวดก่อนดูรายการเจ้าหน้าที่ บันทึกแล้วค้างเรื่องเดิม

## สถานะที่ต้องทราบ

โค้ดหน้าเว็บและหลังบ้านพร้อมสำหรับติดตั้ง แต่ค่าการเชื่อมต่อจริงยังไม่ถูกกำหนด:
- frontend/config.js: webAppUrl และ googleClientId
- Script Properties: SITE_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

GitHub Pages ไม่รัน Apps Script ต้อง Deploy โค้ดในบัญชี Google ของหน่วยงานก่อน
การทดสอบในชุดนี้ใช้บริการ Google จำลอง ยังไม่ได้ยืนยัน OAuth/Drive/Sheets จริงในบัญชีผู้ใช้
ไม่มีการคัดลอกข่าว/รูปเชียงใหม่มาอ้างเป็นข่าวนครปฐม หากยังไม่เพิ่มรายการ หน้าข่าวจะแสดงว่ายังไม่มีข่าวเผยแพร่
แบนเนอร์เริ่มต้นเป็นงาน HTML/CSS ของเว็บ เปลี่ยนเป็นรูปแบนเนอร์จริงได้จากหน้าเจ้าหน้าที่เมื่อเชื่อมระบบแล้ว

## โครงสร้าง repository หลังอัปเดต

index.html, staff.html, styles.css, app.js, staff.js, config.js, vendor/qrcode.js และ .nojekyll อยู่ root
backend/Code.gs, backend/Bridge.html, backend/appsscript.json คือโค้ดติดตั้ง Apps Script เท่านั้น ไม่ใช่ฐานข้อมูลและไม่มี secret
README-TH.md และ tests/ เป็นคู่มือและการทดสอบ

ในชุดพัฒนา/ZIP ไฟล์เว็บไซต์อยู่ใน frontend/ และโค้ดหลังบ้านอยู่ใน apps-script/ ซึ่งจัดวางเข้า root/backend ตามข้างต้นเมื่อ commit GitHub

## 1. สร้างชีตและติดตั้ง Apps Script

ใช้บัญชีของหน่วยงานสร้าง Google Sheets สำหรับระบบร้องเรียน หรือใช้ชีตเดิมที่หน่วยงานเลือก
Extensions > Apps Script แล้วสร้าง:
1. Code.gs จาก backend/Code.gs
2. HTML ชื่อ Bridge จาก backend/Bridge.html
3. เปิด Show appsscript.json manifest ใน Project Settings แล้ววาง backend/appsscript.json
4. รัน initializeV2 ด้วยบัญชีผู้ดูแลจาก Apps Script editor อนุญาตสิทธิ์หลังตรวจโปรเจ็กต์
5. ระบบสร้างชีต NPT2_Cases, NPT2_Updates, NPT2_Content, NPT2_Staff, NPT2_Sessions, NPT2_Audit
6. ระบบสร้างโฟลเดอร์ส่วนตัว NPT Complaint V2 — Private พร้อมโฟลเดอร์ย่อย banner/news/alert/reply/evidence

V2 ใช้ชีตใหม่ NPT2_ ไม่ลบ/แทนที่ข้อมูล NPT_ รุ่นเดิมหรือคำตอบ Form เดิม ห้ามคัดลอกคำตอบเก่ามาผูกบัญชีผู้ร้องจากอีเมลที่พิมพ์เองโดยไม่ตรวจเจ้าของเรื่อง
เจ้าหน้าที่ไม่ต้องได้รับสิทธิ์เปิด Drive หรือ Sheets โดยตรง ใช้สิทธิ์ที่ผู้ดูแลกำหนดในหน้าเว็บ
อย่าแชร์โฟลเดอร์ไฟล์หรือชีตให้ประชาชนหรือเผยแพร่เป็น public

## 2. ตั้ง Google OAuth ของเว็บไซต์

Google Cloud Console > สร้าง/เลือก project ของหน่วยงาน > ตั้งค่า Google Auth Platform / OAuth consent
- Audience: External ถ้ารับประชาชนทั่วไป
- ตั้งชื่อแอปและข้อมูลหน่วยงานจริง พร้อม homepage/privacy policy และข้อมูลที่ Google ขอ
- สร้าง OAuth client ประเภท Web application
- Authorized JavaScript origins: https://onestopservicecenter.github.io
- ชุดนี้ใช้ GIS Popup Authorization Code Model: redirect_uri ตอนแลก code คือ origin เดียวกัน คือ https://onestopservicecenter.github.io ไม่ใช่ URL /E-Complaint/ และไม่ใช่ Apps Script /exec
- หาก Console ต้องกำหนด Authorized redirect URI ให้ใช้ origin เดียวกับด้านบนตามข้อกำหนด Console
- ใช้เฉพาะ scopes openid, email, profile สำหรับผู้ใช้ ประชาชนไม่ต้องให้สิทธิ์ Drive หรือ Sheets ของตนเอง
- ถ้ายังเป็น Testing จะใช้ได้เฉพาะ Test users ที่เพิ่มไว้ ต้องเผยแพร่/ผ่านข้อกำหนดของ Google ตามที่ Console แสดงก่อนรับคนทั่วไป

ใน Apps Script > Project Settings > Script Properties ตั้ง:
- SITE_ORIGIN = https://onestopservicecenter.github.io
- GOOGLE_CLIENT_ID = Client ID ที่ได้
- GOOGLE_CLIENT_SECRET = Client Secret ที่ได้

**ห้ามใส่ Client Secret, token, ข้อมูลประชาชน หรือไฟล์ฐานข้อมูลลง GitHub หรือส่ง secret ในแชท**
ใส่ Client ID เดียวกันใน config.js.googleClientId (Client ID เป็นค่าเปิดเผยได้)
ถ้าเปลี่ยนโดเมน ต้องอัปเดต authorized origins และ SITE_ORIGIN ให้ตรง

## 3. Deploy หลังบ้าน

Deploy > New deployment > Web app
- Execute as: Me / เจ้าของระบบ
- Who has access: Anyone ตามนโยบาย Workspace
- คัดลอก URL ที่ลงท้าย /exec ใส่ config.js.webAppUrl
- เมื่อแก้หลังบ้าน ให้ Manage deployments > Edit > New version อัปเดต deployment เดิมเพื่อคง URL

API ตรวจ Google authorization code ฝั่งเซิร์ฟเวอร์ด้วย Client Secret จากนั้นอ่าน identity จาก Google ผ่าน HTTPS และสร้าง session ของแอปอายุ 1 ชั่วโมง
session เก็บเฉพาะในหน่วยความจำหน้าเว็บ ฝั่งชีตเก็บ hash ไม่ใช้รหัสผ่านที่ตั้งเองหรืออีเมลที่ไคลเอนต์อ้างมา
Bridge ตรวจ origin/source และ channel nonce ก่อนส่งคำขอ หน้าเว็บตรวจ origin ของ iframe พร้อม nonce เช่นกัน ไม่ใช้ JSONP
มี OAuth login state แบบใช้ครั้งเดียว ผูก browserKey และอายุ 5 นาที ป้องกันคำขอแลก code ที่ไม่เริ่มจาก session เบราว์เซอร์นั้น
ไม่เก็บ Google access/refresh token ถาวร ใช้เฉพาะแลก identity ในคำขอเข้าสู่ระบบ

## 4. ผู้ดูแลเปิดระบบ

1. ตั้ง config.js แล้วรอ GitHub Pages อัปเดต
2. เปิด staff.html เข้าสู่ระบบด้วยบัญชีเดียวกับที่รัน initializeV2
3. ไปข้อมูลเว็บไซต์ กรอกช่องทางติดต่อจริง และประกาศความเป็นส่วนตัวฉบับหน่วยงาน/ช่องทางใช้สิทธิ
4. ระบบยังไม่รับคำร้องจริงหากสองข้อมูลนี้ยังว่าง
5. ไปสิทธิ์เจ้าหน้าที่ เพิ่มอีเมลและกำหนดสิทธิ์รายหมวด/รายส่วนงาน กดบันทึก
6. เจ้าหน้าที่เข้าสู่ระบบทาง staff.html ไม่ต้องเปิด/เห็น Drive
7. เพิ่มแบนเนอร์ (JPG/PNG), ข่าวประชาสัมพันธ์, ข่าวเตือนภัย แยกกัน ตั้งลำดับ และติ๊กเผยแพร่

ผู้ดูแลหลักหนึ่งคนกำหนดโดยบัญชีที่ initializeV2 ไม่สามารถยกระดับ admin ผ่านคำขอไคลเอนต์
เพิ่มเจ้าหน้าที่ไม่ส่งอีเมลเชิญอัตโนมัติ และไม่เพิ่มสิทธิ์เปิด Drive โดยตรง
การถอนสิทธิ์/ปิดเจ้าหน้าที่มีผลกับคำขอถัดไป เพราะอ่านสิทธิ์ใหม่ฝั่งเซิร์ฟเวอร์ทุกครั้ง

## การร้องเรียนและติดตาม

ประชาชนเข้าสู่ระบบ กรอกคำร้องและแนบ JPG/PNG/PDF ได้ไม่เกิน 3 ไฟล์ ไฟล์ละ 5 MB
ระบบผูกกับ Google subject ID ที่ตรวจจาก Google จริง ไม่ยึดอีเมลที่ผู้ใช้พิมพ์หรือส่งจาก JavaScript
แสดงเรื่องของตนเองในหัวข้อติดตามสถานะ โดยไม่ต้องพิมพ์รหัสลับ
QR บนรายละเอียดเรื่องใช้เปิดลิงก์กลับมายังเรื่องนั้น และยังต้องเข้าสู่ระบบด้วยบัญชีเจ้าของเรื่อง
เจ้าหน้าที่ดูคำร้อง/หลักฐานตามหมวด และแนบไฟล์/ลิงก์ตอบกลับตามสิทธิ์ ผู้ร้องดูบันทึกภายในหรือเรื่องคนอื่นไม่ได้

รุ่นนี้เปลี่ยนจากเปิดแบบฟอร์มภายนอกเป็นรับคำร้องในเว็บไซต์ตามข้อกำหนดใหม่ และบันทึกเข้าชีตหลังบ้านโดยตรง Google Form URL เดิมไม่ได้ถูกแก้หรือลบ และคำตอบเดิมไม่ได้ย้ายอัตโนมัติ
หากต้องให้คำร้องใหม่มีสำเนาใน Google Form เดิมด้วย ต้องตั้งค่า adapter ด้วย Form editor ID และ item ID จากแบบฟอร์มจริงก่อน ไม่ควรเดา item ID จาก URL สาธารณะ

## สิทธิ์ใช้งาน

เนื้อหาเว็บไซต์มีสิทธิ์ดู/เพิ่ม/แก้ไข/ลบแยกแต่ละส่วน ถ้ามีเฉพาะเพิ่ม จะเพิ่มรายการได้แต่แก้รายการเดิมไม่ได้
เรื่องร้องเรียนมีสิทธิ์ดูแยกหมวดเป็นเงื่อนไขก่อนทำงาน ส่วนเพิ่มลิงก์และอัปโหลดให้แนบข้อความประกอบได้ แต่เปลี่ยนสถานะ/บันทึกภายในไม่ได้ถ้าไม่มีสิทธิ์แก้ไข
ผู้มีสิทธิ์แก้ไขสามารถเปลี่ยนสถานะและบันทึกคำตอบ/บันทึกภายใน แต่ต้องมีสิทธิ์อัปโหลดหรือเพิ่มลิงก์แยกหากต้องแนบ
ลบเรื่อง/ลบข่าวเป็น soft delete เก็บข้อมูลสำหรับตรวจสอบ แต่ไม่แสดงในรายการใช้งาน ไฟล์เดิมยังเก็บเพื่อการตรวจสอบตามนโยบายหน่วยงาน
ไม่มีการเปิดลิงก์ Drive ตรงให้เจ้าหน้าที่หรือประชาชน ไฟล์อ่านผ่าน API หลังตรวจสิทธิ์
ไม่มีระบบลบถาวร/อายุข้อมูลอัตโนมัติ ผู้ดูแลต้องกำหนดระยะเวลาเก็บและกระบวนการใช้สิทธิก่อนใช้งานจริง

## การทดสอบ

node tests/backend.test.cjs
ทดสอบบริการ Google จำลอง: OAuth state ใช้ครั้งเดียว, แยกเจ้าของเรื่อง, สิทธิ์รายหมวด/ส่วนเนื้อหา, upload/link-only, กันเปลี่ยนสถานะโดยไม่มีสิทธิ์, กันอ่านไฟล์ข้ามเรื่อง, กันเผยแพร่ draft, ปิดเจ้าหน้าที่, logout, signature ไฟล์ และ soft delete
ตรวจ syntax app.js, staff.js, Code.gs แล้ว
ต้องทดสอบ OAuth popup จริงบน GitHub Pages และ Drive/Sheets จริงอีกครั้ง โควตา Apps Script และนโยบาย Google Workspace อาจจำกัดการใช้งาน

## ตรวจรับก่อนประชาสัมพันธ์

- [ ] ตั้ง Google OAuth, Script Properties, /exec และ config.js ครบ
- [ ] OAuth audience/publishing รองรับประชาชนจริง
- [ ] เปิด privacy/contact ของหน่วยงานจริง และทดสอบบัญชีผู้ร้อง 2 บัญชี
- [ ] ผู้ร้อง A เห็นเฉพาะเรื่อง A ทั้งเมื่อเปิดปกติและผ่าน QR
- [ ] เจ้าหน้าที่เลือกหมวดก่อนดูรายการ และทำงานได้ตรงสิทธิ์
- [ ] รูป/ไฟล์/ลิงก์ตอบกลับเปิดได้ ผู้ไม่มีสิทธิ์ถูกปฏิเสธ
- [ ] Banner/News/Alert แยกส่วน เพิ่ม/แก้/ลบ/ลำดับ/เผยแพร่ถูกต้อง
- [ ] ทดสอบบัญชีไม่ใช่เจ้าหน้าที่ เข้าหน้า staff แล้วไม่มีข้อมูลหลุด
- [ ] สำรองชีต, Script Properties และไฟล์ Drive ร่วมกัน ทดลองกู้คืน

อ้างอิง:
https://developers.google.com/identity/oauth2/web/guides/use-code-model
https://developers.google.com/identity/protocols/oauth2/web-server
https://developers.google.com/apps-script/guides/html/communication
https://developers.google.com/apps-script/guides/services/quotas
