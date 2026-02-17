import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

// Only use remote models — proxy through our own origin to avoid CORS issues
env.allowLocalModels = false;
env.remoteHost = `${self.location.origin}/hf-proxy`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;

async function ensureModel() {
  if (model && processor) return;

  postMessage({ type: "progress", status: "loading" });

  processor = await AutoProcessor.from_pretrained("Xenova/modnet");
  model = await AutoModel.from_pretrained("Xenova/modnet", {
    dtype: "fp32",
  });

  postMessage({ type: "progress", status: "ready" });
}

addEventListener("message", async (e: MessageEvent) => {
  const { type, blob, requestId } = e.data;
  if (type !== "process") return;

  try {
    await ensureModel();

    // Get original image dimensions
    const imageBitmap = await createImageBitmap(blob as Blob);
    const { width, height } = imageBitmap;

    // Load image for model processing
    const image = await RawImage.fromBlob(blob as Blob);

    // Run through processor + model
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });

    // output shape: [1, 1, maskH, maskW] — alpha matte (0–1 floats)
    const maskData = output.data as Float32Array;
    const maskH = output.dims[2] as number;
    const maskW = output.dims[3] as number;

    // Compose: original image pixels + mask as alpha channel
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imageBitmap, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Nearest-neighbor sample from mask to original resolution
        const mx = Math.min(Math.floor((x / width) * maskW), maskW - 1);
        const my = Math.min(Math.floor((y / height) * maskH), maskH - 1);
        const alpha = maskData[my * maskW + mx];
        pixels[(y * width + x) * 4 + 3] = Math.round(alpha * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const resultBlob = await canvas.convertToBlob({ type: "image/png" });
    postMessage({ type: "result", blob: resultBlob, requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    postMessage({ type: "error", error: message, requestId });
  }
});
