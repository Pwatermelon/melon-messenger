import LegalDocumentPage from "./LegalDocumentPage";
import { personalDataConsentRu } from "../content/legal/personalDataConsent.ru";

export default function PersonalDataConsentPage() {
  return <LegalDocumentPage document={personalDataConsentRu} />;
}
