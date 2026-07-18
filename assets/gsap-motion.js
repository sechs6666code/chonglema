(() => {
  const root = document.getElementById("root");
  const gsap = window.gsap;
  const Flip = window.Flip;
  const ScrollTrigger = window.ScrollTrigger;
  if (!root || !gsap) return;

  const plugins = [Flip, ScrollTrigger].filter(Boolean);
  if (plugins.length) gsap.registerPlugin(...plugins);

  const html = document.documentElement;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const numberTweens = new WeakMap();
  const numberTargetState = new WeakMap();
  const numberCompletion = new WeakMap();
  const leaderboardNumberState = new WeakMap();
  const leaderboardNumberLocks = new WeakSet();
  const ringState = new WeakMap();
  const ringTweens = new WeakMap();
  const controlledSheetState = new WeakMap();
  const scrollRevealSeen = new WeakSet();
  const scrollRevealTriggers = new Set();
  const scrollDepthTweens = new Set();
  const scrollDecorationTweens = new WeakMap();
  const activeMilestoneTimelines = new Set();
  const activeNumberElements = new Set();
  const activeRings = new Set();
  let reducedMotion = reducedMotionQuery.matches;
  let bodyObserver = null;
  let pendingScan = 0;
  let pendingScrollRefresh = 0;
  let scrollProgressElement = null;
  let scrollRevealIndex = 0;

  const milestoneDays = [3, 7, 14, 30, 60, 90, 180, 365];
  const scrollProgressTweens = new Set();

  const scrollRevealSelector = [
    ".leaderboard-inline-entry",
    ".catchup",
    ".stats > .stat-card",
    ".month-summary",
    ".history",
    "footer",
  ].join(", ");

  const scrollShowcaseSelector = [
    ".leaderboard-inline-entry",
    ".stats > .streak-card",
    ".history",
  ].join(", ");

  const leaderboardNumberSelector = [
    "[data-leaderboard-trigger-count]",
    "[data-leaderboard-inline-ninja]",
    "[data-leaderboard-inline-rush]",
    "[data-leaderboard-ninja-days]",
    "[data-leaderboard-rush-days]",
    "[data-leaderboard-current-days]",
  ].join(", ");

  const sheetDefinitions = [
    {
      overlay: ".leaderboard-overlay",
      panel: ".leaderboard-panel",
      open: (element) => element.classList.contains("is-open") && !element.hidden,
    },
    {
      overlay: ".pwa-reminder-overlay",
      panel: ".pwa-reminder-panel",
      open: (element) => element.classList.contains("is-open") && !element.hidden,
    },
    {
      overlay: ".recovery-editor",
      panel: ".recovery-editor-panel",
      open: (element) => element.classList.contains("is-open"),
    },
  ];

  const transientSheetDefinitions = [
    { overlay: ".month-sheet", panel: ".month-panel" },
    { overlay: ".history-sheet", panel: ".history-panel" },
  ];

  const getTextNode = (element) =>
    Array.from(element?.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE);

  const parseElementNumber = (element) => {
    const textNode = getTextNode(element);
    const value = Number.parseInt(textNode?.data || element?.textContent || "", 10);
    return { textNode, value };
  };

  const clearAnimatingFlag = (element) => {
    element?.removeAttribute("data-gsap-animating");
  };

  function animateNumber(element, from, to, duration = 0.55, onComplete = null) {
    const textNode = getTextNode(element);
    const start = Number(from);
    const end = Number(to);
    if (!element || !textNode || !Number.isFinite(start) || !Number.isFinite(end)) {
      onComplete?.();
      return null;
    }

    numberTweens.get(element)?.kill();
    numberTweens.delete(element);
    numberTargetState.delete(element);
    numberCompletion.delete(element);
    numberTargetState.set(element, end);
    if (onComplete) numberCompletion.set(element, onComplete);
    if (reducedMotion || start === end) {
      textNode.data = String(Math.round(end));
      clearAnimatingFlag(element);
      numberTargetState.delete(element);
      numberCompletion.delete(element);
      onComplete?.();
      return null;
    }

    const value = { current: start };
    element.dataset.gsapAnimating = "number";
    activeNumberElements.add(element);
    textNode.data = String(Math.round(start));

    let tween = null;
    tween = gsap.to(value, {
      current: end,
      duration,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: () => {
        textNode.data = String(Math.round(value.current));
      },
      onComplete: () => {
        textNode.data = String(Math.round(end));
        numberTweens.delete(element);
        numberTargetState.delete(element);
        numberCompletion.delete(element);
        activeNumberElements.delete(element);
        clearAnimatingFlag(element);
        onComplete?.();
      },
      onInterrupt: () => {
        activeNumberElements.delete(element);
        clearAnimatingFlag(element);
      },
    });
    numberTweens.set(element, tween);
    return tween;
  }

  function scanLeaderboardNumbers() {
    document.querySelectorAll(leaderboardNumberSelector).forEach((element) => {
      if (leaderboardNumberLocks.has(element)) return;
      const { value } = parseElementNumber(element);
      if (!Number.isFinite(value)) return;
      if (!leaderboardNumberState.has(element)) {
        leaderboardNumberState.set(element, value);
        return;
      }
      const previous = leaderboardNumberState.get(element);
      if (previous === value) return;
      leaderboardNumberState.set(element, value);
      leaderboardNumberLocks.add(element);
      animateNumber(element, previous, value, 0.52, () => {
        leaderboardNumberLocks.delete(element);
      });
    });
  }

  function animateRing(circle, from, to, duration = 0.68) {
    const start = Number(from);
    const end = Number(to);
    if (!circle || !Number.isFinite(start) || !Number.isFinite(end)) return null;

    ringTweens.get(circle)?.kill();
    ringState.set(circle, end);
    if (reducedMotion || start === end) {
      gsap.set(circle, { strokeDashoffset: end });
      clearAnimatingFlag(circle);
      return null;
    }

    circle.dataset.gsapAnimating = "ring";
    activeRings.add(circle);
    let tween = null;
    tween = gsap.fromTo(
      circle,
      { strokeDashoffset: start },
      {
        strokeDashoffset: end,
        duration,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          ringTweens.delete(circle);
          activeRings.delete(circle);
          clearAnimatingFlag(circle);
        },
        onInterrupt: () => {
          activeRings.delete(circle);
          clearAnimatingFlag(circle);
        },
      },
    );
    ringTweens.set(circle, tween);
    return tween;
  }

  function scanRings() {
    document.querySelectorAll(".progress-ring .ring-value").forEach((circle) => {
      const target = Number.parseFloat(circle.style.strokeDashoffset || circle.getAttribute("stroke-dashoffset") || "100");
      if (!Number.isFinite(target)) return;
      if (!ringState.has(circle)) {
        ringState.set(circle, target);
        animateRing(circle, 100, target, 0.76);
        return;
      }
      const previous = ringState.get(circle);
      if (Math.abs(previous - target) > 0.01) animateRing(circle, previous, target);
    });
  }

  const localDateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  };

  function readLocalRecords() {
    try {
      const records = JSON.parse(localStorage.getItem("did-you-v1") || "{}");
      return records && typeof records === "object" ? records : {};
    } catch {
      return {};
    }
  }

  function readCurrentStreak(recordType) {
    const records = readLocalRecords();
    const date = new Date();
    let days = 0;
    while (records[localDateKey(date)] === recordType) {
      days += 1;
      date.setDate(date.getDate() - 1);
    }
    return days;
  }

  function milestoneParticleMarkup(count = 28) {
    return Array.from({ length: count }, (_, index) =>
      `<i style="--particle:${index}" aria-hidden="true"></i>`).join("");
  }

  function milestoneRayMarkup(count = 12) {
    return Array.from({ length: count }, (_, index) =>
      `<i style="--ray:${index}" aria-hidden="true"></i>`).join("");
  }

  function animateMilestoneOverlay(overlay, type = "ninja") {
    if (!overlay || overlay.dataset.gsapMilestone) return null;
    overlay.dataset.gsapMilestone = "animating";
    overlay.dataset.milestoneType = type === "rush" ? "rush" : "ninja";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "assertive");

    const card = overlay.querySelector(":scope > div:not(.gsap-milestone-fx)");
    if (!card) return null;
    card.classList.add("gsap-milestone-card");
    const core = card.querySelector(":scope > span");
    const title = card.querySelector(":scope > b");
    const copy = card.querySelector(":scope > p");
    core?.classList.add("gsap-milestone-core");

    if (!card.querySelector(".gsap-milestone-kicker")) {
      const kicker = document.createElement("small");
      kicker.className = "gsap-milestone-kicker";
      kicker.textContent = type === "rush" ? "RUSH STREAK UNLOCKED" : "NINJA STREAK UNLOCKED";
      card.prepend(kicker);
    }

    const fx = document.createElement("div");
    fx.className = "gsap-milestone-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = `
      <i class="gsap-milestone-flash"></i>
      <i class="gsap-milestone-ring ring-one"></i>
      <i class="gsap-milestone-ring ring-two"></i>
      <i class="gsap-milestone-ring ring-three"></i>
      <span class="gsap-milestone-rays">${milestoneRayMarkup()}</span>
      <span class="gsap-milestone-particles">${milestoneParticleMarkup()}</span>
    `;
    overlay.append(fx);

    if (reducedMotion) {
      overlay.dataset.gsapMilestone = "complete";
      return null;
    }

    const kicker = card.querySelector(".gsap-milestone-kicker");
    const flash = fx.querySelector(".gsap-milestone-flash");
    const rings = Array.from(fx.querySelectorAll(".gsap-milestone-ring"));
    const rays = fx.querySelector(".gsap-milestone-rays");
    const particles = Array.from(fx.querySelectorAll(".gsap-milestone-particles > i"));
    const vectors = particles.map((_, index) => {
      const angle = (Math.PI * 2 * index) / particles.length + gsap.utils.random(-0.09, 0.09);
      const distance = gsap.utils.random(120, 250, 2);
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotation: gsap.utils.random(-220, 220, 5),
        scale: gsap.utils.random(0.65, 1.65, 0.05),
      };
    });

    let timeline = null;
    timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        activeMilestoneTimelines.delete(timeline);
        overlay.dataset.gsapMilestone = "complete";
        fx.remove();
        gsap.set([overlay, card, core, kicker, title, copy].filter(Boolean), {
          clearProps: "transform,opacity,visibility,transformOrigin",
        });
        if (overlay.classList.contains("gsap-milestone-custom")) overlay.remove();
      },
      onInterrupt: () => activeMilestoneTimelines.delete(timeline),
    });
    activeMilestoneTimelines.add(timeline);

    timeline
      .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0)
      .fromTo(flash, { scale: 0.2, autoAlpha: 0 }, {
        scale: 2.4,
        autoAlpha: 0.9,
        duration: 0.5,
        ease: "power2.out",
      }, 0)
      .to(flash, { scale: 3.4, autoAlpha: 0, duration: 0.65 }, 0.38)
      .fromTo(card, {
        y: 78,
        z: -180,
        scale: 0.48,
        rotationX: 34,
        rotationZ: -5,
        autoAlpha: 0,
      }, {
        y: 0,
        z: 0,
        scale: 1,
        rotationX: 0,
        rotationZ: 0,
        autoAlpha: 1,
        duration: 0.82,
        ease: "back.out(1.9)",
      }, 0.08)
      .fromTo(rings, { scale: 0.12, rotation: -35, autoAlpha: 0 }, {
        scale: (index) => 1.7 + index * 0.38,
        rotation: (index) => 42 + index * 30,
        autoAlpha: (index) => 0.58 - index * 0.12,
        duration: 1.25,
        stagger: 0.07,
        ease: "expo.out",
      }, 0.06)
      .fromTo(rays, { scale: 0.15, rotation: -35, autoAlpha: 0 }, {
        scale: 1.8,
        rotation: 28,
        autoAlpha: 0.72,
        duration: 1.25,
        ease: "expo.out",
      }, 0.05)
      .fromTo(particles, { x: 0, y: 0, scale: 0, rotation: 0, autoAlpha: 0 }, {
        x: (index) => vectors[index].x,
        y: (index) => vectors[index].y,
        scale: (index) => vectors[index].scale,
        rotation: (index) => vectors[index].rotation,
        autoAlpha: 1,
        duration: 1.05,
        stagger: 0.008,
        ease: "power4.out",
      }, 0.14)
      .fromTo([kicker, core, title, copy].filter(Boolean), { y: 24, scale: 0.82, autoAlpha: 0 }, {
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.5,
        stagger: 0.055,
        ease: "back.out(1.7)",
      }, 0.32)
      .to(core, { scale: 1.2, rotation: 8, duration: 0.22, repeat: 1, yoyo: true }, 0.88)
      .to(particles, {
        y: "+=58",
        rotation: "+=150",
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.006,
        ease: "power2.in",
      }, 1.02)
      .to([rings, rays], { scale: "+=0.8", autoAlpha: 0, duration: 0.75 }, 1.05)
      .to(card, { y: -18, scale: 1.05, autoAlpha: 0, duration: 0.38, ease: "power3.in" }, 2.12)
      .to(overlay, { autoAlpha: 0, duration: 0.32, ease: "power2.in" }, 2.18);

    return timeline;
  }

  function celebrateMilestone(days, type = "ninja") {
    const value = Number(days);
    if (!milestoneDays.includes(value)) return null;
    const current = document.querySelector(".milestone-pop");
    if (current) {
      animateMilestoneOverlay(current, type);
      return current;
    }

    const overlay = document.createElement("div");
    overlay.className = "milestone-pop gsap-milestone-custom";
    overlay.innerHTML = `
      <div>
        <span>✦</span>
        <b>${type === "rush" ? "连冲" : "连续忍住"} ${value} 天</b>
        <p>里程碑已解锁，继续刷新纪录。</p>
      </div>
    `;
    document.body.append(overlay);
    animateMilestoneOverlay(overlay, type);
    if (reducedMotion) window.setTimeout(() => overlay.remove(), 1800);
    return overlay;
  }

  function scheduleMilestoneCheck(recordType, previousDays, attempt = 0) {
    window.setTimeout(() => {
      const nextDays = readCurrentStreak(recordType);
      if (nextDays <= previousDays && attempt < 1) {
        scheduleMilestoneCheck(recordType, previousDays, attempt + 1);
        return;
      }
      if (nextDays <= previousDays || !milestoneDays.includes(nextDays)) return;
      const type = recordType === "yes" ? "rush" : "ninja";
      const nativeOverlay = document.querySelector(".milestone-pop");
      if (nativeOverlay) animateMilestoneOverlay(nativeOverlay, type);
      else celebrateMilestone(nextDays, type);
    }, attempt ? 180 : 90);
  }

  function scanMilestones(scope = document) {
    scope.querySelectorAll?.(".milestone-pop").forEach((overlay) => {
      animateMilestoneOverlay(overlay, overlay.dataset.milestoneType || "ninja");
    });
  }

  function runCheckinTimeline(answer) {
    const hero = answer?.closest(".hero");
    if (!answer || !hero || !hero.classList.contains("completed") || reducedMotion) return;

    const icon = answer.querySelector(".answer-icon");
    const path = icon?.querySelector("path");
    const headline = hero.querySelector("h1");
    const subline = hero.querySelector(".subline");
    const wash = document.createElement("span");
    wash.className = "gsap-checkin-wash";
    wash.setAttribute("aria-hidden", "true");
    answer.append(wash);

    const pathLength = typeof path?.getTotalLength === "function"
      ? Math.max(24, path.getTotalLength())
      : 32;
    const targets = [answer, icon, path, headline, subline].filter(Boolean);
    gsap.killTweensOf(targets);
    hero.dataset.gsapCheckin = "animating";
    answer.dataset.gsapAnimating = "checkin";

    if (path) {
      gsap.set(path, {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
      });
    }

    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        wash.remove();
        delete hero.dataset.gsapCheckin;
        clearAnimatingFlag(answer);
        gsap.set(targets, { clearProps: "transform,opacity,visibility" });
        if (path) gsap.set(path, { clearProps: "strokeDasharray,strokeDashoffset" });
      },
    });

    timeline
      .fromTo(answer, { y: 7, scale: 0.975 }, { y: 0, scale: 1, duration: 0.48 }, 0)
      .fromTo(icon, { scale: 0.7, rotation: -7, autoAlpha: 0.38 }, {
        scale: 1,
        rotation: 0,
        autoAlpha: 1,
        duration: 0.48,
        ease: "back.out(1.6)",
      }, 0.04)
      .fromTo(wash, { scale: 0.35, autoAlpha: 0 }, {
        scale: 0.82,
        autoAlpha: 0.82,
        duration: 0.22,
      }, 0.03)
      .to(wash, { scale: 1.38, autoAlpha: 0, duration: 0.48, ease: "power2.out" }, 0.24)
      .fromTo([headline, subline].filter(Boolean), { y: 8, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.42,
        stagger: 0.055,
      }, 0.1);

    if (path) {
      timeline.to(path, { strokeDashoffset: 0, duration: 0.44, ease: "power2.out" }, 0.1);
    }
    window.setTimeout(scanRings, 0);
    return timeline;
  }

  function scheduleCheckinTimeline(event) {
    const answer = event.target.closest?.(".hero .answer");
    const hero = answer?.closest(".hero");
    if (!answer || !hero) return;

    const isOpeningEditor = hero.classList.contains("completed")
      && answer.classList.contains("selected")
      && !hero.classList.contains("motion-editing");
    if (isOpeningEditor) return;

    const type = answer.classList.contains("yes") ? "yes" : "no";
    const previousStreakDays = readCurrentStreak(type);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const selected = document.querySelector(`.hero.completed .answer.${type}.selected`);
        if (selected) {
          runCheckinTimeline(selected);
          scheduleMilestoneCheck(type, previousStreakDays);
        }
        scanLeaderboardNumbers();
        scanRings();
      });
    });
  }

  function findSheetDefinition(element) {
    return sheetDefinitions.find((definition) => element.matches?.(definition.overlay));
  }

  function animateSheet(element, isOpen, definition) {
    const panel = element.querySelector(definition.panel);
    if (!panel || reducedMotion) {
      controlledSheetState.set(element, isOpen);
      return;
    }
    if (controlledSheetState.get(element) === isOpen) return;
    controlledSheetState.set(element, isOpen);
    element.dataset.gsapSheet = isOpen ? "opening" : "closing";
    gsap.killTweensOf([element, panel]);

    if (isOpen) {
      gsap.fromTo(element, { autoAlpha: 0 }, {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
        overwrite: "auto",
      });
      gsap.fromTo(panel, { y: 24, scale: 0.985, autoAlpha: 0.84 }, {
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.44,
        ease: "power3.out",
        overwrite: "auto",
        onComplete: () => {
          element.dataset.gsapSheet = "open";
          gsap.set(panel, { clearProps: "transform,opacity,visibility" });
        },
      });
      return;
    }

    gsap.to(panel, {
      y: 14,
      scale: 0.992,
      autoAlpha: 0.9,
      duration: 0.2,
      ease: "power2.in",
      overwrite: "auto",
    });
    gsap.to(element, {
      autoAlpha: 0,
      duration: 0.2,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => {
        element.dataset.gsapSheet = "closed";
      },
    });
  }

  function animateTransientSheet(element, definition) {
    if (!element || element.dataset.gsapSheet || reducedMotion) return;
    const panel = element.querySelector(definition.panel);
    if (!panel) return;
    element.dataset.gsapSheet = "opening";
    gsap.fromTo(element, { autoAlpha: 0 }, {
      autoAlpha: 1,
      duration: 0.2,
      ease: "power2.out",
    });
    gsap.fromTo(panel, { y: 24, scale: 0.985, autoAlpha: 0.82 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: 0.42,
      ease: "power3.out",
      onComplete: () => {
        element.dataset.gsapSheet = "open";
        gsap.set(panel, { clearProps: "transform,opacity,visibility" });
      },
    });
  }

  function scanSheets(scope = document) {
    sheetDefinitions.forEach((definition) => {
      scope.querySelectorAll?.(definition.overlay).forEach((element) => {
        const isOpen = definition.open(element);
        if (!controlledSheetState.has(element)) {
          controlledSheetState.set(element, false);
          if (!isOpen) return;
        }
        animateSheet(element, isOpen, definition);
      });
    });
    transientSheetDefinitions.forEach((definition) => {
      scope.querySelectorAll?.(definition.overlay).forEach((element) => {
        animateTransientSheet(element, definition);
      });
    });
  }

  function captureLeaderboard(list) {
    if (reducedMotion || !Flip || !list) return null;
    const targets = list.querySelectorAll("[data-flip-id]");
    if (!targets.length) return null;
    return Flip.getState(targets, { props: "opacity" });
  }

  function playLeaderboardFlip(flipState, list) {
    if (reducedMotion || !Flip || !flipState || !list) return null;
    const targets = list.querySelectorAll("[data-flip-id]");
    if (!targets.length) return null;
    list.classList.add("is-gsap-flipping");
    const animation = Flip.from(flipState, {
      targets,
      absolute: true,
      scale: true,
      simple: true,
      duration: 0.48,
      ease: "power3.inOut",
      stagger: 0.025,
      onEnter: (elements) => gsap.fromTo(elements, { y: 10, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.34,
        stagger: 0.025,
        ease: "power2.out",
      }),
      onLeave: (elements) => gsap.to(elements, {
        y: -8,
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.in",
      }),
      onComplete: () => list.classList.remove("is-gsap-flipping"),
      onInterrupt: () => list.classList.remove("is-gsap-flipping"),
    });
    return animation;
  }

  function scheduleScrollRefresh() {
    if (!ScrollTrigger || reducedMotion || pendingScrollRefresh) return;
    pendingScrollRefresh = requestAnimationFrame(() => {
      pendingScrollRefresh = requestAnimationFrame(() => {
        pendingScrollRefresh = 0;
        ScrollTrigger.refresh();
      });
    });
  }

  function ensureScrollProgress() {
    if (!ScrollTrigger || reducedMotion || scrollProgressElement?.isConnected) return;
    const progress = document.createElement("span");
    progress.className = "gsap-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = "<i></i><b></b><em></em>";
    document.body.append(progress);
    scrollProgressElement = progress;

    const bar = progress.firstElementChild;
    const comet = progress.querySelector("b");
    const bloom = progress.querySelector("em");
    gsap.set(bar, { scaleX: 0, transformOrigin: "0 50%" });
    const progressTween = gsap.to(bar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        id: "page-progress",
        start: 0,
        end: "max",
        scrub: 0.18,
      },
    });
    const cometTween = gsap.to(comet, {
      x: () => Math.max(0, window.innerWidth - 18),
      rotation: 720,
      ease: "none",
      scrollTrigger: {
        id: "page-progress-comet",
        start: 0,
        end: "max",
        scrub: 0.32,
        invalidateOnRefresh: true,
      },
    });
    const bloomTween = gsap.to(bloom, {
      x: () => Math.max(0, window.innerWidth - 34),
      scale: 1.45,
      ease: "none",
      scrollTrigger: {
        id: "page-progress-bloom",
        start: 0,
        end: "max",
        scrub: 0.48,
        invalidateOnRefresh: true,
      },
    });
    [progressTween, cometTween, bloomTween].forEach((tween) => scrollProgressTweens.add(tween));
  }

  function getScrollLayers(element) {
    if (element.matches(".leaderboard-inline-entry")) {
      return Array.from(element.querySelectorAll(
        ":scope > .leaderboard-inline-icon, :scope > .leaderboard-inline-copy, :scope > .leaderboard-inline-scores, :scope > .leaderboard-inline-cta",
      ));
    }
    if (element.matches(".streak-card")) {
      return Array.from(element.querySelectorAll(":scope > .wellness-side"));
    }
    if (element.matches(".history")) {
      return Array.from(element.querySelectorAll(":scope > .section-head, :scope > .calendar-month, :scope > .legend"));
    }
    if (element.matches(".stat-card")) {
      return Array.from(element.querySelectorAll(":scope > span, :scope > strong, :scope > small"));
    }
    if (element.matches(".catchup")) {
      return Array.from(element.querySelectorAll(":scope > span, :scope > b"));
    }
    return [];
  }

  function setupScrollDepth(element, orb, wire) {
    if (!ScrollTrigger || reducedMotion || scrollDecorationTweens.has(orb)) return;
    const orbTween = gsap.fromTo(orb, {
      xPercent: -82,
      yPercent: -38,
      rotation: -28,
      scale: 0.72,
    }, {
      xPercent: 88,
      yPercent: 54,
      rotation: 52,
      scale: 1.28,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(bottom top)",
        scrub: 0.72,
      },
    });
    const wireTween = gsap.fromTo(wire, {
      xPercent: 52,
      yPercent: 26,
      rotation: 38,
      scale: 0.82,
    }, {
      xPercent: -44,
      yPercent: -32,
      rotation: -58,
      scale: 1.18,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(bottom top)",
        scrub: 1.05,
      },
    });
    scrollDecorationTweens.set(orb, [orbTween, wireTween]);
    scrollDepthTweens.add(orbTween);
    scrollDepthTweens.add(wireTween);
  }

  function ensureScrollDecorations(element) {
    if (!element || reducedMotion) return;
    element.dataset.gsapShowcase = "true";
    let orb = element.querySelector(":scope > .gsap-scroll-orb");
    let wire = element.querySelector(":scope > .gsap-scroll-wire");
    let sheen = element.querySelector(":scope > .gsap-scroll-sheen");
    if (!orb) {
      orb = document.createElement("span");
      orb.className = "gsap-scroll-orb";
      orb.setAttribute("aria-hidden", "true");
      element.append(orb);
    }
    if (!wire) {
      wire = document.createElement("span");
      wire.className = "gsap-scroll-wire";
      wire.setAttribute("aria-hidden", "true");
      element.append(wire);
    }
    if (!sheen) {
      sheen = document.createElement("span");
      sheen.className = "gsap-scroll-sheen";
      sheen.setAttribute("aria-hidden", "true");
      element.append(sheen);
    }
    setupScrollDepth(element, orb, wire);
  }

  function revealScrollBatch(elements) {
    elements.forEach((element) => {
      element.dataset.gsapScroll = "waiting";
      element.classList.remove("motion-card", "motion-enter");
      const order = scrollRevealIndex++;
      const compactCard = element.matches(".stats > .stat-card:not(.streak-card)");
      const compactIndex = compactCard
        ? Array.from(element.parentElement?.children || []).indexOf(element)
        : 0;
      const direction = compactCard ? (compactIndex % 2 ? 1 : -1) : (order % 2 ? 1 : -1);
      element.dataset.gsapScrollDirection = direction > 0 ? "right" : "left";
      gsap.set(element, {
        x: element.matches("footer, .month-summary") ? 0 : direction * (element.matches(".history") ? 82 : 62),
        y: element.matches(".history") ? 82 : 58,
        z: element.matches("footer") ? 0 : -140,
        scale: element.matches("footer") ? 0.92 : 0.86,
        rotationX: element.matches("footer") ? 0 : 17,
        rotationY: element.matches("footer, .month-summary") ? 0 : direction * -11,
        rotationZ: element.matches(".history") ? direction * 1.8 : direction * 0.8,
        skewY: element.matches("footer") ? 0 : direction * 1.25,
        autoAlpha: 0,
        transformOrigin: "50% 100%",
        transformPerspective: 1100,
      });
    });

    const triggers = ScrollTrigger.batch(elements, {
      start: "clamp(top 90%)",
      once: true,
      interval: 0.08,
      batchMax: 3,
      onEnter: (batch) => {
        batch.forEach((element) => {
          element.dataset.gsapScroll = "entering";
          const direction = element.dataset.gsapScrollDirection === "right" ? 1 : -1;
          const layers = getScrollLayers(element);
          const sheen = element.querySelector(":scope > .gsap-scroll-sheen");
          let timeline = null;
          timeline = gsap.timeline({
            defaults: { ease: "expo.out" },
            onComplete: () => {
              element.dataset.gsapScroll = "entered";
              gsap.set([element, ...layers, sheen].filter(Boolean), {
                clearProps: "transform,opacity,visibility,transformOrigin",
              });
            },
          });
          timeline.to(element, {
            x: 0,
            y: 0,
            z: 0,
            scale: 1,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            skewY: 0,
            autoAlpha: 1,
            duration: 1.08,
            ease: "back.out(1.42)",
            overwrite: "auto",
          }, 0);
          if (layers.length) {
            timeline.fromTo(layers, {
              x: direction * 26,
              y: 28,
              z: -90,
              rotationY: direction * -8,
              scale: 0.9,
              autoAlpha: 0,
            }, {
              x: 0,
              y: 0,
              z: 0,
              rotationY: 0,
              scale: 1,
              autoAlpha: 1,
              duration: 0.82,
              stagger: 0.065,
              ease: "power4.out",
            }, 0.18);
          }
          if (sheen) {
            timeline.fromTo(sheen, { xPercent: -190, autoAlpha: 0 }, {
              xPercent: 230,
              autoAlpha: 0.86,
              duration: 0.92,
              ease: "power2.inOut",
            }, 0.12);
          }
        });
      },
    });
    triggers.forEach((trigger) => scrollRevealTriggers.add(trigger));
  }

  function scanScrollMotion(scope = document) {
    if (!ScrollTrigger || reducedMotion) return;
    ensureScrollProgress();
    document.querySelectorAll(scrollShowcaseSelector).forEach(ensureScrollDecorations);
    const elements = Array.from(scope.querySelectorAll?.(scrollRevealSelector) || [])
      .filter((element) => !scrollRevealSeen.has(element));
    if (!elements.length) return;
    elements.forEach((element) => scrollRevealSeen.add(element));
    revealScrollBatch(elements);
    scheduleScrollRefresh();
  }

  function stopScrollMotion() {
    if (pendingScrollRefresh) cancelAnimationFrame(pendingScrollRefresh);
    pendingScrollRefresh = 0;
    scrollRevealTriggers.forEach((trigger) => trigger.kill?.());
    scrollRevealTriggers.clear();
    scrollDepthTweens.forEach((tween) => {
      tween.scrollTrigger?.kill?.();
      tween.kill?.();
    });
    scrollDepthTweens.clear();
    scrollProgressTweens.forEach((tween) => {
      tween.scrollTrigger?.kill?.();
      tween.kill?.();
    });
    scrollProgressTweens.clear();
    scrollProgressElement?.remove();
    scrollProgressElement = null;
    document.querySelectorAll(".gsap-scroll-orb, .gsap-scroll-wire, .gsap-scroll-sheen").forEach((element) => element.remove());
    document.querySelectorAll(scrollRevealSelector).forEach((element) => {
      element.dataset.gsapScroll = "entered";
      delete element.dataset.gsapShowcase;
      delete element.dataset.gsapScrollDirection;
      gsap.set(element, { clearProps: "transform,opacity,visibility,transformOrigin" });
    });
  }

  function queueScan() {
    if (pendingScan) return;
    pendingScan = requestAnimationFrame(() => {
      pendingScan = 0;
      scanLeaderboardNumbers();
      scanRings();
      scanSheets();
      scanScrollMotion();
      scanMilestones();
    });
  }

  function stopActiveMotion() {
    stopScrollMotion();
    activeMilestoneTimelines.forEach((timeline) => timeline.kill?.());
    activeMilestoneTimelines.clear();
    document.querySelectorAll(".milestone-pop").forEach((overlay) => {
      const card = overlay.querySelector(":scope > div:not(.gsap-milestone-fx)");
      const targets = [overlay, card, ...Array.from(card?.children || [])].filter(Boolean);
      gsap.set(targets, { clearProps: "transform,opacity,visibility,transformOrigin" });
      overlay.querySelector(".gsap-milestone-fx")?.remove();
      if (overlay.classList.contains("gsap-milestone-custom")) overlay.remove();
      else overlay.dataset.gsapMilestone = "complete";
    });
    activeNumberElements.forEach((element) => {
      const target = numberTargetState.get(element);
      const complete = numberCompletion.get(element);
      numberTweens.get(element)?.kill();
      if (Number.isFinite(target)) {
        const textNode = getTextNode(element);
        if (textNode) textNode.data = String(Math.round(target));
      }
      numberTweens.delete(element);
      numberTargetState.delete(element);
      numberCompletion.delete(element);
      clearAnimatingFlag(element);
      complete?.();
    });
    activeNumberElements.clear();
    activeRings.forEach((circle) => {
      ringTweens.get(circle)?.kill();
      const target = ringState.get(circle);
      if (Number.isFinite(target)) gsap.set(circle, { strokeDashoffset: target });
      clearAnimatingFlag(circle);
    });
    activeRings.clear();
    gsap.killTweensOf([
      ".answer",
      ".answer-icon",
      ".answer-icon path",
      ".hero h1",
      ".subline",
      ".gsap-checkin-wash",
      ".leaderboard-overlay",
      ".leaderboard-panel",
      ".pwa-reminder-overlay",
      ".pwa-reminder-panel",
      ".recovery-editor",
      ".recovery-editor-panel",
      ".month-sheet",
      ".month-panel",
      ".history-sheet",
      ".history-panel",
    ]);
    document.querySelectorAll(".gsap-checkin-wash").forEach((element) => element.remove());
    document.querySelectorAll("[data-gsap-animating]").forEach(clearAnimatingFlag);
    document.querySelectorAll(".is-gsap-flipping").forEach((element) => element.classList.remove("is-gsap-flipping"));
    sheetDefinitions.forEach((definition) => {
      document.querySelectorAll(definition.overlay).forEach((element) => {
        const panel = element.querySelector(definition.panel);
        gsap.set(element, { clearProps: "opacity,visibility" });
        if (panel) gsap.set(panel, { clearProps: "transform,opacity,visibility" });
        controlledSheetState.set(element, definition.open(element));
      });
    });
    transientSheetDefinitions.forEach((definition) => {
      document.querySelectorAll(definition.overlay).forEach((element) => {
        const panel = element.querySelector(definition.panel);
        gsap.set(element, { clearProps: "opacity,visibility" });
        if (panel) gsap.set(panel, { clearProps: "transform,opacity,visibility" });
      });
    });
  }

  const media = gsap.matchMedia();
  media.add(
    {
      reduceMotion: "(prefers-reduced-motion: reduce)",
      fullMotion: "(prefers-reduced-motion: no-preference)",
    },
    (context) => {
      reducedMotion = Boolean(context.conditions.reduceMotion);
      html.dataset.gsapMotion = reducedMotion ? "reduced" : "full";
      if (reducedMotion) stopActiveMotion();
      requestAnimationFrame(queueScan);
      return () => stopActiveMotion();
    },
  );

  window.ChonglemaGsapMotion = Object.freeze({
    animateNumber,
    captureLeaderboard,
    celebrateMilestone,
    playLeaderboardFlip,
    scanRings,
    usesScrollTrigger: Boolean(ScrollTrigger),
  });

  document.addEventListener("click", scheduleCheckinTimeline, true);
  bodyObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        const definition = findSheetDefinition(mutation.target);
        if (definition) animateSheet(mutation.target, definition.open(mutation.target), definition);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        const definition = findSheetDefinition(node);
        if (definition) {
          controlledSheetState.set(node, false);
          animateSheet(node, definition.open(node), definition);
        }
        transientSheetDefinitions.forEach((item) => {
          if (node.matches(item.overlay)) animateTransientSheet(node, item);
          node.querySelectorAll?.(item.overlay).forEach((element) => animateTransientSheet(element, item));
        });
      });
    });
    queueScan();
  });
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "hidden"],
    childList: true,
    characterData: true,
    subtree: true,
  });

  window.addEventListener("pagehide", () => {
    bodyObserver?.disconnect();
    if (pendingScan) cancelAnimationFrame(pendingScan);
    stopActiveMotion();
    media.revert();
  }, { once: true });

  html.classList.add("gsap-motion-ready");
  requestAnimationFrame(queueScan);
})();
