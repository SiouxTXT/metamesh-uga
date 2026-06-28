import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Tools } from './pages/Tools';
import { Usage } from './pages/Usage';
import { Billing } from './pages/Billing';
import { AgentDashboard } from './pages/AgentDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      retry: 2
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/agent" element={<AgentDashboard />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
