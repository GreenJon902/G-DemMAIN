import Link from 'next/link';

export default function Page() {
    return (
        <div className="bg-neutral-900 p-5">
            <h1 className="flex justify-center transition-transform duration-200 hover:scale-110">
                <span className="inline-flex flex-col">
                    <span className="bg-linear-80 from-green-700 to-green-400 bg-clip-text align-top text-3xl font-extrabold text-transparent">G-Dem</span>
                    <span className="-mt-1 h-2.5 w-full bg-linear-to-r from-green-700 to-green-400" />
                </span> 
                <span className="inline-block bg-radial from-blue-600 to-blue-400 bg-clip-text align-top text-5xl font-black text-transparent text-shadow-2xs">SMP</span>
            </h1>
            <div className="flex justify-center space-x-4 text-neutral-100">
                <a className="font-medium underline decoration-dotted hover:decoration-solid" href="">Join Now!</a>
                <Link className="font-medium underline decoration-dotted hover:decoration-solid" href="/rules">Rules</Link>
                <a className="font-medium underline decoration-dotted hover:decoration-solid" href="">World Map</a>
                <Link className="font-medium underline decoration-dotted hover:decoration-solid" href="/hisdoc">HisDoc</Link>
            </div>
        </div>
    );
}
