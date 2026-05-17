import { redirect } from "next/navigation";

/**
 * Redirect the user to the login page, and - if given - redirect to the given page after login.
 * @param next - The optional page to go to after.
 */
export function redirectLogin(next?: string) {
    if (next) {
        redirect(`/login?next=${next}`);
    } else {
        redirect(`/login`);
    }
}
