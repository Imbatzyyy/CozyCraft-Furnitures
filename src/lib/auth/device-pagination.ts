export const DEVICE_PAGE_SIZE = 5;
export function paginateDevices<T extends { is_current: boolean }>(devices: T[], requestedPage: number) {
  const ordered = [...devices].sort((a, b) => Number(b.is_current) - Number(a.is_current));
  const pages = Math.max(1, Math.ceil(ordered.length / DEVICE_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, requestedPage));
  return { page, pages, items: ordered.slice((page - 1) * DEVICE_PAGE_SIZE, page * DEVICE_PAGE_SIZE) };
}
