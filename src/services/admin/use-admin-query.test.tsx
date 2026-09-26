// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {ADMIN_DATA_CHANGED} from '@/lib/admin/workspace-events';
const mock=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/services/supabase/client',()=>({adminSupabase:{rpc:mock.rpc}}));
import {useAdminQuery} from './use-admin-query';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();mock.rpc.mockReset();});
it('does not expose an old identity/page and ignores late responses after navigation',async()=>{
  vi.useFakeTimers();const requests:Array<{resolve:(value:unknown)=>void;signal:AbortSignal}>=[];
  mock.rpc.mockImplementation(()=>({abortSignal:(signal:AbortSignal)=>new Promise(resolve=>requests.push({resolve,signal}))}));
  let state:ReturnType<typeof useAdminQuery<{value:string}>>;
  function Harness({owner,page}:{owner:string;page:number}){state=useAdminQuery('fixture',{page},true,owner);return <div>{state.data?.value ?? 'loading'}</div>;}
  const host=document.createElement('div');const root=createRoot(host);
  await act(async()=>{root.render(<Harness owner="a" page={1}/>);});
  await act(()=>vi.advanceTimersByTimeAsync(200));expect(requests).toHaveLength(1);
  await act(()=>{requests[0].resolve({data:{value:'A-one'},error:null});});expect(host.textContent).toBe('A-one');
  await act(()=>{window.dispatchEvent(new Event(ADMIN_DATA_CHANGED));});
  await act(()=>vi.advanceTimersByTimeAsync(200));expect(requests).toHaveLength(2);
  await act(()=>root.render(<Harness owner="b" page={2}/>));expect(host.textContent).toBe('loading');expect(requests[1].signal.aborted).toBe(true);
  await act(()=>{requests[1].resolve({data:{value:'old private data'},error:null});});expect(host.textContent).toBe('loading');
  await act(()=>vi.advanceTimersByTimeAsync(200));await act(()=>{requests[2].resolve({data:{value:'B-two'},error:null});});expect(host.textContent).toBe('B-two');
  await act(()=>root.unmount());
});
