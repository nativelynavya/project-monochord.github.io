(() => {
  "use strict";

  const STORAGE_KEY = "project-monochord-audio-only";
  const toggle = document.querySelector("#blind-mode-switch, #audio-mode-toggle");
  const status = document.querySelector("#audio-mode-status");
  if (!toggle) return;

  let audioOnly = false;
  let speechToken = 0;

  function focusMainControl() {
    const main = document.querySelector("#main-content");
    if (main?.getAttribute("aria-hidden") === "true") {
      document.querySelector("#challenge-question")?.focus();
      return;
    }
    const firstSlider = main?.querySelector('input[type="range"]:not(:disabled)');
    if (firstSlider) firstSlider.focus();
    else main?.focus();
  }

  function applyMode(focusControl = false) {
    document.body.classList.toggle("audio-only-mode", audioOnly);
    toggle.setAttribute("aria-checked", String(audioOnly));
    if (audioOnly && focusControl) focusMainControl();
  }

  try {
    audioOnly = localStorage.getItem(STORAGE_KEY) === "true";
  } catch (error) {
    status.textContent = "Audio mode preference could not be loaded from this browser.";
    console.error("Could not read the audio-only mode preference.", error);
  }
  applyMode(audioOnly);

  toggle.addEventListener("click", () => {
    audioOnly = !audioOnly;
    applyMode(audioOnly);
    try {
      localStorage.setItem(STORAGE_KEY, String(audioOnly));
      status.textContent = audioOnly
        ? "Audio-only navigation is on. Focus moved to the main content or first control."
        : "Audio-only navigation is off.";
    } catch (error) {
      status.textContent = `Audio-only navigation is ${audioOnly ? "on" : "off"}, but this browser could not save the preference.`;
      console.error("Could not save the audio-only mode preference.", error);
    }
  });

  function setSliderValue(slider, key) {
    const minimum = Number(slider.min || 0);
    const maximum = Number(slider.max || 100);
    const step = slider.step === "any" ? (maximum - minimum) / 100 : Number(slider.step || 1);
    let value = Number(slider.value);
    if (key === "Home") value = minimum;
    else if (key === "End") value = maximum;
    else value += key === "ArrowRight" ? step : -step;
    value = Math.max(minimum, Math.min(maximum, value));
    const decimals = (slider.step.split(".")[1] || "").length;
    slider.value = String(Number(value.toFixed(decimals)));
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function spokenValue(text) {
    return text
      .replace(/₹\s*([\d,]+(?:\.\d+)?)/g, "$1 rupees")
      .replace(/\$/g, " dollars")
      .replace(/%/g, " percent");
  }

  function sliderReadout(slider) {
    const value = slider.value;
    if (slider.id === "year-slider") {
      const year = document.querySelector("#year-output")?.textContent || `Year ${value}`;
      const power = document.querySelector("#purchasing-power")?.textContent || "";
      const count = document.querySelector("#item-count")?.textContent || "";
      const countParts = count.match(/^(\d+)\s+of\s+(\d+)/);
      const countReadout = countParts
        ? `${countParts[1]} items remaining out of ${countParts[2]}.`
        : `${count} items remaining.`;
      return `${year}. Purchasing power ${spokenValue(power)}. ${countReadout}`;
    }

    if (slider.id === "inflation-range") {
      const year = document.querySelector("#year-output")?.textContent || "";
      const power = document.querySelector("#purchasing-power")?.textContent || "";
      const count = document.querySelector("#item-count")?.textContent || "";
      const countParts = count.match(/^(\d+)\s+of\s+(\d+)/);
      const countReadout = countParts
        ? `${countParts[1]} items remaining out of ${countParts[2]}.`
        : `${count} items remaining.`;
      return `Annual inflation rate ${value} percent. ${year}. Purchasing power ${spokenValue(power)}. ${countReadout}`;
    }

    if (slider.id === "supply-range" || slider.id === "demand-range") {
      const label = slider.getAttribute("aria-label") || "Market shift";
      const market = document.querySelector("#market-readout")?.textContent || "";
      return `${label}. Current shift ${value}. ${spokenValue(market)}`;
    }

    const monthMatch = slider.id.match(/^month-(\d+)-range$/);
    if (monthMatch) {
      const numberInput = document.querySelector(`#month-${monthMatch[1]}-number`);
      const label = numberInput?.getAttribute("aria-label") || "Exchange rate";
      const row = document.querySelector(`#data-rows tr:nth-child(${Number(monthMatch[1]) + 1})`);
      const trend = row?.cells[2]?.textContent || "";
      return `${label}. ${Number(value).toFixed(2)} Indian rupees per US dollar. ${trend}.`;
    }

    const label = slider.getAttribute("aria-label") ||
      document.querySelector(`label[for="${slider.id}"]`)?.textContent.trim() ||
      "Slider value";
    return `${label}. ${value}.`;
  }

  function dispatchReadoutComplete(slider) {
    window.dispatchEvent(new CustomEvent("monochord:audio-readout-complete", {
      detail: { inputId: slider.id, value: slider.value }
    }));
  }

  function speakSlider(slider) {
    const utteranceText = sliderReadout(slider);
    const token = ++speechToken;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      status.textContent = "Speech synthesis is not supported. Playing the selected data's sound.";
      dispatchReadoutComplete(slider);
      return;
    }

    window.dispatchEvent(new CustomEvent("monochord:audio-readout-start", {
      detail: { inputId: slider.id, value: slider.value }
    }));
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(utteranceText);
    utterance.rate = 0.92;
    utterance.onend = () => {
      if (token === speechToken) dispatchReadoutComplete(slider);
    };
    utterance.onerror = (event) => {
      if (token !== speechToken || event.error === "canceled" || event.error === "interrupted") return;
      status.textContent = "The selected value could not be spoken. Check browser speech settings.";
      console.error("Speech synthesis failed while reading a slider value.", event.error);
    };
    window.speechSynthesis.speak(utterance);
  }

  document.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        setSliderValue(slider, event.key);
      } else if (audioOnly && (event.key === " " || event.key === "Spacebar")) {
        event.preventDefault();
        speakSlider(slider);
      }
    });
  });

  if (audioOnly) {
    window.requestAnimationFrame(focusMainControl);
  }
})();
