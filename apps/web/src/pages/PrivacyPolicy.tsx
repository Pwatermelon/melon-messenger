import LegalDocumentPage from "./LegalDocumentPage";
import { privacyPolicyRu } from "../content/legal/privacyPolicy.ru";

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage document={privacyPolicyRu} />;
}
