import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChat } from "../api";
import { useActiveChat } from "../context/ActiveChatContext";

/** Старые ссылки /chat/:uuid — проверяем доступ и уводим на / без id в адресной строке. */
export default function ChatLegacyRedirect() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { openChat } = useActiveChat();

  useEffect(() => {
    if (!chatId) {
      navigate("/", { replace: true });
      return;
    }
    void getChat(chatId)
      .then(async (chat) => {
        if (chat) await openChat(chat.id);
      })
      .finally(() => navigate("/", { replace: true }));
  }, [chatId, navigate, openChat]);

  return (
    <div className="auth-page">
      <p className="login-hint">Загрузка…</p>
    </div>
  );
}
