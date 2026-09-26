// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TrackingOrderPicker } from './TrackingOrderPicker';
import type { DbOrder } from '@/services/supabase/client';

it('pages a server-owned queue without changing the tracked order and blocks busy actions', async () => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const selected = {id:'older',order_number:'CC-OLD',status:'delivered'} as DbOrder;
  const rows = Array.from({length:5},(_,i)=>({id:String(i),order_number:`CC-${i}`,status:'pending'} as DbOrder));
  const change = vi.fn(), select = vi.fn();
  const render = (page:number,busy=false) => act(()=>root.render(<TrackingOrderPicker orders={rows} selected={selected} onSelect={select} pagination={{page,total:23,onChange:change,busy,error:''}}/>));
  await render(1);
  await act(()=>host.querySelector<HTMLButtonElement>('.tracking-picker-trigger')!.click());
  expect(host.querySelectorAll('li')).toHaveLength(5);
  expect(host.textContent).toContain('23 total');
  await act(()=>host.querySelectorAll<HTMLButtonElement>('nav button')[1].click());
  expect(change).toHaveBeenCalledWith(2); expect(select).not.toHaveBeenCalled();
  await render(2,true);
  expect(host.querySelector('.tracking-picker-trigger')?.textContent).toContain('CC-OLD');
  expect([...host.querySelectorAll<HTMLButtonElement>('li button,nav button')].every(button=>button.disabled)).toBe(true);
  await render(2);
  await act(()=>host.querySelector<HTMLButtonElement>('li button')!.click());
  expect(select).toHaveBeenCalledWith('0'); expect(host.querySelector('ul')).toBeNull();
  await act(()=>root.unmount()); host.remove();
});
