'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getUserProfile,
  type UserProfile,
} from '@/lib/user-profile';

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
  });

  const refresh = useCallback(() => {
    setProfile(getUserProfile());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('storage', onChange);
    window.addEventListener('enflow-profile-changed', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('enflow-profile-changed', onChange);
    };
  }, [refresh]);

  return { profile, refresh };
}
