import Link from 'next/link'

export default function Page() {
  return (
    <div className="p-5 bg-neutral-900">
        <h1 className="flex justify-center transition-transform duration-200 hover:scale-110">
            <span className="inline-flex flex-col">
                <span className="text-3xl font-extrabold bg-linear-80 from-green-700 to-green-400 bg-clip-text text-transparent align-top">G-Dem</span>
                <span className="h-[10px] w-full bg-gradient-to-r from-green-700 to-green-400 -mt-[4px]" />
            </span> 
            <span className="text-5xl font-black align-top bg-radial from-blue-600 to-blue-400 text-transparent bg-clip-text inline-block text-shadow-2xs">SMP</span>
            </h1>
        <div className="flex justify-center space-x-4 text-neutral-100">
            <a className="font-medium text-fg-brand underline decoration-dotted hover:decoration-solid" href="">Join Now!</a>
            <Link className="font-medium text-fg-brand underline decoration-dotted hover:decoration-solid" href="/rules">Rules</Link>
            <a className="font-medium text-fg-brand underline decoration-dotted hover:decoration-solid" href="">World Map</a>
            <Link className="font-medium text-fg-brand underline decoration-dotted hover:decoration-solid" href="/hisdoc">HisDoc</Link>
        </div>
    </div>
  );
}
