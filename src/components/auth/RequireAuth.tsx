'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth-token';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getAccessToken();
    if (token) return;
    // Không cho vào /app/** nếu chưa đăng nhập.
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [router, pathname]);

  return children;
}

