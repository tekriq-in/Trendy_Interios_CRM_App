import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '../src/store';

function needsPasswordChange(token: string): boolean {
  try {
    const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!encoded) return false;
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    return JSON.parse(atob(padded)).mustChangePassword === true;
  } catch {
    return false;
  }
}

export default function Index() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  if (!token) return <Redirect href="/login" />;
  return <Redirect href={needsPasswordChange(token) ? '/change-password' : '/(app)/projects'} />;
}
