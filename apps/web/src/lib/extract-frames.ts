// Extracts evenly-spaced frames from a short video for vision-model input —
// ported from trekuartista-copy's client/src/utils/extractFrames.js.
export function extractFrames(
  videoFile: File,
  count = 5,
): Promise<{ frames: string[]; preview: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load video. Try MP4 or MOV format."));
    };

    video.onloadedmetadata = () => {
      if (video.duration > 30) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Video must be 30 seconds or under."));
        return;
      }

      const duration = video.duration;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas not supported in this browser."));
        return;
      }
      const frames: string[] = [];
      let frameIndex = 0;

      const captureNext = () => {
        if (frameIndex >= count) {
          URL.revokeObjectURL(objectUrl);
          resolve({
            frames,
            preview: `data:image/jpeg;base64,${frames[Math.floor(count / 2)]}`,
          });
          return;
        }
        const t = frameIndex === 0 ? 0.01 : (duration * frameIndex) / (count - 1);
        video.currentTime = Math.min(t, duration - 0.01);
      };

      video.onseeked = () => {
        if (canvas.width === 0) {
          const maxW = 1280;
          const scale = Math.min(1, maxW / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "");
        frameIndex++;
        captureNext();
      };

      captureNext();
    };
  });
}
