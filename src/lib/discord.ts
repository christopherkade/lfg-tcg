const DISCORD_APP_URI = "discord://discord.com/channels/@me";
const DISCORD_WEB_URL = "https://discord.com/channels/@me";

/**
 * Opens Discord's Friends/DMs screen, preferring the desktop/mobile app via
 * its custom URI scheme and falling back to the web client if the app isn't
 * installed (the app takes over navigation, so the fallback timer never
 * fires in that case).
 */
export function openDiscordAddFriend() {
  const fallback = window.setTimeout(() => {
    window.open(DISCORD_WEB_URL, "_blank");
  }, 1000);

  window.addEventListener(
    "blur",
    () => window.clearTimeout(fallback),
    { once: true },
  );

  window.location.href = DISCORD_APP_URI;
}
