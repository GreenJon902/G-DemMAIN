import Image from "next/image";
import TextLink, { TEXT_LINK_WHITE } from "./ui/TextLink";

export default function Page() {
    // TODO: This page is kinda bad, it could be fixed
    return (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
            <Image
                src="/home-image.png"
                alt=""
                fill
                preload={true}
                className="object-cover object-center"
                unoptimized={true}  // Otherwise it's sometimes blury
            />
            <div className="relative rounded-xl border-2 border-gray-500 bg-gray-700/80 p-4">
                <h1 className="flex justify-center transition-transform duration-200 hover:scale-110">
                    <span className="inline-flex flex-col">
                        <span className="bg-linear-80 from-green-700 to-green-400 bg-clip-text align-top text-3xl font-extrabold text-transparent">G-Dem</span>
                        <span className="-mt-1 h-2.5 w-full bg-linear-to-r from-green-700 to-green-400" />
                    </span>
                    <span className="inline-block bg-radial from-blue-600 to-blue-400 bg-clip-text align-top text-5xl font-black text-transparent text-shadow-2xs">SMP</span>
                </h1>
                <div className="mt-2 flex justify-center space-x-4 text-neutral-100">
                    <TextLink color={TEXT_LINK_WHITE} className="font-medium" href="/join">Join Now!</TextLink>
                    <TextLink color={TEXT_LINK_WHITE} className="font-medium" href="/rules">Rules</TextLink>
                    <TextLink color={TEXT_LINK_WHITE} className="font-medium" href="/map">World Map</TextLink>
                    <TextLink color={TEXT_LINK_WHITE} className="font-medium" href="/hisdoc">HisDoc</TextLink>
                </div>
            </div>
        </div>
    );
}
