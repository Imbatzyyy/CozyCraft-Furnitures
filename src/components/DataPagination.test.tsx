// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { DataPagination } from './DataPagination';
it('uses server totals, navigates pages, and disables controls during loading',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const change=vi.fn();
  const render=(page:number,busy=false)=>act(()=>root.render(<DataPagination page={page} total={13} size={5} onChange={change} busy={busy} label="Order pages"/>));
  await render(1);let buttons=host.querySelectorAll('button');expect(buttons[0].disabled).toBe(true);expect(host.textContent).toContain('1–5 of 13');
  await act(()=>buttons[1].click());expect(change).toHaveBeenCalledWith(2);
  await render(3);buttons=host.querySelectorAll('button');expect(buttons[1].disabled).toBe(true);expect(host.textContent).toContain('11–13 of 13');
  await render(2,true);expect([...host.querySelectorAll('button')].every(button=>button.disabled)).toBe(true);
  await act(()=>root.unmount());host.remove();
});
