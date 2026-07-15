import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const source = fs.readFileSync(new URL("../assets/refine-motion.js", import.meta.url), "utf8");
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="root">
    <section class="hero">
      <p class="date">7月15日 星期三</p>
      <h1>今天，冲了吗？</h1>
      <p class="subline">如实记录就好。</p>
      <div class="check-actions">
        <button class="answer no"><span class="answer-icon"></span><span><b>没冲</b><small>今天稳住了</small></span></button>
        <button class="answer yes"><span class="answer-icon"></span><span><b>冲了</b><small>记录，然后继续</small></span></button>
      </div>
    </section>
    <section class="stats"><article class="stat-card"><span>本月没冲</span><strong>12<small>天</small></strong></article></section>
    <section class="history">
      <div class="month-switcher"><button aria-label="上个月">‹</button><button aria-label="下个月">›</button></div>
      <div class="calendar-month"><button class="calendar-day">15</button></div>
    </section>
  </div>
</body></html>`, {
  url: "https://example.test/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});

const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.eval(source);
await new Promise((resolve) => window.setTimeout(resolve, 50));

const hero = window.document.querySelector(".hero");
const noButton = hero.querySelector(".answer.no");
assert.equal(hero.dataset.checkinState, "pending", "the undecided hero should remain visually neutral");

noButton.click();
const storedTimes = JSON.parse(window.localStorage.getItem("did-you-checkin-time-v1"));
assert.equal(Object.keys(storedTimes).length, 1, "a check-in should persist its receipt time");

hero.classList.add("completed", "no");
noButton.classList.add("selected");
await new Promise((resolve) => window.setTimeout(resolve, 50));
const receipt = noButton.querySelector(".checkin-receipt-meta");
assert.ok(receipt, "a completed check-in should become an editable receipt");
assert.match(receipt.querySelector("time").textContent, /^\d{2}:\d{2}$/);
assert.match(receipt.textContent, /修改记录/);

noButton.click();
assert.ok(hero.classList.contains("motion-editing"), "tapping the receipt should reveal both editing choices");

let nextMonthClicks = 0;
window.document.querySelector('[aria-label="下个月"]').addEventListener("click", () => { nextMonthClicks += 1; });
const month = window.document.querySelector(".calendar-month");
const pointer = (type, x, y) => {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: "mouse" },
    clientX: { value: x },
    clientY: { value: y },
    button: { value: 0 },
  });
  month.dispatchEvent(event);
};

pointer("pointerdown", 180, 100);
pointer("pointermove", 92, 102);
assert.ok(month.classList.contains("is-dragging"));
assert.match(month.style.getPropertyValue("--calendar-drag-x"), /^-\d/);
pointer("pointerup", 92, 102);
assert.equal(nextMonthClicks, 1, "a completed desktop drag should switch to the next month");
assert.ok(month.classList.contains("is-snapping"), "the calendar should spring back after release");

dom.window.close();
console.log("refine motion interaction tests passed");
