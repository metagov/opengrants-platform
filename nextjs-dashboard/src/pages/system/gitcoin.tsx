import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GitcoinRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/system/grantsstack');
  }, [router]);

  return null;
}
