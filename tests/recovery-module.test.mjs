import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const source = fs.readFileSync(new URL("../assets/recovery-module.js", import.meta.url), "utf8");
const now = new Date();
const release = new Date(now.getTime() - (56 * 60 * 60 * 1000));
const dateKey = [
  release.getFullYear(),
  String(release.getMonth() + 1).padStart(2, "0"),
  String(release.getDate()).padStart(2, "0"),
].join("-");

const dom = new JSDOM(
  "<!doctype html><html><body><main><p class=\"month-summary\">本月摘要</p><section class=\"history\"></section></main></body></html>",
  {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  }
);

const { window } = dom;
window.matchMedia = () => ({
  matches: true,
  addEventListener() {},
  removeEventListener() {},
});
window.navigator.vibrate = () => true;
window.localStorage.setItem("did-you-v1", JSON.stringify({ [dateKey]: "yes" }));
window.eval(source);

await new Promise((resolve) => window.setTimeout(resolve, 40));

const module = window.document.querySelector("#recovery-vault");
assert.ok(module, "recovery module should mount after the monthly summary");
assert.equal(module.previousElementSibling.className, "month-summary");
assert.ok(module.querySelector(".recovery-liquid-caustics"), "liquid refraction layer should render");
assert.ok(module.querySelector(".recovery-glass-glint"), "glass highlight layer should render");
assert.ok(module.querySelector(".recovery-motion-hint"), "one-time tilt hint should render");

const reducedMotionToggle = module.querySelector(".recovery-motion-toggle");
assert.ok(reducedMotionToggle, "motion control should render");
assert.equal(reducedMotionToggle.disabled, true, "motion control should respect reduced-motion settings");
assert.match(module.querySelector(".recovery-motion-status").textContent, /减少动态效果/);

const progress = Number(module.querySelector(".recovery-percent-number").textContent);
assert.ok(progress >= 60 && progress <= 76, `56-hour progress should be in the expected non-linear range, got ${progress}`);
assert.match(module.querySelector(".recovery-status-pill").textContent, /明显恢复/);
assert.ok(module.querySelectorAll(".recovery-particle").length >= 3, "progress should render layered particles");
assert.ok(
  new Set([...module.querySelectorAll(".recovery-particle")].map((particle) => particle.style.getPropertyValue("--particle-scale"))).size >= 3,
  "particles should use three visual depths"
);

const summary = module.querySelector(".recovery-summary");
summary.click();
assert.equal(summary.getAttribute("aria-expanded"), "true");
assert.ok(module.classList.contains("is-expanded"));

module.querySelector(".recovery-edit-button").click();
const editor = window.document.querySelector("#recovery-editor");
assert.ok(editor.classList.contains("is-open"));

const manualTime = new Date(now.getTime() - (12 * 60 * 60 * 1000));
const offset = manualTime.getTimezoneOffset() * 60_000;
editor.querySelector("input").value = new Date(manualTime.getTime() - offset).toISOString().slice(0, 16);
editor.querySelector(".recovery-editor-save").click();

const stored = JSON.parse(window.localStorage.getItem("chonglema-recovery-v1"));
assert.equal(stored.source, "manual");
assert.ok(Math.abs(stored.timestamp - manualTime.getTime()) < 61_000);
assert.ok(!editor.classList.contains("is-open"));
assert.match(module.querySelector(".recovery-status-pill").textContent, /恢复启动/);

dom.window.close();

const motionDom = new JSDOM(
  "<!doctype html><html><body><main><button class=\"answer yes\">冲了</button><button class=\"answer no\">没冲</button><p class=\"month-summary\">本月摘要</p><section class=\"history\"></section></main></body></html>",
  {
    url: "https://example.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
  }
);

const motionWindow = motionDom.window;
motionWindow.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
motionWindow.navigator.vibrate = () => true;
let permissionRequests = 0;
class MockDeviceOrientationEvent extends motionWindow.Event {}
MockDeviceOrientationEvent.requestPermission = async () => {
  permissionRequests += 1;
  return "granted";
};
Object.defineProperty(motionWindow, "DeviceOrientationEvent", {
  configurable: true,
  value: MockDeviceOrientationEvent,
});
motionWindow.localStorage.setItem("did-you-v1", JSON.stringify({ [dateKey]: "yes" }));
motionWindow.eval(source);
await new Promise((resolve) => motionWindow.setTimeout(resolve, 50));

const motionModule = motionWindow.document.querySelector("#recovery-vault");
const motionToggle = motionModule.querySelector(".recovery-motion-toggle");
motionToggle.click();
await new Promise((resolve) => motionWindow.setTimeout(resolve, 30));
assert.equal(permissionRequests, 1, "motion permission should only be requested after a user gesture");
assert.equal(motionToggle.getAttribute("aria-checked"), "true");
assert.ok(motionModule.classList.contains("has-motion"));

const dispatchOrientation = (beta, gamma) => {
  const event = new motionWindow.Event("deviceorientation");
  Object.defineProperties(event, {
    beta: { value: beta },
    gamma: { value: gamma },
  });
  motionWindow.dispatchEvent(event);
};
dispatchOrientation(0, 0);
dispatchOrientation(12, 24);
await new Promise((resolve) => motionWindow.setTimeout(resolve, 100));
assert.notEqual(
  motionModule.style.getPropertyValue("--recovery-liquid-tilt"),
  "0.00deg",
  "device orientation should move the liquid surface"
);

motionWindow.document.querySelector(".answer.yes").click();
assert.ok(motionModule.classList.contains("is-releasing"), "release check-in should trigger drain feedback");
motionWindow.document.querySelector(".answer.no").click();
assert.ok(motionModule.classList.contains("is-affirming"), "no-release check-in should trigger a calm pulse");

motionToggle.click();
assert.equal(motionToggle.getAttribute("aria-checked"), "false");
assert.ok(!motionModule.classList.contains("has-motion"));

motionDom.window.close();
console.log("recovery module interaction tests passed");
