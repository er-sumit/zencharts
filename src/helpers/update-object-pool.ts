/**
 * Helper to update an existing object in an array pool or push a new one if we exceed capacity.
 *
 * @param pool - The array of objects acting as the pool.
 * @param targetIndex - The current index in the pool to update or insert.
 * @param createFn - Function to create a new object when capacity is exceeded.
 * @param updateFn - Function to update an existing object.
 * @param value - The value containing properties to update or create with.
 */
export function updateObjectPool<T, U>(
	pool: T[],
	targetIndex: number,
	createFn: (value: U) => T,
	updateFn: (item: T, value: U) => void,
	value: U
): void {
	if (targetIndex < pool.length) {
		updateFn(pool[targetIndex], value);
	} else {
		pool.push(createFn(value));
	}
}
