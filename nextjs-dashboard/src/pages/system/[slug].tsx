import { useRouter } from 'next/router';
import { NextPage } from 'next';

const SystemPage: NextPage = () => {
    const router = useRouter();
    const { slug } = router.query;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Grant System Page</h1>
            <p>Current slug: {slug}</p>
        </div>
    );
};

export default SystemPage;