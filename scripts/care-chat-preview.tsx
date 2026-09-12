import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CareChatPanel } from '../src/features/storefront/assistant/CareChatPanel';
import '../src/styles/index.css';
function Preview() {
  const location = useLocation();
  return <><main style={{padding:'2rem',minHeight:'100vh',background:'#f4f0e8'}}><p>LOCAL QA · NO LIVE AI OR ACCOUNT REQUESTS</p><h1>CozyCraft Care preview</h1><p>Destination: {location.pathname}{location.search}</p><button type="button">Background focus check</button></main><CareChatPanel ownerId={null} currentPath={location.pathname + location.search}/></>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><Preview/></MemoryRouter>);
