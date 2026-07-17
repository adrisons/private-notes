import * as picker from "../../lib/fs/picker";
import type { FolderPicker } from "../../application/ports/folder-picker";

export const browserFolderPicker: FolderPicker = {
  pick: () => picker.pickFolder(),
};
