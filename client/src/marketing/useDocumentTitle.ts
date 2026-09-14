import { useEffect } from "react";

const DEFAULT_TITLE = "Bleadin — Automatisation & Prospection LinkedIn";

export function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previous = meta?.content;
    if (meta && description) meta.content = description;
    return () => {
      document.title = DEFAULT_TITLE;
      if (meta && previous !== undefined) meta.content = previous;
    };
  }, [title, description]);
}
