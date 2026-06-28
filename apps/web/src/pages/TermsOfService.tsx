import LegalDocumentPage from "./LegalDocumentPage";
import { termsOfServiceRu } from "../content/legal/termsOfService.ru";

export default function TermsOfServicePage() {
  return <LegalDocumentPage document={termsOfServiceRu} />;
}
