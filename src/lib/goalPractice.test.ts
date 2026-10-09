import { describe, expect, it } from "vitest";

import { goalRolePlay } from "./goalPractice";

describe("goalRolePlay", () => {
  it("gives EVO the goal and today's step and keeps the opener in English", () => {
    const play = goalRolePlay({
      id: "g1",
      title: "Conquistar meus primeiros clientes",
      step: 'Mande uma mensagem "curta" para três contatos',
    });
    expect(play.id).toBe("goal-g1");
    expect(play.scenario).toBe("professional");
    expect(play.role).toContain("Conquistar meus primeiros clientes");
    expect(play.role).toContain("Mande uma mensagem 'curta' para três contatos");
    expect(play.opener).not.toContain("Conquistar");
  });

  it("uses everyday English for personal goals and caps long texts", () => {
    const play = goalRolePlay({
      id: "g2",
      title: "Walk 3 times a week " + "x".repeat(400),
      step: null,
    });
    expect(play.scenario).toBe("everyday");
    expect(play.role).not.toContain("Today's small step");
    expect(play.role.length).toBeLessThan(1200);
  });
});
