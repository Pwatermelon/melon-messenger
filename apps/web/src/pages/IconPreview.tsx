import { Link } from "react-router-dom";
import { BrandIcon } from "../components/BrandIcon";

const SIZES = [16, 32, 48, 64, 128, 256, 512];

export default function IconPreview() {
  return (
    <div className="icon-preview-page">
      <div className="icon-preview-header">
        <Link to="/">← Назад</Link>
        <h1>Watermelon — иконка</h1>
        <p>Квадратные PNG, 32–512 px. Для Яндекс OAuth: <code>/yandex-oauth-icon.png</code> (200×200)</p>
      </div>

      <div className="icon-preview-hero">
        <BrandIcon size={256} />
        <p className="icon-preview-hero-caption">512 × 512 — icon-512.png</p>
      </div>

      <div className="icon-preview-favicon-sim">
        <p>Как во вкладке браузера (16px):</p>
        <div className="icon-preview-tab">
          <BrandIcon size={16} />
          <span>Watermelon Messenger</span>
        </div>
      </div>

      <div className="icon-preview-grid">
        {SIZES.map((s) => (
          <div key={s} className="icon-preview-cell">
            <BrandIcon size={s} />
            <span>{s}px</span>
          </div>
        ))}
      </div>

      <div className="icon-preview-on-bg">
        <div className="icon-preview-bg icon-preview-bg-dark">
          <BrandIcon size={96} />
          <span>На тёмном</span>
        </div>
        <div className="icon-preview-bg icon-preview-bg-light">
          <BrandIcon size={96} />
          <span>На светлом</span>
        </div>
      </div>

      <p className="icon-preview-hint">
        Во вкладке браузера иконка подхватится после перезагрузки. Прямая ссылка:{" "}
        <a href="/icon-512.png" target="_blank" rel="noopener noreferrer">/icon-512.png</a>
        {" · "}
        <a href="/yandex-oauth-icon.png" target="_blank" rel="noopener noreferrer">/yandex-oauth-icon.png</a>
      </p>
    </div>
  );
}
