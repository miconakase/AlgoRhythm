import { Head } from '@inertiajs/react';
import TopNav from '../Components/TopNav';

export default function Settings() {
    return (
        <>
            <Head title="Settings" />

            <div className="flex min-h-screen flex-col bg-[#0a0a0c]">
                <TopNav />

                <div className="flex flex-1 items-center justify-center">
                    <p className="font-mono text-lg text-white/40">Settings — coming soon</p>
                </div>
            </div>
        </>
    );
}
