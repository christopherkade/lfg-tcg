/**
 * Placeholder Terms of Service / Privacy Policy copy, in English and
 * French. This is long-form prose rather than UI microcopy, so it
 * deliberately lives here instead of the flat translate()/t() dictionaries
 * (src/lib/i18n/dictionaries/*.json) — those are keyed for short strings,
 * not paragraphs. Draft content only: replace with reviewed legal text
 * before a real public launch.
 */

export interface LegalSection {
  heading: string;
  body: string;
}

export const TERMS_EN: LegalSection[] = [
  {
    heading: "1. Acceptance of these Terms",
    body: "By creating an account or otherwise using PodFinder (the \"Service\"), you agree to these Terms of Service. If you don't agree, please don't use the Service.",
  },
  {
    heading: "2. What PodFinder does",
    body: "PodFinder helps trading-card-game players find others to play with, in person or online. You sign in with your Discord account, set up a profile, and start or browse \"pods\" (open groups looking to play). When a host accepts you into their pod, your Discord handle and username become visible to the other members of that pod so you can coordinate outside the app — PodFinder itself does not create Discord servers, group chats, or friend connections on your behalf.",
  },
  {
    heading: "3. Your account",
    body: "You're responsible for the accuracy of the profile information you provide (username, Discord handle, city, and search preferences) and for anything that happens through your account. Don't impersonate someone else or share your account with others.",
  },
  {
    heading: "4. Acceptable use",
    body: "Don't use PodFinder to harass, threaten, or abuse other users; to post spam or misleading pods; to attempt to bypass rate limits or other safeguards; or to violate any applicable law. We may remove content, suspend, or terminate accounts that violate these rules.",
  },
  {
    heading: "5. Rate limits and automated safeguards",
    body: "To keep the match feed useful and prevent spam, PodFinder limits how quickly you can create new pods or send join requests. These limits may change over time without notice.",
  },
  {
    heading: "6. Discord is a separate service",
    body: "Any coordination that happens on Discord after you're matched is governed by Discord's own terms and policies, not this document. PodFinder isn't responsible for what happens in conversations or games arranged there.",
  },
  {
    heading: "7. No warranty",
    body: "The Service is provided \"as is,\" without warranties of any kind. We don't guarantee that pods will lead to a game, that other users will behave appropriately, or that the Service will be uninterrupted or error-free.",
  },
  {
    heading: "8. Account deletion",
    body: "You can permanently delete your account at any time from the Profile screen. This removes your profile, active/past pods you hosted, and your join history. See the Privacy Policy for what happens to information other users retain about pods you were part of.",
  },
  {
    heading: "9. Changes to these Terms",
    body: "We may update these Terms from time to time. Continuing to use the Service after a change means you accept the updated Terms.",
  },
  {
    heading: "10. Contact",
    body: "Questions about these Terms? Reach out to the app's maintainer through the contact channel listed on your account or the project's repository.",
  },
];

export const PRIVACY_EN: LegalSection[] = [
  {
    heading: "1. What we collect",
    body: "When you sign in with Discord, we receive your Discord user id, username, and avatar. On the Profile screen, you additionally provide a display username, your Discord handle, and (optionally) a city. When you search for or host a pod, we store your chosen game, format, playstyle, power brackets (if applicable), match type, location name, schedule, and any notes you add.",
  },
  {
    heading: "2. How your information is shared with other users",
    body: "Your username, Discord handle, and avatar are visible to hosts and searchers as part of the normal matching flow: a host sees this information for anyone who requests to join their pod, and once accepted, every member of a pod sees it for every other member. This is the core purpose of the Service — matching you with people you can then reach on Discord — so this sharing can't be turned off while using PodFinder.",
  },
  {
    heading: "3. Pod history",
    body: "When a pod you're part of is marked as matched, a permanent record (game, format, date, and the roster of members at that time) is kept so you and the other members can look back on past games. You can remove an entry from your own \"Past Pods\" list at any time; this hides it from your view without erasing it for the other members it's shared with.",
  },
  {
    heading: "4. Cookies",
    body: "PodFinder uses two small, non-tracking cookies to remember your display preferences: one for your chosen language (English/French) and one for light/dark theme. Neither is used for advertising or analytics.",
  },
  {
    heading: "5. Where your data lives",
    body: "Your data is stored in a Supabase (PostgreSQL) database. Access is restricted by row-level security policies so that, in general, you can only read and write your own data plus what's needed to run the matching features described above.",
  },
  {
    heading: "6. Your rights",
    body: "You can update your profile information at any time from the Profile screen. You can permanently delete your account and its associated data (subject to the pod-history note above) from the same screen — this is irreversible.",
  },
  {
    heading: "7. Retention",
    body: "We keep your data for as long as your account exists. Expired or matched pods are automatically cleaned up on a schedule, independent of whether you delete your account.",
  },
  {
    heading: "8. Changes to this Policy",
    body: "We may update this Privacy Policy from time to time. Continuing to use the Service after a change means you accept the updated Policy.",
  },
  {
    heading: "9. Contact",
    body: "Questions about this Policy or your data? Reach out through the contact channel listed on your account or the project's repository.",
  },
];

export const TERMS_FR: LegalSection[] = [
  {
    heading: "1. Acceptation des présentes conditions",
    body: "En créant un compte ou en utilisant PodFinder (le « Service »), vous acceptez les présentes Conditions d'utilisation. Si vous n'êtes pas d'accord, merci de ne pas utiliser le Service.",
  },
  {
    heading: "2. Ce que fait PodFinder",
    body: "PodFinder aide les joueurs de jeux de cartes à trouver d'autres joueurs, en personne ou en ligne. Vous vous connectez avec votre compte Discord, configurez un profil, puis créez ou parcourez des « tables » (groupes ouverts cherchant à jouer). Lorsqu'un hôte accepte votre demande, votre identifiant Discord et votre pseudo deviennent visibles par les autres membres de cette table afin que vous puissiez vous organiser en dehors de l'application — PodFinder ne crée pas de serveur Discord, de discussion de groupe ni de relation d'amis en votre nom.",
  },
  {
    heading: "3. Votre compte",
    body: "Vous êtes responsable de l'exactitude des informations de votre profil (pseudo, identifiant Discord, ville et préférences de recherche) et de tout ce qui se passe via votre compte. N'usurpez pas l'identité d'une autre personne et ne partagez pas votre compte.",
  },
  {
    heading: "4. Utilisation acceptable",
    body: "N'utilisez pas PodFinder pour harceler, menacer ou insulter d'autres utilisateurs, publier des tables trompeuses ou du spam, tenter de contourner les limites de fréquence ou d'autres protections, ou enfreindre une loi applicable. Nous pouvons retirer du contenu, suspendre ou résilier les comptes qui enfreignent ces règles.",
  },
  {
    heading: "5. Limites de fréquence et protections automatiques",
    body: "Afin de garder le fil de recherche utile et d'éviter le spam, PodFinder limite la fréquence à laquelle vous pouvez créer de nouvelles tables ou envoyer des demandes pour rejoindre un groupe. Ces limites peuvent évoluer sans préavis.",
  },
  {
    heading: "6. Discord est un service distinct",
    body: "Toute coordination ayant lieu sur Discord après une mise en relation est régie par les conditions et politiques propres à Discord, et non par le présent document. PodFinder n'est pas responsable de ce qui se passe dans les conversations ou parties organisées à cet endroit.",
  },
  {
    heading: "7. Absence de garantie",
    body: "Le Service est fourni « tel quel », sans garantie d'aucune sorte. Nous ne garantissons pas qu'une table aboutira à une partie, que les autres utilisateurs se comporteront correctement, ni que le Service sera ininterrompu ou exempt d'erreurs.",
  },
  {
    heading: "8. Suppression de compte",
    body: "Vous pouvez supprimer définitivement votre compte à tout moment depuis l'écran Profil. Cela supprime votre profil, les tables actives ou passées que vous avez créées, ainsi que votre historique de participation. Consultez la Politique de confidentialité pour savoir ce qu'il advient des informations conservées par d'autres utilisateurs concernant des tables auxquelles vous avez participé.",
  },
  {
    heading: "9. Modifications des présentes conditions",
    body: "Nous pouvons mettre à jour ces Conditions de temps à autre. Continuer à utiliser le Service après une modification signifie que vous acceptez les nouvelles Conditions.",
  },
  {
    heading: "10. Contact",
    body: "Des questions sur ces Conditions ? Contactez le mainteneur de l'application via le canal indiqué sur votre compte ou le dépôt du projet.",
  },
];

export const PRIVACY_FR: LegalSection[] = [
  {
    heading: "1. Ce que nous collectons",
    body: "Lorsque vous vous connectez avec Discord, nous recevons votre identifiant Discord, votre nom d'utilisateur et votre avatar. Sur l'écran Profil, vous fournissez en plus un pseudo d'affichage, votre identifiant Discord, et éventuellement une ville. Lorsque vous recherchez ou créez une table, nous enregistrons le jeu choisi, le format, le style de jeu, les paliers de puissance (le cas échéant), le type de partie, le lieu, l'horaire et les notes que vous ajoutez.",
  },
  {
    heading: "2. Comment vos informations sont partagées avec les autres utilisateurs",
    body: "Votre pseudo, votre identifiant Discord et votre avatar sont visibles par les hôtes et les chercheurs de table dans le cadre normal de la mise en relation : un hôte voit ces informations pour toute personne demandant à rejoindre sa table, et une fois acceptés, tous les membres d'une table se voient mutuellement. C'est l'objectif central du Service — vous mettre en relation avec des personnes que vous pourrez ensuite contacter sur Discord — ce partage ne peut donc pas être désactivé tout en utilisant PodFinder.",
  },
  {
    heading: "3. Historique des tables",
    body: "Lorsqu'une table à laquelle vous participez est marquée comme complète, un enregistrement permanent (jeu, format, date et liste des membres à ce moment-là) est conservé afin que vous et les autres membres puissiez consulter vos parties passées. Vous pouvez retirer une entrée de votre propre liste « Tables passées » à tout moment ; cela la masque de votre vue sans l'effacer pour les autres membres avec qui elle est partagée.",
  },
  {
    heading: "4. Cookies",
    body: "PodFinder utilise deux petits cookies non traceurs pour mémoriser vos préférences d'affichage : un pour la langue choisie (français/anglais) et un pour le thème clair/sombre. Aucun n'est utilisé à des fins publicitaires ou d'analyse.",
  },
  {
    heading: "5. Où se trouvent vos données",
    body: "Vos données sont stockées dans une base de données Supabase (PostgreSQL). L'accès est limité par des politiques de sécurité au niveau des lignes, de sorte que, en général, vous ne pouvez lire et modifier que vos propres données ainsi que ce qui est nécessaire au fonctionnement des fonctionnalités de mise en relation décrites ci-dessus.",
  },
  {
    heading: "6. Vos droits",
    body: "Vous pouvez mettre à jour les informations de votre profil à tout moment depuis l'écran Profil. Vous pouvez supprimer définitivement votre compte et les données associées (sous réserve de la remarque sur l'historique des tables ci-dessus) depuis le même écran — cette action est irréversible.",
  },
  {
    heading: "7. Conservation",
    body: "Nous conservons vos données tant que votre compte existe. Les tables expirées ou complètes sont automatiquement nettoyées selon un calendrier, indépendamment de la suppression de votre compte.",
  },
  {
    heading: "8. Modifications de cette politique",
    body: "Nous pouvons mettre à jour cette Politique de confidentialité de temps à autre. Continuer à utiliser le Service après une modification signifie que vous acceptez la nouvelle Politique.",
  },
  {
    heading: "9. Contact",
    body: "Des questions sur cette Politique ou vos données ? Contactez-nous via le canal indiqué sur votre compte ou le dépôt du projet.",
  },
];
