import { describe, expect, test } from "bun:test";
import { isMessageReadByCursor } from "../../../web/src/utils/messageRead";

describe("isMessageReadByCursor", () => {
  const msgId = "00000000-0000-0000-0000-000000000010";
  const laterId = "00000000-0000-0000-0000-000000000020";
  const msgAt = "2026-06-21T10:00:00.000Z";

  test("cursor ahead of message counts as read without timestamps", () => {
    expect(isMessageReadByCursor(msgId, laterId)).toBe(true);
  });

  test("cursor behind message is unread", () => {
    expect(isMessageReadByCursor(laterId, msgId)).toBe(false);
  });

  test("exact cursor without timestamps counts as read", () => {
    expect(isMessageReadByCursor(msgId, msgId)).toBe(true);
  });

  test("exact cursor with stale timestamp is not read", () => {
    expect(
      isMessageReadByCursor(msgId, msgId, "2026-06-21T09:00:00.000Z", msgAt)
    ).toBe(false);
  });

  test("exact cursor updated after message is read", () => {
    expect(
      isMessageReadByCursor(msgId, msgId, "2026-06-21T10:00:01.000Z", msgAt)
    ).toBe(true);
  });

  test("cursor ahead ignores stale timestamp on exact check path", () => {
    expect(
      isMessageReadByCursor(msgId, laterId, "2026-06-21T09:00:00.000Z", msgAt)
    ).toBe(true);
  });
});
