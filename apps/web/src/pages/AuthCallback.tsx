import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiUrl } from "../config";
import type { User } from "@melon/shared";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Токен не получен");
      return;
    }
    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Не удалось получить профиль");
        const user = (await r.json()) as User;
        setSession(token, user);
        if (!user.betaApproved) {
          navigate("/beta/pending", { replace: true });
        } else if (!localStorage.getItem("wm_beta_welcome_seen")) {
          navigate("/beta/welcome", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      })
      .catch(() => setError("Ошибка авторизации"));
  }, [params, setSession, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-center">
        {error ? (
          <>
            <p className="auth-error">{error}</p>
            <a href="/login">Вернуться ко входу</a>
          </>
        ) : (
          <p className="login-hint">Входим…</p>
        )}
      </div>
    </div>
  );
}
