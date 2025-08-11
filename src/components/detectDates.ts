import { parse } from "date-fns";

const COMMON_DATE_FORMATS = [
  "dd-MM-yyyy",
  "MM/dd/yyyy",
  "yyyy-MM-dd",
  "dd/MM/yyyy",
  "M/d/yyyy",
  "d-M-yyyy",
];

function isLikelyDate(value: string) {
  return COMMON_DATE_FORMATS.some((formatStr) => {
    const parsed = parse(value, formatStr, new Date());
    return !isNaN(parsed.getTime());
  });
}

export function detectDateFields(data: any[], fields: string[], sampleSize = 5): string[] {
  const likelyDateFields: string[] = [];

  for (const field of fields) {
    let validCount = 0;
    for (let i = 0; i < Math.min(sampleSize, data.length); i++) {
      const value = data[i][field];
      if (typeof value === "string" && isLikelyDate(value.trim())) {
        validCount++;
      }
    }
    if (validCount / Math.min(sampleSize, data.length) >= 0.8) {
      likelyDateFields.push(field);
    }
  }

  return likelyDateFields;
}
