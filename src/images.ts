// ---- คลังรูปภาพ: แปลง/ตรวจไฟล์ที่อัปโหลดเข้ามา ----
// รูปเก็บใน Postgres (ตาราง images) เพื่อให้ทุกเครื่องเห็นรูปเดียวกัน
// id ของรูป = sha256 ของไฟล์ → อัปรูปเดิมซ้ำก็ไม่กินที่เพิ่ม และ cache ฝั่ง browser ได้ถาวร
import { createHash } from "node:crypto";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB (frontend ย่อมาแล้วเหลือ ~200 KB)

const allowedMimes = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"]
]);

export type UploadedImage = { bytes: Uint8Array; mime: string };

export function isAllowedMime(mime: string): boolean {
  return allowedMimes.has(mime);
}

export function extensionFor(mime: string): string {
  return allowedMimes.get(mime) ?? "bin";
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// id ที่ frontend ส่งกลับมาอาจมีนามสกุลติดมา (/images/<sha>.png) — ตัดทิ้ง
export function normalizeImageId(raw: string): string | null {
  const id = raw.split(".")[0]?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{64}$/.test(id) ? id : null;
}

// data URL → ไบต์ (รองรับ "data:image/png;base64,....")
function fromDataUrl(dataUrl: string): UploadedImage | { error: string } {
  const match = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,(.*)$/i);
  if (!match) return { error: "รูปแบบ data URL ไม่ถูกต้อง" };
  const mime = match[1].toLowerCase();
  try {
    return { bytes: new Uint8Array(Buffer.from(match[2], "base64")), mime };
  } catch {
    return { error: "ถอดรหัส base64 ไม่สำเร็จ" };
  }
}

// รับได้ทั้ง multipart/form-data (field ชื่อ file) และ JSON { dataUrl } / { base64, mime }
export async function readUpload(
  request: Request
): Promise<UploadedImage | { error: string; status: 400 | 413 }> {
  const contentType = request.headers.get("Content-Type") ?? "";
  let uploaded: UploadedImage | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return { error: "ไม่พบไฟล์ในฟิลด์ file", status: 400 };
    uploaded = { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type.toLowerCase() };
  } else {
    const body = (await request.json().catch(() => null)) as
      | { dataUrl?: string; base64?: string; mime?: string }
      | null;
    if (body?.dataUrl) {
      const parsed = fromDataUrl(body.dataUrl);
      if ("error" in parsed) return { ...parsed, status: 400 };
      uploaded = parsed;
    } else if (body?.base64 && body?.mime) {
      uploaded = {
        bytes: new Uint8Array(Buffer.from(body.base64, "base64")),
        mime: body.mime.toLowerCase()
      };
    } else {
      return { error: "ต้องส่งไฟล์มาเป็น multipart (file) หรือ JSON { dataUrl }", status: 400 };
    }
  }

  if (uploaded.bytes.byteLength === 0) return { error: "ไฟล์ว่าง", status: 400 };
  if (uploaded.bytes.byteLength > MAX_IMAGE_BYTES) {
    return { error: `รูปใหญ่เกิน ${MAX_IMAGE_BYTES / 1024 / 1024} MB — ย่อรูปก่อนอัป`, status: 413 };
  }
  if (!isAllowedMime(uploaded.mime)) {
    return { error: `ไม่รองรับไฟล์ชนิด ${uploaded.mime || "ไม่ทราบ"}`, status: 400 };
  }

  return uploaded;
}
