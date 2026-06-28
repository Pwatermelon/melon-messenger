import { Link } from "react-router-dom";
import { faqRu } from "../content/faq.ru";
import { LEGAL } from "../config/legal";
import { useDocumentScroll } from "../hooks/useDocumentScroll";

export default function FaqPage() {
  useDocumentScroll();

  return (
    <div className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <Link to="/login" className="legal-back">
            ← Назад
          </Link>
          <h1>Частые вопросы (FAQ)</h1>
          <p className="legal-subtitle">{LEGAL.serviceName}</p>
        </header>

        <div className="faq-list">
          {faqRu.map((item) => (
            <details key={item.id} className="faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>

        <footer className="legal-footer">
          <p>
            Не нашли ответ? Напишите на{" "}
            <a href={`mailto:${LEGAL.operator.email}`}>{LEGAL.operator.email}</a> или воспользуйтесь кнопкой
            жалобы «!» в приложении после входа.
          </p>
          <p>
            <Link to="/legal/privacy">Политика конфиденциальности</Link>
            {" · "}
            <Link to="/legal/terms">Пользовательское соглашение</Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
