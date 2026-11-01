import { english, translate } from "./translations.js";

let language = "tr";
const bindings = new Map();

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Uygulama kayıtsız da çalışır. */
  }
}

export function t(source, parameters) {
  return translate(source, language, parameters);
}

// Dinamik metnin kaynağını tut: kayıt veya analiz durumu dil değişince kaybolmaz.
export function setText(selector, source, parameters = {}) {
  const element =
    typeof selector === "string" ? document.querySelector(selector) : selector;
  bindings.set(element, { source, parameters });
  element.textContent = t(source, parameters);
}

function renderTranslations() {
  for (const [node, binding] of bindings) {
    if (!node.isConnected) {
      bindings.delete(node);
      continue;
    }
    const value = t(binding.source, binding.parameters);
    if (binding.attribute) node.setAttribute(binding.attribute, value);
    else node.textContent = value;
  }
  document.documentElement.lang = language;
  document.title =
    document.body.dataset?.page === "editor"
      ? language === "en"
        ? "Ritim İzi — Tab Editor"
        : "Ritim İzi — Tab Editörü"
      : language === "en"
        ? "Ritim İzi — Guitar Practice Analysis"
        : "Ritim İzi — Gitar Performans Analizi";
  document.querySelector('meta[name="description"]').content =
    language === "en"
      ? "Record your guitar practice and explore estimated tempo and rhythmic consistency."
      : "Gitar egzersizlerini kaydet, tahmini temponu ve ritim tutarlılığını incele.";
  updateThemeButton();
}

function updateThemeButton() {
  const selector = document.querySelector("#themeToggle");
  selector.value = document.documentElement.dataset.theme;
  selector.setAttribute("aria-label", t("Görünüm"));
}

export function initializePreferences() {
  const savedLanguage = readPreference("ritim-language");
  language = ["tr", "en"].includes(savedLanguage) ? savedLanguage : "tr";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const source = node.textContent.replace(/\s+/g, " ").trim();
    if (Object.hasOwn(english, source)) bindings.set(node, { source });
  }
  document.querySelectorAll("[aria-label]").forEach((element) => {
    const source = element.getAttribute("aria-label");
    if (Object.hasOwn(english, source))
      bindings.set(element, { source, attribute: "aria-label" });
  });
  const languageSelect = document.querySelector("#languageSelect");
  languageSelect.value = language;
  languageSelect.addEventListener("change", () => {
    language = languageSelect.value;
    savePreference("ritim-language", language);
    renderTranslations();
    document.dispatchEvent(new Event("preferenceschange"));
  });
  document.querySelector("#themeToggle").addEventListener("change", (event) => {
    const root = document.documentElement;
    root.dataset.theme = event.target.value === "dark" ? "dark" : "light";
    savePreference("ritim-theme", root.dataset.theme);
    updateThemeButton();
    document.dispatchEvent(new Event("preferenceschange"));
  });
  renderTranslations();
}
