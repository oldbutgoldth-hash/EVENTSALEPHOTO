export type Photo = {
  id: number | string
  code: string
  category: string
  src: string
  orientation: 'portrait' | 'landscape'
}

const demoSaleStart = new Date()
const demoSaleEnd = new Date(demoSaleStart.getTime() + 7 * 24 * 60 * 60 * 1000)
const demoOriginalPurge = new Date(demoSaleStart.getTime() + 30 * 24 * 60 * 60 * 1000)

export const event = {
  title: 'ขบวนกีฬาสี โรงเรียนสวีวิทยา',
  subtitle: '24 กรกฎาคม 2569 · สนามกีฬาโรงเรียน',
  description: 'เลือกรูปที่ชอบ จ่ายผ่าน PromptPay แล้วดาวน์โหลดไฟล์เต็มได้ทันที',
  status: 'active' as const,
  saleOpen: true,
  saleStartsAt: demoSaleStart.toISOString(),
  saleEndsAt: demoSaleEnd.toISOString(),
  originalPurgeAt: demoOriginalPurge.toISOString(),
  originalsPurgedAt: null,
  contactLineUrl: 'https://line.me/ti/p/~koake',
  contactPhone: '081-234-5678',
}

export const categories = ['ทั้งหมด', 'ขบวนพาเหรด', 'สีแดง', 'สีฟ้า', 'การแสดง']

export const photos: Photo[] = [
  { id: 1, code: 'KAE-001', category: 'ขบวนพาเหรด', src: '/photos/photo-01.svg', orientation: 'portrait' },
  { id: 2, code: 'KAE-002', category: 'สีแดง', src: '/photos/photo-02.svg', orientation: 'landscape' },
  { id: 3, code: 'KAE-003', category: 'สีฟ้า', src: '/photos/photo-03.svg', orientation: 'portrait' },
  { id: 4, code: 'KAE-004', category: 'การแสดง', src: '/photos/photo-04.svg', orientation: 'landscape' },
  { id: 5, code: 'KAE-005', category: 'ขบวนพาเหรด', src: '/photos/photo-05.svg', orientation: 'portrait' },
  { id: 6, code: 'KAE-006', category: 'สีแดง', src: '/photos/photo-06.svg', orientation: 'portrait' },
  { id: 7, code: 'KAE-007', category: 'สีฟ้า', src: '/photos/photo-07.svg', orientation: 'landscape' },
  { id: 8, code: 'KAE-008', category: 'การแสดง', src: '/photos/photo-08.svg', orientation: 'portrait' },
  { id: 9, code: 'KAE-009', category: 'ขบวนพาเหรด', src: '/photos/photo-09.svg', orientation: 'landscape' },
  { id: 10, code: 'KAE-010', category: 'สีแดง', src: '/photos/photo-10.svg', orientation: 'portrait' },
  { id: 11, code: 'KAE-011', category: 'สีฟ้า', src: '/photos/photo-11.svg', orientation: 'portrait' },
  { id: 12, code: 'KAE-012', category: 'การแสดง', src: '/photos/photo-12.svg', orientation: 'landscape' },
]
