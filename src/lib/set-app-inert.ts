const ROOT_ID = "root";

/** Block interaction with the app shell while a modal owns the screen. */
export function setAppInert(inert: boolean): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  if (inert) {
    root.setAttribute("inert", "");
    return;
  }
  root.removeAttribute("inert");
}
