export default function NotFound() {
    return (
        <div style={{
            // Draw missing-missing texture pattern in bg
            backgroundImage: "repeating-conic-gradient(black 0 25%, #ff00f6 0 50%)",
            backgroundSize: "3rem 3rem"
        }} className="flex h-dvh items-center justify-center">
            <div className="flex h-min w-min flex-col items-center space-y-1 rounded-md bg-gray-800 p-2 shadow-[0_0_10rem_8rem_rgba(0,0,0,0.7)]">
                <img src="https://api.mcheads.org/head/Omegadestroy400/256/hat" className="relative h-24 w-full rounded-t-xl" />  { /* This image is intentionally stretched. It helps fill the space, and it looks even more goofy */ }
                <span className="flex items-center text-nowrap text-gray-200"> 
                    <span className="mr-2 border-r-2 border-r-gray-700 pr-2 text-4xl font-bold">
                        404
                    </span>
                    This page could not be found.
                </span>
            </div>
        </div>
    );
}
