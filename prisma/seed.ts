import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ชุดข้อมูลตัวอย่าง — เลือกสินค้าตัวแทนจากหลายหมวด (ราคา 0 = ยังไม่ตั้งราคา)
// หมายเหตุ: catalog เต็ม (300+ รายการ) อยู่ใน frontend `../fangfangshop/app/page.tsx`
// การย้ายทั้งหมดเข้ามาเป็นงานถัดไป ที่นี่ seed พอให้ API มีข้อมูลทดสอบ
type SeedProduct = {
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  sizeLabel?: string;
  imageUrl?: string;
};

const products: SeedProduct[] = [
  // เครื่องดื่ม
  { name: "สิงห์ เลมอน โซดา", category: "เครื่องดื่ม(น้ำดื่ม น้ำอัดลม ชา กาแฟ)", stock: 20, minStock: 5, unit: "กระป๋อง", price: 17, imageUrl: "/product-images/singha-soda-lemon.png" },
  { name: "แฟนต้า น้ำแดง 15 บาท", category: "เครื่องดื่ม(น้ำดื่ม น้ำอัดลม ชา กาแฟ)", stock: 18, minStock: 5, unit: "ขวด", price: 15, sizeLabel: "ขวด 15 บาท", imageUrl: "/product-images/fanta-red-15-bottle.png" },
  { name: "อิชิตัน กรีนที รสต้นตำรับ", category: "เครื่องดื่ม(น้ำดื่ม น้ำอัดลม ชา กาแฟ)", stock: 12, minStock: 5, unit: "ขวด", price: 16, imageUrl: "/product-images/ichitan-original-green-tea.png" },
  { name: "น้ำดื่มคริสตัลขวดเล็ก", category: "เครื่องดื่ม(น้ำดื่ม น้ำอัดลม ชา กาแฟ)", stock: 40, minStock: 12, unit: "ขวด", price: 8, sizeLabel: "ขวดเล็ก", imageUrl: "/product-images/crystal-small-water-bottle.png" },

  // เครื่องดื่มแอลกอฮอล์
  { name: "สิงห์กระป๋องยาว", category: "เครื่องดื่มแอลกอฮอล์", stock: 24, minStock: 6, unit: "กระป๋อง", price: 55, sizeLabel: "กระป๋องยาว", imageUrl: "/product-images/alcohol/singha-long-can-real.png" },
  { name: "ลีโอขวด", category: "เครื่องดื่มแอลกอฮอล์", stock: 15, minStock: 6, unit: "ขวด", price: 62, imageUrl: "/product-images/alcohol/leo-bottle-real.png" },
  { name: "สปาย Red", category: "เครื่องดื่มแอลกอฮอล์", stock: 20, minStock: 5, unit: "ขวด", price: 35, imageUrl: "/product-images/alcohol/spy-red.png" },
  { name: "หงส์ทองแบน", category: "เครื่องดื่มแอลกอฮอล์", stock: 8, minStock: 4, unit: "ขวด", price: 150, sizeLabel: "ขวดแบน", imageUrl: "/product-images/alcohol/hong-thong-flat.svg" },

  // บุหรี่/ยาสูบ
  { name: "SMS แดง", category: "บุหรี่/ยาสูบ", stock: 12, minStock: 5, unit: "ซอง", price: 70 },
  { name: "LM แดง", category: "บุหรี่/ยาสูบ", stock: 9, minStock: 5, unit: "ซอง", price: 72 },
  { name: "ยาสูบตราแมวเขียว", category: "บุหรี่/ยาสูบ", stock: 11, minStock: 6, unit: "ซอง", price: 20, imageUrl: "/product-images/tobacco-soft/green-cat-tobacco.svg" },

  // เครื่องปรุง
  { name: "น้ำตาลทรายขาวมิตรผล 1 กิโลกรัม", category: "เครื่องปรุง", stock: 20, minStock: 5, unit: "ถุง", price: 29, sizeLabel: "1 กิโลกรัม", imageUrl: "/product-images/mitr-phol-white-sugar-1kg.png" },
  { name: "น้ำปลาแท้ตราทิพรส ขวดเล็ก", category: "เครื่องปรุง", stock: 20, minStock: 5, unit: "ขวด", price: 0, sizeLabel: "ขวดเล็ก", imageUrl: "/product-images/tiparos-fish-sauce-small-round.png" },

  // เลย์ / ขนม
  { name: "เลย์รสออริจินัล (มันฝรั่งแท้ แผ่นเรียบ/แผ่นหยัก)", category: "เลย์", stock: 18, minStock: 8, unit: "ซองใหญ่", price: 20, sizeLabel: "ซองใหญ่", imageUrl: "/product-images/lay-large/lay-original.png" },
  { name: "เยลลี่ผลไม้รวม", category: "ขนมและของกินเล่น", stock: 9, minStock: 10, unit: "ถุง", price: 10 },

  // น้ำสมุนไพรโฮมเมด
  { name: "น้ำเก๊กฮวย", category: "น้ำสมุนไพรโฮมเมด", stock: 20, minStock: 5, unit: "ขวด", price: 10, sizeLabel: "220ml", imageUrl: "/product-images/herbal-drinks/chrysanthemum-beverage.jpg" },
  { name: "น้ำมะนาว", category: "น้ำสมุนไพรโฮมเมด", stock: 20, minStock: 5, unit: "ขวด", price: 10, sizeLabel: "220ml", imageUrl: "/product-images/herbal-drinks/lime-juice.jpg" },

  // สินค้าสัตว์เลี้ยง
  { name: "ทิงเกอร์เบลล์ (Tinkerbell) รสทูน่า โซเดียมต่ำ", category: "สินค้าสัตว์เลี้ยง", stock: 20, minStock: 5, unit: "ซอง", price: 5, sizeLabel: "ซอง", imageUrl: "/product-images/tinkerbell-cat-treat-tuna.png" },

  // ของใช้ในบ้าน
  { name: "ไฟแช็คคละสี", category: "ของใช้ในบ้าน", stock: 4, minStock: 8, unit: "ชิ้น", price: 10, imageUrl: "/product-images/lighter-mixed-color.png" },
  { name: "น้ำยาล้างจาน", category: "ของใช้ในบ้าน", stock: 16, minStock: 6, unit: "ขวด", price: 35 },

  // ยาสามัญประจำบ้าน
  { name: "ยาดมสมุนไพร", category: "ยาสามัญประจำบ้าน", stock: 26, minStock: 10, unit: "ชิ้น", price: 20 }
];

async function main() {
  console.log("🌱 กำลัง seed ข้อมูลสินค้า...");
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  const count = await prisma.product.count();
  console.log(`✅ seed สำเร็จ: ${count} รายการ`);
}

main()
  .catch((err) => {
    console.error("❌ seed ล้มเหลว:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
