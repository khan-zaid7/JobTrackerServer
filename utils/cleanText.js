// server/utils/cleanText.js

export default function cleanResumeText(text) {
  if (!text) return '';

  // Remove emails
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '');

  // Remove phone numbers
  text = text.replace(/(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g, '');

  // Remove URLs
  text = text.replace(/https?:\/\/\S+|www\.\S+/gi, '');

  // Remove stray pipes "|"
  text = text.replace(/\|/g, '');

  // Remove JSON-like job object arrays
  text = text.replace(/\[\s*\{\s*"id":\s*".+?"\s*,\s*"title":\s*".+?"\s*\}(,\s*\{\s*"id":\s*".+?"\s*,\s*"title":\s*".+?"\s*\})*\s*\]/gs, '');

  // Normalize multiple newlines into one
  text = text.replace(/\n{2,}/g, '\n');

  // Normalize multiple spaces into one
  text = text.replace(/ +/g, ' ');

  // Trim
  return text.trim();
}
