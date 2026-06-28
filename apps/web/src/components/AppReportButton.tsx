import { useState } from "react";
import ReportModal from "./ReportModal";

export default function AppReportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="app-report-fab"
        onClick={() => setOpen(true)}
        aria-label="Сообщить о проблеме"
        title="Сообщить о проблеме"
      >
        !
      </button>
      <ReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
