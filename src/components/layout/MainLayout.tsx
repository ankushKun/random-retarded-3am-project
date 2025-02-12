import { ReactNode } from 'react';
import Navigation from './Navigation';
import { useAuth } from '@/hooks/useAuth';

interface MainLayoutProps {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className={`${user ? 'pt-16 pb-16' : ''}`}>{children}</main>
        </div>
    );
} 