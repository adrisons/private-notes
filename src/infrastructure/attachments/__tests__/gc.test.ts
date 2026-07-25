import { describe, expect, it } from "vitest";
import { initializeVault } from "../../fs/vault";
import { fileExists } from "../../fs/handle";
import { makeFakeRoot } from "../../../test/fakeFs";
import { storeAttachment } from "../storage";
import { addRef } from "../refs";
import { sweepOrphanAttachments } from "../gc";
import { createNote, updateNote } from "../../notes/storage";
import { fakeFile } from "../../../test/vaultFixtures";

describe("sweepOrphanAttachments", () => {
  it("removes blobs not referenced by any live note body", async () => {
    const root = makeFakeRoot();
    await initializeVault(root);
    const stored = await storeAttachment(root, fakeFile("pic.png", "image/png", [1]));
    const record = await createNote(
      { root },
      { title: "T", body: `![img](${stored.path})` },
    );
    await addRef(root, record.id, stored.path);

    await updateNote({ root }, record.id, { body: "plain text" });

    expect(await fileExists(root, stored.path)).toBe(true);

    await sweepOrphanAttachments(root, ["plain text"]);

    expect(await fileExists(root, stored.path)).toBe(false);
  });
});
