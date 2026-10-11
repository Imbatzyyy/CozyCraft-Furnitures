// @vitest-environment jsdom
import {act,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {ReportsPage} from './ReportsPage';
const mocks=vi.hoisted(()=>({query:vi.fn(),unavailable:false}));
vi.mock('@/app/core',()=>({
  useStore:()=>({adminProducts:[],storeSettings:{}}),
  useAdminSession:()=>({userId:'fixture',workspaceReady:false}),
  money:(value:number)=>`PHP ${value}`,Toast:()=>null,
}));
vi.mock('@/features/admin/shell/AdminShell',()=>({AdminShell:({children}:{children:ReactNode})=><main>{children}</main>}));
vi.mock('@/features/admin/intelligence/ForecastPanel',()=>({ForecastPanel:()=>null}));
vi.mock('@/components/admin/charts',()=>({RevenueArea:()=>null}));
vi.mock('@/services/admin/use-admin-query',()=>({useAdminQuery:(name:string,params:Record<string,string>)=>{
  mocks.query(name,params);
  return {data:mocks.unavailable?null:{start:'2026-10-01T00:00:00Z',generatedAt:'2026-10-11T00:00:00Z',scope:params.p_scope,grossSales:params.p_scope==='test'?400:100,paidCount:1,orderCount:1,fulfilled:0,refundedValue:0,cancelledCount:0,repeatCustomers:0,customerCount:1,categoryRevenue:{},soldByProduct:{},trendData:[]},error:mocks.unavailable?'Unavailable':'',reload:()=>{},loading:mocks.unavailable};
}}));
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.clearAllMocks();mocks.unavailable=false;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('report environment controls',()=>{
  it('defaults to live/COD, explicitly switches to test and labels the difference',async()=>{
    await act(async()=>root.render(<ReportsPage/>));
    expect(mocks.query).toHaveBeenLastCalledWith('admin_reports_summary_scoped',{p_range:'This month',p_scope:'live'});
    const field=[...host.querySelectorAll('label')].find(n=>n.textContent?.includes('Payment data'))!.querySelector('select')!;
    await act(async()=>{field.value='test';field.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(mocks.query).toHaveBeenLastCalledWith('admin_reports_summary_scoped',{p_range:'This month',p_scope:'test'});
    expect(host.textContent).toContain('did not collect real money');
    expect(host.textContent).toContain('order-created date');
  });
  it('does not allow export when figures are unavailable',async()=>{
    mocks.unavailable=true;
    await act(async()=>root.render(<ReportsPage/>));
    expect(host.textContent).toContain('Figures are unavailable, not zero');
    expect([...host.querySelectorAll('button')].find(n=>n.textContent?.includes('Export CSV'))?.disabled).toBe(true);
  });
});
