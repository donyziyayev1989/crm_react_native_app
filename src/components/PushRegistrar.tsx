import { listenForTaps, registerForPush } from "@/services/notifications";
import { onAuthStateChanged } from "@/supabase/auth";
import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Kirgan xodim qurilmasini push uchun ro'yxatdan o'tkazadi va bildirishnoma bosilishini lead ekraniga yo'naltiradi. */
export default function PushRegistrar() {
  const router = useRouter();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged((user) => {
      if (user) registerForPush();
    });
    const unsubTaps = listenForTaps((route) => router.push(route as any));
    return () => {
      unsubAuth();
      unsubTaps();
    };
  }, [router]);

  return null;
}
