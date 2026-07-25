import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { PRIVACY_EN, PRIVACY_FR } from "@/lib/legal/content";
import { LegalPage } from "@/components/LegalPage";

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  const sections = locale === "fr" ? PRIVACY_FR : PRIVACY_EN;

  return (
    <LegalPage title={translate(locale, "privacy.title")} sections={sections} />
  );
}
