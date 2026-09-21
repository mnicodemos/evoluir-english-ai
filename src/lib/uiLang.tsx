import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { uiPt } from "@/lib/uiDictionary";

export type UiLang = "en" | "pt";

export const UI_LANG_KEY = "evoluir-ui-lang";

type Ctx = { lang: UiLang; setLang: (lang: UiLang) => void };

const UiLangContext = createContext<Ctx>({ lang: "pt", setLang: () => {} });

export function useUiLang() {
  return useContext(UiLangContext);
}

const ATTRS = ["placeholder", "aria-label", "title"] as const;

/**
 * Translates only known interface strings (exact match). Lesson content,
 * practice sentences and AI generated text are never in the dictionary,
 * so they always stay in English.
 */
export function UiLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("pt");
  const rootRef = useRef<HTMLDivElement>(null);
  const originals = useRef(new WeakMap<Node, string>());
  const attrOriginals = useRef(new WeakMap<Element, Record<string, string>>());

  useEffect(() => {
    const stored = localStorage.getItem(UI_LANG_KEY);
    if (stored === "pt" || stored === "en") setLangState(stored);
  }, []);

  function setLang(next: UiLang) {
    localStorage.setItem(UI_LANG_KEY, next);
    setLangState(next);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let applying = false;

    function translateText(node: Text) {
      const current = node.nodeValue ?? "";
      const key = current.trim();
      if (!key) return;
      if (lang === "pt") {
        const hit = uiPt[key];
        if (hit && hit !== key) {
          if (!originals.current.has(node)) originals.current.set(node, current);
          node.nodeValue = current.replace(key, hit);
        }
      } else {
        const original = originals.current.get(node);
        if (original !== undefined && original !== current) node.nodeValue = original;
      }
    }

    function translateAttrs(el: Element) {
      for (const attr of ATTRS) {
        const current = el.getAttribute(attr);
        if (!current) continue;
        const key = current.trim();
        if (lang === "pt") {
          const hit = uiPt[key];
          if (hit && hit !== key) {
            const saved = attrOriginals.current.get(el) ?? {};
            if (saved[attr] === undefined) {
              saved[attr] = current;
              attrOriginals.current.set(el, saved);
            }
            el.setAttribute(attr, hit);
          }
        } else {
          const saved = attrOriginals.current.get(el);
          if (saved?.[attr] !== undefined && saved[attr] !== current) {
            el.setAttribute(attr, saved[attr]);
          }
        }
      }
    }

    function walk(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        translateText(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
      translateAttrs(el);
      el.childNodes.forEach(walk);
    }

    function run(targets: Node[]) {
      if (applying) return;
      applying = true;
      try {
        targets.forEach(walk);
      } finally {
        applying = false;
      }
    }

    const observer = new MutationObserver((records) => {
      if (applying) return;
      const targets: Node[] = [];
      for (const record of records) {
        if (record.type === "characterData") targets.push(record.target);
        else if (record.type === "attributes") targets.push(record.target);
        else record.addedNodes.forEach((n) => targets.push(n));
      }
      if (targets.length) run(targets);
    });

    // Lazy routes may still be hydrating when this provider's effect runs.
    // Defer DOM translation until React has finished attaching to the route.
    const timer = window.setTimeout(() => {
      run([root]);
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRS],
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [lang]);

  return (
    <UiLangContext.Provider value={{ lang, setLang }}>
      <div ref={rootRef}>{children}</div>
    </UiLangContext.Provider>
  );
}

export function UiLangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useUiLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "pt" : "en")}
      aria-label={lang === "en" ? "Mudar idioma para português" : "Switch language to English"}
      className={
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:min-h-8 sm:min-w-8 " +
        (className ?? "")
      }
    >
      {lang === "en" ? "EN" : "PT"}
    </button>
  );
}
