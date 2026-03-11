import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatLayout from "./pages/ChatLayout";
import ChatRoom from "./pages/ChatRoom";
import Settings from "./pages/Settings";

function ProtectedLayout() {
  const { user, token } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <WebSocketProvider token={token}>
      <Outlet />
    </WebSocketProvider>
  );
}

function EmptyChat() {
  return <div className="empty-chat">Select a chat or start a new one</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<ChatLayout />}>
          <Route index element={<EmptyChat />} />
          <Route path="chat/:chatId" element={<ChatRoom />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
