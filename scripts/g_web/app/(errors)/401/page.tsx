import ollieblitzz from "../ollieblitzz.png";

/**
 * The route handler for 401 - forbidden.
 * This served from the proxy.
 */

import { AbstractErrorPageContent } from "../AbstractErrorPage";

export default function Page() {
    return (
        <AbstractErrorPageContent 
            code="401"
            text="You don't have permission to access this page."
            head={ollieblitzz}
        />
    );
}
