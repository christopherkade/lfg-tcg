"use client";

import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleDiscordLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-zinc-50">ManaMatch</h1>
        <p className="text-zinc-400">
          Find your next game. Sign in to start matching.
        </p>
      </div>
      <button
        onClick={handleDiscordLogin}
        className="flex items-center gap-3 rounded-full bg-[#5865F2] px-6 py-3 font-medium text-white transition-colors hover:bg-[#4752C4]"
      >
        <MessageCircle className="h-5 w-5" />
        Continue with Discord
      </button>
    </div>
  );
}
