import * as picker from "./picker";
import type { FolderPicker } from "../../application/ports/folder-picker";

export const browserFolderPicker: FolderPicker = {
  pick: () => picker.pickFolder(),
};
