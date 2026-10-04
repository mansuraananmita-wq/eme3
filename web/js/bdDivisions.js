/**
 * Bangladesh divisions stored in addresses.district.
 * "Dhaka" is what f6_shipping_fee treats as the 60 BDT zone.
 */

export const BD_DIVISIONS = Object.freeze([
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
]);

/**
 * Keeps a saved value that is not one of the eight divisions.
 * @param {string | null | undefined} current
 * @returns {string[]}
 */
export function divisionChoices(current) {
  const value = String(current || "").trim();
  if (value && !BD_DIVISIONS.includes(value)) return [value, ...BD_DIVISIONS];
  return [...BD_DIVISIONS];
}
