import { redirect } from "next/navigation";

/**
 * Redirect the user to the login page, that will - if given - redirect to the given page after login.
 * @param next - The optional page to go to after.
 */
export function redirectLogin(next?: string) {
    redirect(loginUrl(next).toString());
}

/**
 * Returns a url to the login page, that will - if given - redirect to the given page after login.
 * @param next - The optional page to go to after.
 */
export function loginUrl(next?: string | undefined) {
    const query = [];
    if (next) query.push(`next=${next}`);

    if (query.length > 0) {
        return `/login?${query.join("&")}`;
    } else {
        return "/login";
    }
}
