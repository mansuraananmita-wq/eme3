/**
 * Words worth matching against the live catalog.
 * Stop words are question filler in English and Bangla, not product names.
 */

const STOP = new Set([
  "the", "a", "an", "is", "are", "of", "for", "to", "and", "or", "in", "on",
  "what", "which", "where", "how", "much", "price", "stock", "shop", "product",
  "about", "please", "ki", "koto", "dam", "ache",
  "কি", "কী", "কত", "দাম", "আছে", "পণ্য", "দোকান", "সম্পর্কে", "জানা", "জানতে",
  "চাই", "এর", "এই", "একটা", "কোন", "কোথায়", "স্টক",
]);

/**
 * @param {string} question
 * @returns {string[]}
 */
export function catalogTerms(question) {
  return String(question || "")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP.has(word));
}
