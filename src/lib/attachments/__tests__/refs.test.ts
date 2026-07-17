import { describe, it, expect } from "vitest";
import { makeFakeRoot } from "../../../test/fakeFs";
import { initializeVault } from "../../fs/vault";
import { fileExists } from "../../fs/handle";
import {
  addRef,
  addRefsForBody,
  dropNoteRefs,
  readAttachmentRefs,
  syncRefsForBodyChange,
} from "../refs";
import { deleteOrphanAttachments } from "../gc";
import { storeAttachment } from "../storage";

function fakeFile(bytes: number[]) {
  return {
    name: "a.png",
    type: "image/png",
    async arrayBuffer() {
      const out = new ArrayBuffer(bytes.length);
      new Uint8Array(out).set(bytes);
      return out;
    },
  };
}

describe("attachment refs", () => {
  it("addRef registers a note for a path", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRef(root, "note-a", "attachments/abc.png");
    const index = await readAttachmentRefs(root);
    expect(index.refs["attachments/abc.png"]).toEqual(["note-a"]);
  });

  it("addRef is idempotent for the same note and path", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRef(root, "note-a", "attachments/abc.png");
    await addRef(root, "note-a", "attachments/abc.png");
    const index = await readAttachmentRefs(root);
    expect(index.refs["attachments/abc.png"]).toEqual(["note-a"]);
  });

  it("tracks multiple notes referencing the same path", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRef(root, "note-a", "attachments/shared.png");
    await addRef(root, "note-b", "attachments/shared.png");
    const index = await readAttachmentRefs(root);
    expect(index.refs["attachments/shared.png"]).toEqual(["note-a", "note-b"]);
  });

  it("dropNoteRefs empties a path when the last note is removed", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRef(root, "note-a", "attachments/x.png");
    const emptied = await dropNoteRefs(root, "note-a", ["attachments/x.png"]);
    expect(emptied).toEqual(["attachments/x.png"]);
    expect(await readAttachmentRefs(root)).toEqual({ version: 1, refs: {} });
  });

  it("syncRefsForBodyChange removes refs for deleted images", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRef(root, "note-a", "attachments/keep.png");
    await addRef(root, "note-a", "attachments/remove.png");
    const emptied = await syncRefsForBodyChange(
      root,
      "note-a",
      "![a](attachments/keep.png)\n![b](attachments/remove.png)",
      "![a](attachments/keep.png)",
    );
    expect(emptied).toEqual(["attachments/remove.png"]);
    const index = await readAttachmentRefs(root);
    expect(index.refs["attachments/keep.png"]).toEqual(["note-a"]);
    expect(index.refs["attachments/remove.png"]).toBeUndefined();
  });

  it("addRefsForBody registers all paths in markdown", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    await addRefsForBody(
      root,
      "copy-id",
      "![a](attachments/one.png)\n![b](attachments/two.png)",
    );
    const index = await readAttachmentRefs(root);
    expect(index.refs["attachments/one.png"]).toEqual(["copy-id"]);
    expect(index.refs["attachments/two.png"]).toEqual(["copy-id"]);
  });
});

describe("deleteOrphanAttachments", () => {
  it("removes blob files for orphaned paths", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const stored = await storeAttachment(root, fakeFile([1, 2, 3]));
    await deleteOrphanAttachments(root, [stored.path]);
    expect(await fileExists(root, stored.path)).toBe(false);
  });
});
