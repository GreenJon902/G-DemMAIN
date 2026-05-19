/**
 * A thread-safe cached object. So if someone tries to get the object while it is still generating, it won't start generating twice.
 */
export class CachedObject<T> {
    #value?: T;  // The actual cached object
    #promise: Promise<void> | null = null;  // The promise that is generating the object. This acts as the lock
    #loader: () => Promise<T>;  // The function that loads the object

    /**
     * @param loader - The function that creates the object. Note this should not return undefined.
     */
    constructor(loader: () => Promise<T>) {
        this.#loader = loader;
    }

    /**
     * Gets the object if it is cached, else loads it.
     * @param [reload=false] - Should we reload the value regardless of whether it has been cached. If we are in the middle of loading an object then normal behavior is followed.
     */
    async get(reload: boolean=false): Promise<T> {
        // If we are currently loading an object then wait for that
        if (this.#promise !== null) {
            await this.#promise;
            if (this.#value === undefined) throw "Value still null after promise completed!";
            return this.#value;
        }
        // If we have already loaded the object then return that
        if (this.#value !== undefined && !reload) return this.#value;

        // The object has not been loaded, and is not currently being loaded
        this.#promise = (async () => {
            try {
                // Invalidate the last object, then load the new one
                this.#value = undefined;
                this.#value = await this.#loader();
            } finally {
                this.#promise = null;
            }
        })();
        return await this.get();
    }
}
