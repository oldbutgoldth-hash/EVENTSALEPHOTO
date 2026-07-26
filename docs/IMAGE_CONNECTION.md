# การเชื่อมและจัดเก็บรูปภาพ

## ImageKit ใช้ร่วมกับเว็บจองเดิมได้

ใช้บัญชี ImageKit เดิม แต่แยกโฟลเดอร์ชัดเจน:

```text
/koake-booking/
  /homepage/
  /portfolio/
  /private-gallery/

/koake-event-photo/
  /sawi-sport-day-2569/
    /original/
    /preview/
```

Usage และ Bandwidth ของทั้งสองเว็บจะรวมอยู่ในบัญชี ImageKit เดียวกัน

## ภาพหนึ่งรูปถูกอัปโหลดเป็น 2 ไฟล์

### Original

- ความละเอียดเต็ม เช่น 6720×4480
- `isPrivateFile=true`
- ใช้ดาวน์โหลดหลังชำระเงิน
- ถูกลบจาก ImageKit เมื่อครบกำหนดเก็บออนไลน์

### Preview

- Browser ลดด้านยาวสูงสุดประมาณ 1400px
- JPEG Quality 72%
- ฝังลายน้ำ `KO’AKE PREVIEW` ลงในพิกเซลจริง
- อัปโหลดไปโฟลเดอร์ `/preview/`
- คงอยู่หลัง Original ถูกลบ

การฝังลายน้ำลงไฟล์ Preview โดยตรงสำคัญกว่าอาศัย Transformation Cache เพราะหลังลบ Original ระบบยังต้องเปิด Preview ได้ในระยะยาว

## ขั้นตอนอัปโหลด

1. ผู้ดูแลเลือกภาพใน `/?admin=1`
2. Browser ขอ Upload Signature จาก `/api/imagekit-auth`
3. อัปโหลด Original แบบ Private
4. Browser สร้าง Preview ลดขนาดและฝังลายน้ำ
5. ขอ Signature ใหม่ แล้วอัปโหลด Preview
6. `/api/admin-save-photo` บันทึก Original fileId และ Preview fileId ลง Supabase
7. หน้าร้านอ่านเฉพาะ `preview_url`

## หลังชำระเงิน

`/api/download` จะตรวจว่า:

- ออร์เดอร์เป็น `paid`
- ภาพอยู่ในออร์เดอร์นั้นจริง
- สิทธิ์ดาวน์โหลดยังไม่หมดอายุ
- Original ยังอยู่ในสถานะ `online`

จากนั้นจึงสร้าง Signed URL อายุ 5 นาที

## หลังครบวันเก็บ Original

`/api/cron-lifecycle` จะ:

1. ตรวจงานที่เลย `original_purge_at`
2. ยืนยันว่าภาพมี Preview แยก
3. ลบ Original ด้วย ImageKit fileId
4. บันทึก `original_purged_at`
5. คง Preview, รหัสภาพ และข้อมูลอัลบั้มไว้

ไฟล์จากเวอร์ชันเก่าที่ไม่มี Preview แยกจะถูกข้ามอัตโนมัติ
