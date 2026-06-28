import { Link } from "react-router-dom";
import { useDocumentScroll } from "../hooks/useDocumentScroll";

export default function NotFound() {
  useDocumentScroll();

  return (
    <div className="auth-page not-found-page">
      <div className="not-found-card">
        <h1>404</h1>
        <p>Страница не найдена.</p>
        <Link to="/" className="not-found-link">
          На главную
        </Link>
      </div>
    </div>
  );
}
