/**
 * Shared utilities for scraping and content detection.
 * Used by both /api/scrape-url and /api/crawl-site.
 */

export const LOW_TEXT_THRESHOLD = 200;

/**
 * Strip boilerplate text to measure "meaningful" content.
 * Nav links, footers, cookie banners, etc. are noise.
 */
export function stripBoilerplate(markdown: string): string {
  const boilerplate = [
    "sign in", "sign up", "log in", "log out", "cookie", "privacy policy",
    "terms of service", "subscribe", "newsletter", "follow us",
    "copyright", "all rights reserved", "powered by", "accept cookies",
    "close menu", "open menu", "skip to content",
  ];

  return markdown
    .split("\n")
    .filter((line) => line.trim().length >= 20)
    .filter((line) => {
      const lower = line.toLowerCase();
      return !boilerplate.some((phrase) => lower.includes(phrase));
    })
    .join("\n")
    .trim();
}
