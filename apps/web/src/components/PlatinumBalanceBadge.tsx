type Props = {
  balance: number;
  className?: string;
};

export default function PlatinumBalanceBadge({ balance, className }: Props) {
  return (
    <div
      className={`settings-platinum-balance${className ? ` ${className}` : ""}`}
      title="Platinum за поддержку проекта"
    >
      <span className="settings-platinum-star" aria-hidden>
        ✦
      </span>
      <span className="settings-platinum-amount">{balance}</span>
    </div>
  );
}
