import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Layout, StoreContext, type Store } from '../src/app/core';
import { defaultStoreSettings } from '../src/lib/settings/store-settings';
import { setCatalogStale } from '../src/lib/catalog/offline-catalog';
import '../src/styles/index.css';

setCatalogStale(true);
function Preview() {
  const [announcement, setAnnouncement] = useState(false);
  const [immersive, setImmersive] = useState(true);
  const store = { storeSettings: { ...defaultStoreSettings, announcement_enabled: announcement, announcement_text: 'CozyCraft store announcement' }, cart: [], saved: [], products: [], orders: [], userId: null, user: null, profileUsername: '', avatar: null, authReady: true, role: null } as unknown as Store;
  return <MemoryRouter initialEntries={['/home']}><StoreContext.Provider value={store}><Layout immersive={immersive}>
    <main>
      <section style={{minHeight: '100svh', background: 'linear-gradient(125deg,#36392d,#756b59)',color:'white',padding:'180px 24px 64px'}}>
        <div style={{maxWidth:1100,margin:'auto'}}><p>LOCAL NAVIGATION QA · NO ACCOUNT OR CATALOG WRITES</p><h1 className="mt-5 font-serif text-5xl">A clear view, in every connection.</h1><p className="mt-5 max-w-xl leading-7">The real storefront header, notices and menus with isolated page content.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="rounded-xl bg-white px-4 py-3 text-black" onClick={()=>setCatalogStale(true)}>Show saved-catalog notice</button>
            <button className="rounded-xl bg-white px-4 py-3 text-black" onClick={()=>setCatalogStale(false)}>Recover live catalog</button>
            <button className="rounded-xl bg-white px-4 py-3 text-black" onClick={()=>setAnnouncement(v=>!v)}>Toggle store announcement</button>
            <button className="rounded-xl bg-white px-4 py-3 text-black" onClick={()=>setImmersive(v=>!v)}>Toggle regular page</button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-24" style={{minHeight:1000}}><h2 className="font-serif text-4xl">Scroll and return to the navigation.</h2><p className="mt-6">Page content should never bleed through the solid header.</p></section>
    </main>
  </Layout></StoreContext.Provider></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
