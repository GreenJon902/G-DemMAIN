import icon from "@/public/favicon.png";
import { NS } from "@/lib/auth";
import { UserCircleIcon as UserCircleIconOutline } from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";

/**
 * The nav bar that should be shown at the top of any page.
 * This is NOT wrapped in <header> or <nav> or any other tag.
 */
export default async function GlobalNav() {
    return (
        <>
            <div className="flex flex-row flex-wrap bg-gray-700 p-1">
                <Link href="/" className="size-6">
                    <Image
                        src={icon}
                        className="size-full rounded-md hover:opacity-50"
                        alt={"Logo"}
                    />
                </Link>
                <Link href="/rules" className="ml-1 border-x border-gray-500 px-1 hover:bg-gray-600">
                    Rules
                </Link>
                <Link href="/hisDoc" className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    HisDoc
                </Link>
                <Link href="/map" className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    Dynmap
                </Link>
                <Link href="/panel" className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    Panel
                </Link>
                <div className="flex-1">
                    <div className="relative float-right size-6 text-white hover:text-gray-400">
                        {  
                            (await NS.hasSession()) ? (
                                <Link href="/account" >
                                    <UserCircleIconSolid className="size-full" />
                                </Link>
                            ) : (
                                <Link href="/login?next=account" >
                                    <UserCircleIconOutline className="size-full stroke-1" />
                                </Link>
                            )
                        }
                    </div>
                </div>
            </div>
        </>
    );

}
