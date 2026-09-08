import { describe, expect, it } from 'vitest';
import { paginateDevices } from './device-pagination';
describe('device pagination', () => {
  const devices = Array.from({ length: 12 }, (_, id) => ({ id, is_current: id === 11 }));
  it('shows five per page and puts the current device first without mutating input', () => {
    const result = paginateDevices(devices, 1);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe(11);
    expect(devices[0].id).toBe(0);
    expect(result.pages).toBe(3);
  });
  it('shows the remainder without duplicates', () => {
    const all = [1,2,3].flatMap(page => paginateDevices(devices, page).items);
    expect(new Set(all.map(device => device.id)).size).toBe(12);
    expect(paginateDevices(devices, 3).items).toHaveLength(2);
  });
  it('clamps the page after devices are removed', () => expect(paginateDevices(devices.slice(0, 2), 3).page).toBe(1));
  it('handles an empty list', () => expect(paginateDevices([], 2)).toEqual({ page: 1, pages: 1, items: [] }));
});
