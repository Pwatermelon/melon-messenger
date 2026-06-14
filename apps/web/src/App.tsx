import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import BetaWelcome from "./pages/BetaWelcome";
import BetaPending from "./pages/BetaPending";
import AdminPanel from "./pages/AdminPanel";
import Platinum from "./pages/Platinum";
import ChatLayout from "./pages/ChatLayout";
import ChatRoom from "./pages/ChatRoom";
import Profile from "./pages/Profile";
import IconPreview from "./pages/IconPreview";
import { BrandIcon } from "./components/BrandIcon";

function AuthRequired({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="auth-page"><p className="login-hint">Загрузка…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function MessengerLayout() {
  const { user, token } = useAuth();
  if (!user?.betaApproved) return <Navigate to="/beta/pending" replace />;
  return (
    <WebSocketProvider token={token}>
      <Outlet />
    </WebSocketProvider>
  );
}

function EmptyChat() {
  return (
    <div className="empty-chat">
      <div className="empty-chat-icon">
        <BrandIcon size={80} />
      </div>
      <h2>Watermelon Messenger</h2>
      <p>Выберите чат или создайте новый</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/platinum" element={<Platinum />} />
      <Route path="/icon" element={<IconPreview />} />

      <Route path="/beta/pending" element={<AuthRequired><BetaPending /></AuthRequired>} />
      <Route path="/beta/welcome" element={<AuthRequired><BetaWelcome /></AuthRequired>} />
      <Route path="/admin" element={<AuthRequired><AdminPanel /></AuthRequired>} />

      <Route element={<AuthRequired><MessengerLayout /></AuthRequired>}>
        <Route path="/" element={<ChatLayout />}>
          <Route index element={<EmptyChat />} />
          <Route path="chat/:chatId" element={<ChatRoom />} />
          <Route path="settings" element={<Navigate to="/" replace state={{ openSettings: true }} />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:userId" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
