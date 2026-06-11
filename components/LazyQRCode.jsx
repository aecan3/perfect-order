"use client";

import dynamic from "next/dynamic";

// react-qr-code is only needed once the user opens a QR share sheet, so it
// loads on demand instead of shipping in the /you and /want-lists/new
// bundles. The wrapper div reserves the exact final box (the SVG renders at
// size x size) so the sheet doesn't shift when the chunk arrives.
const QRCode = dynamic(() => import("react-qr-code"), {
  ssr: false,
  loading: () => null,
});

export function LazyQRCode({ value, size, fgColor = "#000000", bgColor = "#ffffff" }) {
  return (
    <div style={{ width: size, height: size }}>
      <QRCode value={value} size={size} fgColor={fgColor} bgColor={bgColor} />
    </div>
  );
}
