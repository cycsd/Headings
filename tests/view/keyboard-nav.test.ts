import { describe, expect, it } from "vitest";
import type { TreeNode } from "../../src/core/tree";
import { navigate } from "../../src/view/keyboard-nav";

const node = (id: string, children: TreeNode[] = []): TreeNode => ({
    id,
    kind: "heading",
    level: 1,
    title: id,
    range: { from: 0, to: 0 },
    sections: [],
    links: [],
    children,
});

// root
//   ├─ A ── A1
//   ├─ B
//   ├─ C ── C1
//   └─ D
const tree = (): TreeNode => node("root", [node("A", [node("A1")]), node("B"), node("C", [node("C1")]), node("D")]);
const none = new Set<string>();

describe("navigate: outline / tree-table", () => {
    it("上下照 DFS 順序，跳過收合的子樹", () => {
        expect(navigate(tree(), none, "outline", "A", "down")?.id).toBe("A1");
        expect(navigate(tree(), none, "outline", "A1", "down")?.id).toBe("B");
        expect(navigate(tree(), new Set(["A"]), "tree-table", "A", "down")?.id).toBe("B");
        expect(navigate(tree(), none, "outline", "root", "up")).toBeNull();
    });

    it("左到父節點、右到第一個子節點；收合或沒有子節點就不動", () => {
        expect(navigate(tree(), none, "outline", "A1", "left")?.id).toBe("A");
        expect(navigate(tree(), none, "outline", "C", "right")?.id).toBe("C1");
        expect(navigate(tree(), new Set(["C"]), "outline", "C", "right")).toBeNull();
        expect(navigate(tree(), none, "outline", "root", "left")).toBeNull();
    });
});

describe("navigate: mindmap", () => {
    // 四個子節點平衡分配：A、B 在右側，C、D 在左側
    it("根節點左右各到該側第一個子節點", () => {
        expect(navigate(tree(), none, "mindmap", "root", "right")?.id).toBe("A");
        expect(navigate(tree(), none, "mindmap", "root", "left")?.id).toBe("C");
        expect(navigate(tree(), none, "mindmap", "root", "down")).toBeNull();
    });

    it("上下只在同側兄弟間走", () => {
        expect(navigate(tree(), none, "mindmap", "A", "down")?.id).toBe("B");
        expect(navigate(tree(), none, "mindmap", "B", "down")).toBeNull();
        expect(navigate(tree(), none, "mindmap", "C", "down")?.id).toBe("D");
        expect(navigate(tree(), none, "mindmap", "C", "up")).toBeNull();
    });

    it("左右依側別：右側分支右是子、左是父；左側相反", () => {
        expect(navigate(tree(), none, "mindmap", "A", "right")?.id).toBe("A1");
        expect(navigate(tree(), none, "mindmap", "A", "left")?.id).toBe("root");
        expect(navigate(tree(), none, "mindmap", "C", "left")?.id).toBe("C1");
        expect(navigate(tree(), none, "mindmap", "C", "right")?.id).toBe("root");
        expect(navigate(tree(), none, "mindmap", "A1", "right")).toBeNull();
    });
});
