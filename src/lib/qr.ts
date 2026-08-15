import "server-only";

import QRCode from "qrcode";

export async function bookingQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: { dark: "#252b1c", light: "#fffaf0" }
  });
}
