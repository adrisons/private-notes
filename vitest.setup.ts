import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import * as axeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(axeMatchers);

/**
 * jsdom has no Canvas API. axe-core's color-contrast rule creates a 2D context
 * to detect icon ligatures; without this stub every accessibility test logs
 * "HTMLCanvasElement.prototype.getContext is not implemented".
 */
function createCanvas2DContext(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  let width = 300;
  let height = 150;

  Object.defineProperty(canvas, "width", {
    get: () => width,
    set: (value) => {
      width = value;
    },
  });
  Object.defineProperty(canvas, "height", {
    get: () => height,
    set: (value) => {
      height = value;
    },
  });

  return {
    canvas,
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "top",
    measureText: (text: string) => ({
      width: Math.max(text.length, 1) * 10,
    }),
    fillText: () => {},
    clearRect: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  } as unknown as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = function getContext(contextType) {
  return contextType === "2d" ? createCanvas2DContext() : null;
} as typeof HTMLCanvasElement.prototype.getContext;
