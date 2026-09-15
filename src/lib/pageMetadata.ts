import { useEffect } from 'react';

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl?: string;
}

function updateManagedTag(selector: string, attributes: Record<string, string>) {
  const element = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!element) return;
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

export function setPageMetadata({ title, description, canonicalUrl }: PageMetadata) {
  document.title = title;
  const url = canonicalUrl || window.location.href;
  updateManagedTag('[data-page-meta="description"]', { content: description });
  updateManagedTag('[data-page-meta="canonical"]', { href: url });
  updateManagedTag('[data-page-meta="og-title"]', { content: title });
  updateManagedTag('[data-page-meta="og-description"]', { content: description });
  updateManagedTag('[data-page-meta="og-url"]', { content: url });
  updateManagedTag('[data-page-meta="twitter-title"]', { content: title });
  updateManagedTag('[data-page-meta="twitter-description"]', { content: description });
}

export function usePageMetadata(metadata: PageMetadata) {
  useEffect(() => {
    setPageMetadata(metadata);
  }, [metadata.title, metadata.description, metadata.canonicalUrl]);
}
