import { useEffect, useState, useRef} from "react";
import Image from "next/image";
import { Account } from "./page";

const MOJANG_PLAYER_API = "https://sessionserver.mojang.com/session/minecraft/profile/{}";
const MOJANG_SKIN_LOCATION = "https://sessionserver.mojang.com/session/minecraft/profile/{}";

/**
 * Minecraft player skins must be fetched using a two-step process.
 *  1. We query sessionserver.mojang.com/session/minecraft/profile/<uuid> - This gives us the url of the actual skin.
 *  2. We can then load the skin from the returned url of the form textures.minecraft.net/texture/<some-url>.
 */
export default function PlayerHead({ account }: { account: Account }) {
    const [imageUrl, setImageUrl] = useState(null);  // The url of the playerhead
    const containerRef = useRef(null);  // Referance to the container of the Image node
    const apiCallSent = useRef(false);  // Have we already queried the url of the playerhead through the api

    // When the image comes into view, we send the first api-request to find the url of the image
    useEffect(() => {
        const observer = new IntersectionObserver(async ([entry]) => {
            if (entry.isIntersecting && !apiCallSent.current) {  // If in view and we haven't already requested the url
                apiCallSent.current = true;  // Block future calls to the API as we're handling that now

                // Load url from api
                const res = await fetch(MOJANG_PLAYER_API.replace("{}", account.uuid));
                const b64data = (await res.json()).properties[0].value;  // The url is first encoded in base64
                const data = JSON.parse(Buffer.from(b64data, "base64").toString());  
                const url = data.textures.SKIN.url;
                console.debug("Pulled", url, "for", account);

                // Update image
                // TODO: Crop texture
                setImageUrl(url);
            }
        });

        // If containerRef exists then set up the observer
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        // Return clean-up functon - disconnect observer
        return () => observer.disconnect();
    });
    
    return ( 
        <div ref={containerRef}> 
            {imageUrl && (
                <Image src={imageUrl} alt="Player head for ${}" width={10} height={10} />
            )} 
        </div> 
    );
}
