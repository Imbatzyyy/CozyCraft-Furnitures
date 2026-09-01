export const normalizePhilippineMobile = (value: string) => {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
  if (/^639\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+639\d{9}$/.test(compact)) return compact;
  return null;
};

export const formatPhilippineMobile = (value: string) => {
  const normalized = normalizePhilippineMobile(value);
  if (!normalized) return value;
  return `0${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
};

export const maskPhilippineMobile = (value: string) => {
  const normalized = normalizePhilippineMobile(value);
  if (!normalized) return "your mobile number";
  return `${normalized.slice(0, 5)}•••${normalized.slice(-4)}`;
};

export const isSixDigitOtp = (value: string) => /^\d{6}$/.test(value);
