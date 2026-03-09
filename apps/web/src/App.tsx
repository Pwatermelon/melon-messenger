import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chats from "./pages/Chats";
import ChatRoom from "./pages/ChatRoom";

function ProtectedLayout() {
  const { user, token } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <WebSocketProvider token={token}>
      <Outlet />
    </WebSocketProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Chats />} />
        <Route path="/chat/:chatId" element={<ChatRoom />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
