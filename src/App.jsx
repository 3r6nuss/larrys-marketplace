import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OfflinePage from '@/pages/OfflinePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* System offline: redirect every route to the offline page */}
        <Route path="*" element={<Navigate to="/offline" replace />} />
        <Route path="/offline" element={<OfflinePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
