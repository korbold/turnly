/**
 * Client-side checksum check for Ecuadorian cédula + RUC. Used purely
 * for instant form feedback — the backend re-runs the same validation
 * (EcuadorIdValidator) before persisting, so this just spares a round-
 * trip when the cashier mistypes a digit.
 *
 * Algorithm comes from the public SRI spec (Servicio de Rentas Internas
 * del Ecuador). Returns false for malformed input rather than throwing
 * so the UI can keep typing-state quiet until the user is done.
 */

function digitsOnly(value: string, length: number): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

export function isCedula(value: string): boolean {
  if (!digitsOnly(value, 10)) return false;

  const province = Number(value.slice(0, 2));
  if (province < 1 || (province > 24 && province !== 30)) return false;

  const third = Number(value[2]);
  if (third > 5) return false;

  const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(value[i]) * weights[i];
    if (d >= 10) d -= 9;
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(value[9]);
}

function publicEntityChecksum(value: string): boolean {
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(value[i]) * weights[i];
  const check = (sum % 11 === 0) ? 0 : 11 - (sum % 11);
  return check === Number(value[8]) && value.slice(9, 13) === '0001';
}

function privateCompanyChecksum(value: string): boolean {
  const weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(value[i]) * weights[i];
  const check = (sum % 11 === 0) ? 0 : 11 - (sum % 11);
  return check === Number(value[9]) && value.slice(10, 13) === '001';
}

export function isRuc(value: string): boolean {
  if (!digitsOnly(value, 13)) return false;
  if (value.slice(10, 13) === '000') return false;

  const third = Number(value[2]);

  if (third < 6) {
    // Natural-person RUC = 10-digit cédula + '001'
    return isCedula(value.slice(0, 10)) && value.slice(10, 13) === '001';
  }
  if (third === 6) return publicEntityChecksum(value);
  if (third === 9) return privateCompanyChecksum(value);
  return false;
}
