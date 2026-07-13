(() => {
  const root = document.getElementById("root");
  if (!root) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const seenEntrance = new WeakSet();
  const numberState = new WeakMap();
  const numberLocks = new WeakSet();
  let entranceIndex = 0;

  const getTextNode = (element) =>
    Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);

  const numberElements = () =>
    document.querySelectorAll(
      ".pie-center strong, .progress-ring strong, .stats > .stat-card:not(.streak-card) > strong"
    );

  const animateNumber = (element, from, to) => {
    const textNode = getTextNode(element);
    if (!textNode || from === to || reducedMotion.matches) return;

    numberLocks.add(element);
    element.classList.remove("motion-number-changing");
    void element.offsetWidth;
    element.classList.add("motion-number-changing");

    const started = performance.now();
    const duration = 420;
    const ease = (progress) => 1 - Math.pow(1 - progress, 3);

    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      textNode.data = String(Math.round(from + (to - from) * ease(progress)));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        textNode.data = String(to);
        numberState.set(element, to);
        numberLocks.delete(element);
        window.setTimeout(() => element.classList.remove("motion-number-changing"), 80);
      }
    };

    requestAnimationFrame(tick);
  };

  const scanNumbers = () => {
    numberElements().forEach((element) => {
      if (numberLocks.has(element)) return;
      const textNode = getTextNode(element);
      const value = Number.parseInt(textNode?.data || "", 10);
      if (!Number.isFinite(value)) return;

      if (!numberState.has(element)) {
        numberState.set(element, value);
        return;
      }

      const previous = numberState.get(element);
      if (previous !== value) {
        numberState.set(element, value);
        animateNumber(element, previous, value);
      }
    });
  };

  const entranceObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("motion-enter");
            entranceObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -4%" }
      )
    : null;

  const scanEntrances = () => {
    document
      .querySelectorAll(
        ".topbar, .hero, .catchup, .stats .stat-card, .month-summary, .history, footer"
      )
      .forEach((element) => {
        if (seenEntrance.has(element)) return;
        seenEntrance.add(element);
        element.classList.add("motion-card");
        element.style.setProperty("--motion-index", String(Math.min(entranceIndex++, 7)));

        if (reducedMotion.matches || !entranceObserver) {
          element.classList.add("motion-enter");
        } else {
          entranceObserver.observe(element);
        }
      });
  };

  const updateCompletedState = () => {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const selected = hero.querySelector(".answer.selected");
    hero.querySelectorAll(".answer").forEach((answer) => {
      const small = answer.querySelector("small");
      if (!small) return;
      if (!small.dataset.originalCopy) small.dataset.originalCopy = small.textContent;
      small.textContent = small.dataset.originalCopy;
      answer.removeAttribute("title");
    });

    if (hero.classList.contains("completed") && selected && !hero.classList.contains("motion-editing")) {
      const small = selected.querySelector("small");
      if (small) small.textContent = "今日已记录 · 轻点修改";
      selected.title = "修改今天的记录";
    }
  };

  const pulseTodayOnce = () => {
    const today = document.querySelector(".calendar-day.today");
    if (!today || today.dataset.motionPulse === "done") return;
    today.dataset.motionPulse = "done";
    if (reducedMotion.matches) return;
    today.classList.add("motion-today-pulse");
    window.setTimeout(() => today.classList.remove("motion-today-pulse"), 980);
  };

  const scan = () => {
    scanEntrances();
    scanNumbers();
    updateCompletedState();
    pulseTodayOnce();
  };

  const observer = new MutationObserver(() => requestAnimationFrame(scan));
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  document.addEventListener(
    "click",
    (event) => {
      const selected = event.target.closest(".hero.completed .answer.selected");
      const hero = selected?.closest(".hero");
      if (selected && hero && !hero.classList.contains("motion-editing")) {
        event.preventDefault();
        event.stopPropagation();
        hero.classList.add("motion-editing");
        updateCompletedState();
        return;
      }

      const answer = event.target.closest(".hero.motion-editing .answer");
      if (answer) {
        window.setTimeout(() => {
          answer.closest(".hero")?.classList.remove("motion-editing");
          updateCompletedState();
        }, 80);
      }

      const day = event.target.closest(".calendar-day");
      if (day && !day.disabled) {
        const rect = day.getBoundingClientRect();
        const origin = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
        document.documentElement.style.setProperty("--history-origin-x", `${origin}%`);
      }
    },
    true
  );

  const switchMonth = (direction) => {
    const label = direction > 0 ? "下个月" : "上个月";
    const button = document.querySelector(`.month-switcher button[aria-label="${label}"]`);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  };

  let wheelCooldown = 0;
  document.addEventListener(
    "wheel",
    (event) => {
      if (!event.target.closest(".calendar-month")) return;
      if (Math.abs(event.deltaX) < 34 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.1) return;
      const now = performance.now();
      if (now < wheelCooldown) return;
      wheelCooldown = now + 520;
      event.preventDefault();
      switchMonth(event.deltaX > 0 ? 1 : -1);
    },
    { passive: false }
  );

  reducedMotion.addEventListener?.("change", scan);
  requestAnimationFrame(scan);
})();
