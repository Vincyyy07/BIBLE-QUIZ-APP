import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HostPage from './pages/HostPage';
import JoinPage from './pages/JoinPage';
import PlayPage from './pages/PlayPage';
import DisplayPage from './pages/DisplayPage';

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<JoinPage />} />
        <Route path="/host"          element={<HostPage />} />
        <Route path="/join"          element={<JoinPage />} />
        <Route path="/play"          element={<PlayPage />} />
        <Route path="/display/:code" element={<DisplayPage />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
