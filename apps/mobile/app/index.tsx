import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '../src/store';

export default function Index() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  return <Redirect href={token ? '/(app)/home' : '/login'} />;
}
