import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const discordHandle =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          (user.user_metadata?.preferred_username as string | undefined) ??
          "";
        const avatarUrl =
          (user.user_metadata?.avatar_url as string | undefined) ?? null;

        if (discordHandle) {
          // Only updates an existing profile row — onboarding (upsertProfile)
          // is what creates the row for first-time users. This keeps an
          // already-onboarded user's Discord identity fresh on every login
          // without requiring them to revisit /profile.
          await supabase
            .from("profiles")
            .update({ discord_handle: discordHandle, avatar_url: avatarUrl })
            .eq("id", user.id);
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
