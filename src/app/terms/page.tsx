import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { TERMS_EN, TERMS_FR } from "@/lib/legal/content";
import { LegalPage } from "@/components/LegalPage";

export default async function TermsPage() {
  const locale = await getServerLocale();
  const sections = locale === "fr" ? TERMS_FR : TERMS_EN;

  return (
    <LegalPage title={translate(locale, "terms.title")} sections={sections} />
  );
}
