import Link from "next/link";
import TextLink, { TEXT_LINK_WHITE } from "./ui/TextLink";
import AccountButton from "./AccountButton";

/**
 * The nav bar that should be shown at the top of any page.
 * This is NOT wrapped in <header> or <nav> or any other tag.
 */
export default function GlobalNav() {
    return (
        <>
            <div className="flex flex-row flex-wrap bg-gray-700 p-1">
                <Link href="/" className="size-6">
                    <img
                        src="/icon.png"
                        className="size-full hover:opacity-50"
                        alt={"Logo"}
                    />
                </Link>
                <TextLink href="/rules" color={TEXT_LINK_WHITE} constantColor className="ml-1 border-x border-gray-500 px-1 hover:bg-gray-600">
                    Rules
                </TextLink>
                <TextLink href="/hisdoc" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    HisDoc
                </TextLink>
                <TextLink href="/map" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600">
                    Dynmap
                </TextLink>
                <TextLink href="/panel" color={TEXT_LINK_WHITE} constantColor className="border-r border-gray-500 px-1 hover:bg-gray-600" disabled={{ area: "panel", minLevel: "viewer" }}>
                    Panel
                </TextLink>
                <div className="flex-1">
                    <AccountButton />
                </div>
            </div>
        </>
    );
}
