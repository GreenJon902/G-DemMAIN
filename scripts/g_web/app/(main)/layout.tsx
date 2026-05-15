import "@/app/globals.css";
import icon from "@/app/icon.png";
import { hasSession } from "@/lib/auth";
import { UserCircleIcon as UserCircleIconOutline } from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";

export default async function Layout({
    children
}: {
    children: React.ReactNode,
}) {
    return (
        <html>
            <head>
                <link rel="icon" type="image/png" href={"icon.png"} />
            </head>
            <body className="bg-gray-900 text-white">
                <header><nav>
                    <div className="flex flex-row bg-gray-700 p-1 flex-wrap">
                        <Link href="/" className="size-6">
                            <Image
                                src={icon}
                                className="size-full rounded-md hover:opacity-50"
                                alt={"Logo"}
                            />
                        </Link>
                        <Link href="/rules" className="ml-1 px-1 border-x border-gray-500 hover:bg-gray-600">
                            Rules
                        </Link>
                        <Link href="/hisDoc" className="px-1 border-r border-gray-500 hover:bg-gray-600">
                            HisDoc
                        </Link>
                        <Link href="/map" className="px-1 border-r border-gray-500 hover:bg-gray-600">
                            Dynmap
                        </Link>
                        <Link href="/panel" className="px-1 border-r border-gray-500 hover:bg-gray-600">
                            Panel
                        </Link>
                        <div className="flex-1">
                            <div className="size-6 relative float-right text-white hover:text-gray-400">
                                {  
                                    (await hasSession()) ? (
                                        <Link href="account" >
                                            <UserCircleIconSolid className="size-full" />
                                        </Link>
                                    ) : (
                                        <Link href="login?next=account" >
                                            <UserCircleIconOutline className="size-full stroke-1" />
                                        </Link>
                                    )
                                }
                            </div>
                        </div>
                    </div>
                </nav></header>
                {children}
            </body>
        </html>
    );
}
