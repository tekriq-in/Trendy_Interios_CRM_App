import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '../src/store';
import { decodeJwt } from '../src/utils/jwt';

export default function Index() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  if (!token) return <Redirect href="/login" />;
  // A user whose password was reset by an admin must set a new one before using the app.
  const mustChangePassword = decodeJwt(token)?.mustChangePassword === true;
  return <Redirect href={mustChangePassword ? '/change-password' : '/(app)/home'} />;
}
