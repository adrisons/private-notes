import { describe, expect, it } from "vitest";
import {
  dataUrlToFile,
  hasImageFilesInDataTransfer,
  imageFilesFromClipboard,
  imageFilesFromDataTransfer,
} from "../image-files";

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fakeDataTransfer(
  files: File[],
  options: {
    items?: DataTransferItem[];
    html?: string;
  } = {},
): DataTransfer {
  return {
    files,
    items: options.items ?? [],
    getData(type: string) {
      if (type === "text/html") return options.html ?? "";
      return "";
    },
  } as unknown as DataTransfer;
}

describe("imageFilesFromDataTransfer", () => {
  it("returns only image/* files", () => {
    const png = new File(["x"], "photo.png", { type: "image/png" });
    const txt = new File(["y"], "notes.txt", { type: "text/plain" });
    const webp = new File(["z"], "pic.webp", { type: "image/webp" });
    const svg = new File(["<svg/>"], "payload.svg", { type: "image/svg+xml" });

    expect(
      imageFilesFromDataTransfer(fakeDataTransfer([png, txt, webp, svg])),
    ).toEqual([png, webp]);
  });

  it("returns an empty list when there are no files", () => {
    expect(imageFilesFromDataTransfer(null)).toEqual([]);
    expect(imageFilesFromDataTransfer(fakeDataTransfer([]))).toEqual([]);
  });
});

describe("hasImageFilesInDataTransfer", () => {
  it("is true when at least one image is present", () => {
    const png = new File(["x"], "photo.png", { type: "image/png" });
    expect(hasImageFilesInDataTransfer(fakeDataTransfer([png]))).toBe(true);
  });

  it("is false for non-image transfers", () => {
    const txt = new File(["y"], "notes.txt", { type: "text/plain" });
    expect(hasImageFilesInDataTransfer(fakeDataTransfer([txt]))).toBe(false);
  });
});

describe("dataUrlToFile", () => {
  it("decodes a PNG data URL into a File", () => {
    const file = dataUrlToFile(TINY_PNG_DATA_URL, "screenshot.png");
    expect(file).not.toBeNull();
    expect(file?.type).toBe("image/png");
    expect(file?.name).toBe("screenshot.png");
    expect(file?.size).toBeGreaterThan(0);
  });

  it("returns null for non-image data URLs", () => {
    expect(
      dataUrlToFile("data:text/plain;base64,dGVzdA==", "note.txt"),
    ).toBeNull();
  });
});

describe("imageFilesFromClipboard", () => {
  it("reads image items when files is empty", () => {
    const png = new File(["x"], "clip.png", { type: "image/png" });
    const item = {
      kind: "file",
      type: "image/png",
      getAsFile: () => png,
    } as unknown as DataTransferItem;

    expect(imageFilesFromClipboard(fakeDataTransfer([], { items: [item] }))).toEqual(
      [png],
    );
  });

  it("falls back to inline data URLs in pasted HTML", () => {
    const html = `<meta charset="utf-8"><img src="${TINY_PNG_DATA_URL}">`;

    const files = imageFilesFromClipboard(
      fakeDataTransfer([], { html }),
    );

    expect(files).toHaveLength(1);
    expect(files[0]?.type).toBe("image/png");
    expect(files[0]?.name).toBe("pasted-image-1.png");
  });
});
