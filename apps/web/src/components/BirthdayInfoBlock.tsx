type Props = {
  label: string;
  age?: number | null;
  isToday?: boolean;
  compact?: boolean;
};

function ageLabel(age: number): string {
  const n = Math.abs(age) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${age} лет`;
  if (n1 === 1) return `${age} год`;
  if (n1 >= 2 && n1 <= 4) return `${age} года`;
  return `${age} лет`;
}

export default function BirthdayInfoBlock({ label, age, isToday, compact }: Props) {
  const value = age != null ? `${label} · ${ageLabel(age)}` : label;

  return (
    <div className={`profile-info-block${compact ? " profile-info-block-compact" : ""}`}>
      <span className="profile-info-icon" aria-hidden>🎂</span>
      <div className="profile-info-content">
        <span className="profile-info-label">День рождения</span>
        <span className="profile-info-value">{value}</span>
        {isToday && <span className="profile-birthday-today">Сегодня день рождения</span>}
      </div>
    </div>
  );
}
