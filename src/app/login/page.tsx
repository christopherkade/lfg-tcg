import { LoginView } from "./LoginView";
import {
  getPlatformActivityStats,
  getRecentPlatformActivity,
} from "@/app/actions/platformActivity";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  // Fetched server-side (anon role, no session on this page) so the
  // activity ticker paints instantly instead of flashing in client-side.
  const [initialStats, initialEvents] = await Promise.all([
    getPlatformActivityStats(),
    getRecentPlatformActivity(),
  ]);

  return (
    <LoginView
      next={next}
      initialStats={initialStats}
      initialEvents={initialEvents}
    />
  );
}
