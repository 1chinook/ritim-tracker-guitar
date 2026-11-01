import { initializePreferences } from "./preferences.js";
import { initializeTabEditor } from "./tab-editor.js";

initializePreferences();
const editor = initializeTabEditor({ onStart() {}, onStop() {} });
window.addEventListener("pagehide", () => editor.stop());
