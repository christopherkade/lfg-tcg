// Decorative card art for the /login page's illustration panel. Self-hosted
// (downloaded + resized to ~160px-wide thumbnails) rather than hotlinked, so
// the showcase doesn't depend on third-party API uptime/rate limits — see
// SPECS.md and the login redesign plan for sourcing details (Scryfall for
// MTG, pokemontcg.io for Pokémon, the community lorcana-api.com for Lorcana,
// and Bandai's official card-list site for One Piece).
export type ShowcaseGame = "mtg" | "pokemon" | "lorcana" | "onepiece";

interface ShowcaseCard {
  src: string;
  name: string;
}

export const CARD_SHOWCASE: Record<ShowcaseGame, ShowcaseCard[]> = {
  mtg: [
    { src: "/cards/mtg/1.jpg", name: "Baneslayer Angel" },
    { src: "/cards/mtg/2.jpg", name: "Counterspell" },
    { src: "/cards/mtg/3.jpg", name: "Elesh Norn, Grand Cenobite" },
    { src: "/cards/mtg/4.jpg", name: "Grave Titan" },
    { src: "/cards/mtg/5.jpg", name: "Jace, the Mind Sculptor" },
    { src: "/cards/mtg/6.jpg", name: "Krenko, Mob Boss" },
    { src: "/cards/mtg/7.jpg", name: "Lightning Bolt" },
    { src: "/cards/mtg/8.jpg", name: "Llanowar Elves" },
    { src: "/cards/mtg/9.jpg", name: "Serra Angel" },
    { src: "/cards/mtg/10.jpg", name: "Shivan Dragon" },
    { src: "/cards/mtg/11.jpg", name: "Tarmogoyf" },
  ],
  pokemon: [
    { src: "/cards/pokemon/1.jpg", name: "Charizard" },
    { src: "/cards/pokemon/2.jpg", name: "Mewtwo" },
    { src: "/cards/pokemon/3.jpg", name: "Greninja" },
    { src: "/cards/pokemon/4.jpg", name: "Gengar" },
    { src: "/cards/pokemon/5.jpg", name: "Eevee" },
    { src: "/cards/pokemon/6.jpg", name: "Umbreon" },
    { src: "/cards/pokemon/7.jpg", name: "Snorlax" },
    { src: "/cards/pokemon/8.jpg", name: "Gyarados" },
    { src: "/cards/pokemon/9.jpg", name: "Lucario V" },
    { src: "/cards/pokemon/10.jpg", name: "Mew" },
    { src: "/cards/pokemon/11.jpg", name: "Alakazam" },
  ],
  lorcana: [
    { src: "/cards/lorcana/1.jpg", name: "Cinderella - Gentle and Kind" },
    { src: "/cards/lorcana/2.jpg", name: "Stitch - Carefree Surfer" },
    { src: "/cards/lorcana/3.jpg", name: "Kuzco - Wanted Llama" },
    { src: "/cards/lorcana/4.jpg", name: "Ursula - Power Hungry" },
    { src: "/cards/lorcana/5.jpg", name: "Beast - Wolfsbane" },
    { src: "/cards/lorcana/6.jpg", name: "Captain Hook - Underhanded" },
    { src: "/cards/lorcana/7.jpg", name: "Mickey Mouse - Pirate Captain" },
    { src: "/cards/lorcana/8.jpg", name: "Moana - Chosen by the Ocean" },
    { src: "/cards/lorcana/9.jpg", name: "Ariel - Treasure Collector" },
    { src: "/cards/lorcana/10.jpg", name: "Judy Hopps - Lead Detective" },
    { src: "/cards/lorcana/11.jpg", name: "Scar - Finally King" },
  ],
  onepiece: [
    { src: "/cards/onepiece/1.jpg", name: "Monkey.D.Luffy" },
    { src: "/cards/onepiece/2.jpg", name: "Roronoa Zoro" },
    { src: "/cards/onepiece/3.jpg", name: "Donquixote Doflamingo" },
    { src: "/cards/onepiece/4.jpg", name: "Smoker" },
    { src: "/cards/onepiece/5.jpg", name: "Sanji" },
    { src: "/cards/onepiece/6.jpg", name: "Nami" },
    { src: "/cards/onepiece/7.jpg", name: "Shanks" },
    { src: "/cards/onepiece/8.jpg", name: "Yamato" },
    { src: "/cards/onepiece/9.jpg", name: "Boa Hancock" },
    { src: "/cards/onepiece/10.jpg", name: "Kaido" },
    { src: "/cards/onepiece/11.jpg", name: "Thousand Sunny" },
  ],
};
