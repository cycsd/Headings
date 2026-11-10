import { describe, expect, it } from "vitest";


describe('javascript test', () => {
    it('splice insert to end', () => {
        const arr = [0,1, 2, 3, 4, 5];
        arr.splice(arr.length, 0, 6);
        expect(arr).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('splice start max than length is safe', () => {
        const arr = [0,1, 2, 3, 4, 5];
        arr.splice(10, 0, 6);
        expect(arr).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});