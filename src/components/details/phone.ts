// Phone numbers on the Details page, as tappable links. Pure, so it can be
// tested (tests/phone.test.mjs).

/** A tel: link for an Australian number as we write it: "0435 597 406" → "tel:+61435597406". */
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits.startsWith('0') ? `61${digits.slice(1)}` : digits}`;
}

// An Australian mobile or landline, spaced or not: 0435 597 406, 0435597406, +61 435 597 406, 02 4464 1234.
const PHONE = /((?:\+61 ?|0)[2-478](?: ?\d){8})/;

/** Text split around the phone numbers in it, each number with its tel: link, so the page can link them. */
export function withPhoneLinks(text: string): { text: string; tel?: string }[] {
  // Splitting on a captured pattern puts each number at an odd index.
  return text.split(PHONE).map((part, i) => i % 2 ? { text: part, tel: telHref(part) } : { text: part }).filter(part => part.text);
}
