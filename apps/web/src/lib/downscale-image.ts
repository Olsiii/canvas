// Downscale an image file to a max dimension before sending to the API.
// Cuts payload size and token cost — the model doesn't need full-res
// exports. Ported from trekuartista-copy's client/src/utils/downscaleImage.js.
export function downscaleImage(
  file: File,
  maxDim = 1568,
): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image. Try PNG or JPG."));
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported in this browser."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] ?? "" });
    };

    img.src = objectUrl;
  });
}
