import { describe, expect, test } from "bun:test";
import {
  createCommentBody,
  createStickyCommentHeader,
} from "../src/github/operations/comments/common";

describe("Sticky Comment Header Logic", () => {
  test("createStickyCommentHeader generates correct format", () => {
    const header = createStickyCommentHeader("claude-security");
    expect(header).toBe("<!-- bot: claude-security -->");
  });

  test("generates hidden header when botName is provided", () => {
    const body = createCommentBody("http://example.com", "", "claude-security");
    expect(body).toContain("<!-- bot: claude-security -->");
    expect(body).toContain("Claude Code is working");
  });

  test("does not generate header when botName is missing", () => {
    const body = createCommentBody("http://example.com");
    expect(body).not.toContain("<!-- bot:");
    expect(body).toContain("Claude Code is working");
  });

  test("does not generate header when botName is empty string", () => {
    const body = createCommentBody("http://example.com", "", "");
    expect(body).not.toContain("<!-- bot:");
    expect(body).toContain("Claude Code is working");
  });

  test("generates distinct bodies for different bot names", () => {
    const body1 = createCommentBody("link", "", "bot1");
    const body2 = createCommentBody("link", "", "bot2");
    expect(body1).not.toEqual(body2);
    expect(body1).toContain("<!-- bot: bot1 -->");
    expect(body2).toContain("<!-- bot: bot2 -->");
  });

  test("header appears at the very start of the comment body", () => {
    const body = createCommentBody("http://example.com", "", "my-bot");
    expect(body.startsWith("<!-- bot: my-bot -->")).toBe(true);
  });

  test("includes branch link when provided", () => {
    const body = createCommentBody(
      "http://example.com",
      "\n[View branch](http://branch.url)",
      "claude-review",
    );
    expect(body).toContain("<!-- bot: claude-review -->");
    expect(body).toContain("[View branch](http://branch.url)");
  });
});
