/**
 * Rasterises the scene to a PNG.
 *
 * Route: serialise → blob URL → <img> → <canvas> → toBlob. A blob URL rather
 * than a data URL because a 40-flower scene serialises to tens of kilobytes and
 * data URLs of that size are slow (and historically size-capped) in some
 * browsers.
 *
 * The canvas stays untainted because `serializeScene` inlines everything — no
 * external images, no webfonts — so `toBlob` is not blocked by CORS.
 */
import { SCENE } from '../render/vaseGeometry';
import { serializeScene } from './exportSvg';

const DEFAULT_SCALE = 2;

export function pngBlob(svg: SVGSVGElement, scale = DEFAULT_SCALE): Promise<Blob> {
  const markup = serializeScene(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'sync';

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SCENE.w * scale;
        canvas.height = SCENE.h * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not acquire a 2D canvas context.');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas produced no PNG data.'));
        }, 'image/png');
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The browser could not rasterise the exported SVG.'));
    };

    image.src = url;
  });
}
