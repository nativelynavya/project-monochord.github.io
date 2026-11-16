"use strict";

(() => {
  const chordModes = {
    major: [0, 4, 7]
  };
  const chordDuration = 0.62;
  const gapDuration = 0.08;
  let audioContext;
  let completionTimer;
  let toast;
  let toastMessage;

  function selectedNumbers() {
    const text = window.getSelection()?.toString() || "";
    const matches = text.matchAll(/(?:^|[^\w.])([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?![\w.])/g);
    return Array.from(matches, (match) => Number(match[1].replaceAll(",", "")))
      .filter(Number.isFinite);
  }

  function ensureToast() {
    if (toast?.isConnected) {
      return;
    }
    const host = document.createElement("div");
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .toast {
        position: fixed; z-index: 2147483647; top: 16px; right: 16px;
        display: flex; align-items: center; gap: 16px; max-width: min(460px, calc(100vw - 32px));
        padding: 14px 16px; border: 2px solid #fff; border-radius: 8px;
        background: #111; color: #fff; box-shadow: 0 4px 18px #0009;
        font: 700 15px/1.4 Arial, Helvetica, sans-serif;
      }
      .message { flex: 1; }
      button {
        flex: 0 0 auto; padding: 8px 12px; border: 2px solid #fff; border-radius: 4px;
        background: #fff; color: #111; font: inherit; cursor: pointer;
      }
      button:focus-visible { outline: 3px solid #ffdb4d; outline-offset: 3px; }
    `;
    const container = document.createElement("div");
    container.className = "toast";
    toastMessage = document.createElement("span");
    toastMessage.className = "message";
    toastMessage.setAttribute("role", "status");
    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.textContent = "Stop";
    stopButton.addEventListener("click", stopPlayback);
    container.append(toastMessage, stopButton);
    shadow.append(style, container);
    (document.body || document.documentElement).append(host);
    toast = host;
  }

  function setToastMessage(message, showStop = true) {
    ensureToast();
    toastMessage.textContent = message;
    const stopButton = toast.shadowRoot.querySelector("button");
    stopButton.hidden = !showStop;
  }

  function frequencyForMidi(note) {
    return 440 * (2 ** ((note - 69) / 12));
  }

  function addChordTone(context, note, startTime, duration) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endTime = startTime + duration;

    oscillator.type = "triangle";
    oscillator.frequency.value = frequencyForMidi(note);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.16, startTime + 0.025);
    gain.gain.setValueAtTime(0.16, endTime - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }

  function speakSummary(numbers) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }
    const { lowest, highest } = numbers.reduce((range, value) => ({
      lowest: Math.min(range.lowest, value),
      highest: Math.max(range.highest, value)
    }), { lowest: Infinity, highest: -Infinity });
    const utterance = new SpeechSynthesisUtterance(
      `Playing a chord progression for ${numbers.length} selected numbers, ranging from ${lowest} to ${highest}.`
    );
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function stopPlayback(showMessage = true) {
    window.clearTimeout(completionTimer);
    completionTimer = undefined;
    window.speechSynthesis?.cancel();
    const context = audioContext;
    audioContext = undefined;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch (error) {
        setToastMessage(`Could not stop audio: ${error.message || "audio playback failed."}`, false);
        return;
      }
    }
    if (showMessage) {
      setToastMessage("Sonification stopped.", false);
    }
  }

  async function playSelection() {
    const numbers = selectedNumbers();
    if (numbers.length === 0) {
      setToastMessage("Select one or more numbers first.", Boolean(audioContext));
      return;
    }
    await stopPlayback(false);

    const { lowest: minimum, highest: maximum } = numbers.reduce((range, value) => ({
      lowest: Math.min(range.lowest, value),
      highest: Math.max(range.highest, value)
    }), { lowest: Infinity, highest: -Infinity });
    const roots = numbers.map((value) => {
      const position = maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum);
      return 48 + Math.round(position * 24);
    });
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) {
      setToastMessage("Audio playback is not supported in this browser.", false);
      return;
    }

    try {
      audioContext = new AudioContextType();
      await audioContext.resume();
      const startTime = audioContext.currentTime + 0.03;
      roots.forEach((root, index) => {
        const chordStart = startTime + index * (chordDuration + gapDuration);
        chordModes.major.forEach((interval) => {
          addChordTone(audioContext, root + interval, chordStart, chordDuration);
        });
      });
      setToastMessage(`Playing ${numbers.length} selected numbers.`, true);
      speakSummary(numbers);
      completionTimer = window.setTimeout(async () => {
        const context = audioContext;
        audioContext = undefined;
        if (context && context.state !== "closed") {
          await context.close();
        }
        setToastMessage("Sonification complete.", false);
      }, roots.length * (chordDuration + gapDuration) * 1000);
    } catch (error) {
      const context = audioContext;
      audioContext = undefined;
      if (context && context.state !== "closed") {
        try {
          await context.close();
        } catch (closeError) {
          setToastMessage(`Could not close audio: ${closeError.message || "audio playback failed."}`, false);
          return;
        }
      }
      setToastMessage(`Could not play the selection: ${error.message || "audio playback failed."}`, false);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "sonify-selection") {
      void playSelection();
    }
  });
})();
