import { createClient } from "@/lib/supabase";

const AVATAR_SIZE = 400; // px, square
const WEBP_QUALITY = 0.85;

async function processImage(file) {
  const bitmap = await createImageBitmap(file);

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/webp",
      WEBP_QUALITY
    );
  });
}

export async function uploadAvatar(file, userId) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image is too large (max 10MB).");
  }

  const supabase = createClient();

  const webpBlob = await processImage(file);
  const path = `${userId}/avatar.webp`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, webpBlob, {
      contentType: "image/webp",
      upsert: true,
    });
  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ avatar_url: bustedUrl })
    .eq("id", userId);
  if (updateErr) throw updateErr;

  return bustedUrl;
}
