import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML produced by RichTextEditor before it's used with
 * dangerouslySetInnerHTML. `style` is allowed only because TextAlign writes
 * inline `style="text-align:center"` — that's the mechanism, not a hole.
 */
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'h2', 'h3'],
    ALLOWED_ATTR: ['style'],
  });
}
