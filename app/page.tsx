import { redirect } from 'next/navigation';

import { isMock } from '@/src/framework/helpers/environment';

const HomePage = () => redirect(isMock() ? '/dashboard' : '/login');

export default HomePage;
