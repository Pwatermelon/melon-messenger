import { Link } from "react-router-dom";
import type { LegalDocument } from "../content/legal/types";
import { LEGAL } from "../config/legal";
import { useDocumentScroll } from "../hooks/useDocumentScroll";

type Props = {
  document: LegalDocument;
  backTo?: string;
};

export default function LegalDocumentPage({ document, backTo = "/login" }: Props) {
  useDocumentScroll();

  return (
    <div className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <Link to={backTo} className="legal-back">
            ← Назад
          </Link>
          <h1>{document.title}</h1>
          {document.subtitle ? <p className="legal-subtitle">{document.subtitle}</p> : null}
          <p className="legal-meta">
            {LEGAL.serviceName} · версия {LEGAL.policyVersion} · {LEGAL.policyEffectiveDate}
          </p>
        </header>

        <div className="legal-body">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section">
              {section.title ? <h2>{section.title}</h2> : null}
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {section.list ? (
                <ul>
                  {section.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <p>
            Вопросы:{" "}
            <a href={`mailto:${LEGAL.operator.email}`}>{LEGAL.operator.email}</a>
          </p>
          <p>
            <Link to="/legal/privacy">Политика конфиденциальности</Link>
            {" · "}
            <Link to="/legal/personal-data-consent">Согласие на обработку ПДн</Link>
            {" · "}
            <Link to="/legal/terms">Пользовательское соглашение</Link>
            {" · "}
            <Link to="/faq">FAQ</Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
