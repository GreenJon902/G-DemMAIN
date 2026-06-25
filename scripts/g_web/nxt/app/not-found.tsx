import AbstractErrorPage from "./ui/AbstractErrorPage";

export default function NotFound() {
    return (
        <AbstractErrorPage
            code="404"
            head="/omegadestroy400.png"
        >
            This page could not be found.
        </AbstractErrorPage>
    );
}
