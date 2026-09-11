import type { Metadata } from "next";
import PageSection from "@/app/ui/PageSection";
import RuleSection from "./ui/RuleSection";

export const metadata: Metadata = {
    title: "Rules",
    description: "Rules for the G-Dem SMP. Pls obey these. Thanks <3.",
    robots: {
        // Indexing is opt-in (see root layout)
        index: true
    }
};

export default function Page() {
    return (
        <main className="p-4">
            <PageSection title="Rules">
                <div className="flex flex-col gap-2">
                    <RuleSection index={1} title="Stealing">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>No stealing unless the items in question have lore tags (except g-coin), have impossible enchantments, or are dropped heads from someone who&apos;s just died.</li>
                            <li>Items in shops or trades cannot be stolen.</li>
                            <li>Items destroyed, eaten, or consumed by their rightful owner do not require replacement. However, if a player is AFK or at an end farm, any lost items must be replaced.</li>
                            <li>Services in spawn zones (like shops or museums) are able to enforce entrance fees or conditions.</li>
                            <li>Trading with other people&apos;s villagers or using their farms also counts as stealing!</li>
                        </ul>
                    </RuleSection>

                    <RuleSection index={2} title="Griefing">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>You may not grief someone&apos;s build. Any modifications must be fixed within a timely manner.</li>
                            <li>However, pranks are allowed, given you fix it if asked.</li>
                            <li>Dynmaps can show the locations of people&apos;s bases. The base rings cannot be built inside of.</li>
                        </ul>
                    </RuleSection>

                    <RuleSection index={3} title="Farms">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Don&apos;t use other peoples&apos; farms without permission.</li>
                            <li>Killing animals in a farm is considered griefing.</li>
                            <li>Raid farms, warden farms, and global mob-switches are not allowed (local ones are fine though).</li>
                        </ul>
                    </RuleSection>

                    <RuleSection index={4} title="Spawn">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Builds at spawn will not own land around them unless marked or clearly decorated.</li>
                            <li>Unfinished builds may be given to other players after a long period of inactivity.</li>
                            <li>Spawn beacons need a 3x3 hole every 100 blocks; take this into account.</li>
                        </ul>
                    </RuleSection>

                    <RuleSection index={5} title="Contracts">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Agreements are binding until the conditions are met. To be valid, both parties must acknowledge and screenshot the in-game chat messages.</li>
                            <li>If no conditions are given, it expires after one month.</li>
                        </ul>
                    </RuleSection>

                    <RuleSection index={6} title="Modifications & Game Exploits">
                        <p>Here is a list of examples of modifications and game exploits, this is not a complete list so if you are unsure, please message an owner.</p>

                        <p className="font-bold underline">Modification Examples (Not Exhaustive):</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>
                                <span className="font-bold">Not Allowed:</span><br/>
                                Xray, Killaura, Potion effect dampeners / removers, Lava fog modifiers.
                            </li>
                            <li>
                                <span className="font-bold">Allowed:</span><br/>
                                Hotkeys, Sodium, Optifine, Freelook, Waypoints, Replay Mod (for recording, not base finding), Chestplate and Elytra switcher, Litematica (Not easy place mode), World Maps (unless they have an entity or cave map).
                            </li>
                        </ul>

                        <p>
                            <span className="font-bold underline">Allowed Game Exploits:</span><br/>
                            Bedrock breaking (and its derivatives, (but no griefing)), TNT duplicating.
                        </p>

                        <p>Mob switches (and warden farms) are not allowed.</p>
                        <p>Chunk loaders are allowed when required for a farm, and your account needed for a different part of that same farm.</p>
                    </RuleSection>

                    <RuleSection index={7} title="Seed">
                        <p>The seed is 8433187205649952434.</p>
                        <p>Do not use the seed for X-ray purposes or locating other poeple&apos;s bases.</p>
                    </RuleSection>

                    <RuleSection index={8} title="Miscellaneous">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>No loopholes,</li>
                            <li>No nuisance,</li>
                            <li>No nonsense (lying to staff about staff matters).</li>
                            <br />
                            <li>Pet can be killed, given it does not break a farm rule.</li>
                            <li>You may not assist someone in their punishment.</li>
                            <li>Talk to a GT Legal Services about getting name prefixes and joining teams.</li>
                            <li>No placing homes at other people&apos;s bases (without permission).</li>
                            <li>No putting spawn eggs in spawners.</li>
                        </ul>
                    </RuleSection>
                </div>
            </PageSection>
        </main>
    );
}
