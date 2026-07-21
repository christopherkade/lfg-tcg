"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@mui/material";
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
      <Button
        onClick={handleDiscordLogin}
        variant="contained"
        startIcon={<MessageCircle className="h-5 w-5" />}
        sx={{
          px: 3,
          py: 1.5,
          bgcolor: "#5865F2",
          color: "#fff",
          "&:hover": { bgcolor: "#4752C4" },
        }}
      >
        Continue with Discord
      </Button>
    </div>
  );
}
