<script lang="ts">
  /**
   * Enka.Network Overlay canvas 1:1:
   * fixed 1280×533 logical → canvas at 1.2×, solid element fill,
   * then overlay.jpg with globalCompositeOperation "overlay".
   */
  import overlayJpg from "$lib/assets/enka-overlay.jpg";

  let {
    element = "Fire",
    /** Enka Card always passes width:1280 height:533. */
    width = 1280,
    height = 533,
    onAccent = undefined,
  }: {
    element?: string;
    width?: number;
    height?: number;
    onAccent?: (accent: string) => void;
  } = $props();

  /** Fill colors from Enka Overlay (not the same as .card-host bg). */
  const ELEMENT_FILL: Record<string, string> = {
    Rock: "#bb9f4b",
    Wind: "#52B0B1",
    Ice: "#46A8BA",
    Water: "#84A1C6",
    Electric: "#9876AD",
    Fire: "#BA8C83",
    Grass: "#2D8E34",
    None: "#94a0a7",
  };

  let canvasEl: HTMLCanvasElement | undefined = $state();

  let overlayImage: HTMLImageElement | null = null;
  let overlayReady: Promise<HTMLImageElement> | null = null;
  let paintGen = 0;

  function loadOverlay(): Promise<HTMLImageElement> {
    if (overlayImage?.complete && overlayImage.naturalWidth > 0) {
      return Promise.resolve(overlayImage);
    }
    if (overlayReady) return overlayReady;
    overlayReady = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        overlayImage = img;
        resolve(img);
      };
      img.onerror = () => {
        overlayReady = null;
        reject(new Error("overlay.jpg failed"));
      };
      img.src = overlayJpg;
    });
    return overlayReady;
  }

  function coverFit(
    imgW: number,
    imgH: number,
    boxW: number,
    boxH: number,
  ): { x: number; y: number; width: number; height: number } {
    const scale = Math.max(boxW / imgW, boxH / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    return { x: (boxW - w) / 2, y: (boxH - h) / 2, width: w, height: h };
  }

  function averageRgb(data: Uint8ClampedArray): [number, number, number] {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n += 1;
    }
    if (n === 0) return [15, 29, 49];
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  }

  /**
   * Enka accent: `ml(...pl(I[0], max(0,I[1]-20), max(0,I[2]-5)))` etc.
   * I is averaged top-row RGB; pl/ml are hsl round-trip with channel tweaks.
   * Approximate with RGB deltas (lands near Enka Fire `#68281b` / `#4f180d`).
   */
  function accentFromSample(data: Uint8ClampedArray): string {
    const [r, g, b] = averageRgb(data);
    if (r + g + b < 30) {
      return "linear-gradient(0deg, #0f1d31 0%, #0a1524 100%)";
    }
    const top = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 5)}, ${Math.max(0, b)})`;
    const bot = `rgb(${Math.max(0, r - 10)}, ${Math.max(0, g - 15)}, ${Math.max(0, b)})`;
    return `linear-gradient(0deg, ${top} 0%, ${bot} 100%)`;
  }

  async function paint() {
    const canvas = canvasEl;
    if (!canvas || width <= 0 || height <= 0) return;

    const gen = ++paintGen;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const w = Math.max(1, Math.round(width * 1.2));
    const h = Math.max(1, Math.round(height * 1.2));
    const fill = ELEMENT_FILL[element] ?? ELEMENT_FILL.None!;

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);

    try {
      const img = await loadOverlay();
      if (gen !== paintGen || canvasEl !== canvas) return;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "overlay";
      const fit = coverFit(img.naturalWidth, img.naturalHeight, w, h);
      ctx.drawImage(
        img,
        0,
        0,
        img.naturalWidth,
        img.naturalHeight,
        fit.x,
        fit.y,
        fit.width,
        fit.height,
      );

      const sample = ctx.getImageData(Math.floor(w / 2), 0, 10, 1);
      onAccent?.(accentFromSample(sample.data));
    } catch {
      // Keep solid fill if texture fails.
    }
  }

  $effect(() => {
    void element;
    void width;
    void height;
    void paint();
  });
</script>

<canvas class="Overlay" bind:this={canvasEl} aria-hidden="true"></canvas>

<style>
  /* Exact Enka Overlay canvas chrome (no z-index — splash paints above via DOM order) */
  .Overlay {
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    width: auto;
    pointer-events: none;
    color: rgb(148, 160, 167);
  }
</style>
