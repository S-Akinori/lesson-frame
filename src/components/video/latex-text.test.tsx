// @vitest-environment jsdom

import {render} from "@testing-library/react";
import {describe, expect, it} from "vitest";
import {LatexText} from "./latex-text";

describe("LatexText", () => {
  it("preserves line breaks in plain text", () => {
    const {container} = render(<LatexText text={"一行目\n二行目\n\n四行目"} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.whiteSpace).toBe("pre-wrap");
    expect(root.textContent).toBe("一行目\n二行目\n\n四行目");
  });

  it("preserves line breaks around inline LaTeX", () => {
    const {container} = render(<LatexText text={"状態方程式\n$PV=nRT$\nを使います。"} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.whiteSpace).toBe("pre-wrap");
    expect(root.textContent).toContain("状態方程式\n");
    expect(root.textContent).toContain("\nを使います。");
    expect(root.querySelector(".math-inline")).not.toBeNull();
  });
});
