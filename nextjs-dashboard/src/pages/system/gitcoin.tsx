import { useRouter } from 'next/router';
import { NextPage } from 'next';

const SystemPage: NextPage = () => {
    const router = useRouter();

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">GITCOIN</h1>
        </div>
    );
};

export default SystemPage;