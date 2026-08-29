// seed สินค้าเข้า DB จาก seed-products.json (catalog จริงที่ export มาจาก frontend)
// รันซ้ำได้ (upsert ตาม id) — จะไม่ทับ stock/price ที่พนักงานแก้ไว้ ถ้าใส่ --skip-existing
import { sql, type Product } from "./db.ts";
import seedProducts from "./seed-products.json" with { type: "json" };

const products = seedProducts as Product[];
const skipExisting = process.argv.includes("--skip-existing");

async function seed() {
  let inserted = 0;
  let updated = 0;

  for (const p of products) {
    if (skipExisting) {
      const rows = await sql`
        INSERT INTO products (id, name, category, stock, min_stock, unit, price, updated_by, size_label, image_url, is_placeholder)
        VALUES (${p.id}, ${p.name}, ${p.category}, ${p.stock}, ${p.minStock}, ${p.unit}, ${p.price},
                ${p.updatedBy}, ${p.sizeLabel ?? null}, ${p.imageUrl ?? null}, ${p.isPlaceholder ?? false})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `;
      if (rows.length > 0) inserted++;
    } else {
      const rows = await sql`
        INSERT INTO products (id, name, category, stock, min_stock, unit, price, updated_by, size_label, image_url, is_placeholder)
        VALUES (${p.id}, ${p.name}, ${p.category}, ${p.stock}, ${p.minStock}, ${p.unit}, ${p.price},
                ${p.updatedBy}, ${p.sizeLabel ?? null}, ${p.imageUrl ?? null}, ${p.isPlaceholder ?? false})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          stock = EXCLUDED.stock,
          min_stock = EXCLUDED.min_stock,
          unit = EXCLUDED.unit,
          price = EXCLUDED.price,
          updated_by = EXCLUDED.updated_by,
          size_label = EXCLUDED.size_label,
          image_url = EXCLUDED.image_url,
          is_placeholder = EXCLUDED.is_placeholder,
          updated_at = now()
        RETURNING (xmax = 0) AS is_insert
      `;
      if (rows[0]?.is_insert) inserted++;
      else updated++;
    }
  }

  const total = await sql`SELECT count(*)::int AS n FROM products`;
  console.log(`✅ seed เสร็จ: เพิ่มใหม่ ${inserted}, อัปเดต ${updated} | รวมในตอนนี้ ${total[0].n} รายการ`);
  await sql.end();
}

seed().catch((error) => {
  console.error("❌ seed ล้มเหลว:", error);
  process.exit(1);
});
