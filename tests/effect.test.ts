import { range } from "effect/Array";
import { describe, expect, it } from "vitest";



describe("test effect range", () => {
    it("開始大於起始只會回傳一個元素", () => {
        const result = range(5, 3);
        expect(result).toEqual([5]);
    });

    it("start 等於 end 會回傳一個元素", () => {
        const result = range(5, 5);
        expect(result).toEqual([5]);
    })
})