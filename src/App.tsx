import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Research from './pages/Research';
import CopyGenerator from './pages/CopyGenerator';
import CreativeStudio from './pages/CreativeStudio';
import CampaignManager from './pages/CampaignManager';
import Analytics from './pages/Analytics';
import AutomationRules from './pages/AutomationRules';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="research" element={<Research />} />
          <Route path="copy" element={<CopyGenerator />} />
          <Route path="creatives" element={<CreativeStudio />} />
          <Route path="campaigns" element={<CampaignManager />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="automation" element={<AutomationRules />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
