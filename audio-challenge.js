(() => {
  "use strict";

  const challenge = document.querySelector("#audio-challenge");
  if (!challenge) return;

  const challengeSets = {
    inflation: {
      choices: [
        { id: "steady", label: "Low inflation: prices rose slowly and most of the basket stayed affordable." },
        { id: "shock", label: "Severe inflation: purchasing power fell and items left the basket." },
        { id: "deflation", label: "Deflation: prices fell and the same money bought more." }
      ],
      scenarios: [
        {
          id: "steady",
          title: "Low Inflation (Steady Basket)",
          clue: "The bright major chords stayed steady, suggesting prices rose slowly and most of the basket remained affordable.",
          events: [
            { start: 0.08, duration: 0.72, notes: [261.63, 329.63, 392] },
            { start: 1.04, duration: 0.72, notes: [196, 246.94, 293.66] },
            { start: 2, duration: 0.78, notes: [174.61, 220, 261.63] }
          ]
        },
        {
          id: "shock",
          title: "Severe Inflation Shock",
          clue: "The chords stepped downward through darker minor and diminished intervals, then slowed—like purchasing power and the basket shrinking.",
          events: [
            { start: 0.06, duration: 0.42, notes: [220, 261.63, 329.63] },
            { start: 0.52, duration: 0.52, notes: [196, 233.08, 293.66] },
            { start: 1.18, duration: 0.64, notes: [164.81, 196, 233.08] },
            { start: 1.98, duration: 0.82, notes: [130.81, 155.56, 196] }
          ]
        },
        {
          id: "deflation",
          title: "Deflation / Rising Purchasing Power",
          clue: "The warm major chords climbed upward, suggesting prices fell and ₹1,000 could buy more over time.",
          events: [
            { start: 0.08, duration: 0.72, notes: [196, 246.94, 293.66] },
            { start: 1.04, duration: 0.72, notes: [220, 277.18, 329.63] },
            { start: 2, duration: 0.78, notes: [261.63, 329.63, 392] }
          ]
        }
      ]
    },
    market: {
      choices: [
        { id: "balanced", label: "Balanced Market Equilibrium" },
        { id: "shortage", label: "Inelastic Essential Good Shortage" },
        { id: "shift", label: "Mild Luxury Demand Shift" }
      ],
      scenarios: [
        {
          id: "balanced",
          title: "Balanced Market Equilibrium",
          clue: "The clean, consonant major chord resolved without tension, signaling supply and demand in balance.",
          events: [
            { start: 0.12, duration: 1.12, notes: [130.81, 164.81, 196, 261.63] },
            { start: 1.62, duration: 1.12, notes: [130.81, 164.81, 196, 261.63] }
          ]
        },
        {
          id: "shortage",
          title: "Inelastic Essential Good Shortage",
          clue: "The tight minor-second and tritone cluster sounded sharp and tense, signaling strong demand against limited supply for an essential good.",
          events: [
            { start: 0.05, duration: 0.5, notes: [130.81, 138.59, 184.99, 196] },
            { start: 0.62, duration: 0.62, notes: [146.83, 155.56, 207.65, 220] },
            { start: 1.34, duration: 0.76, notes: [164.81, 174.61, 233.08, 246.94] },
            { start: 2.2, duration: 0.62, notes: [174.61, 185, 246.94, 261.63] }
          ]
        },
        {
          id: "shift",
          title: "Mild Luxury Demand Shift",
          clue: "The gentle suspended notes leaned without becoming harsh, suggesting a mild demand shift for an elastic luxury good.",
          events: [
            { start: 0.12, duration: 1.12, notes: [196, 220, 293.66] },
            { start: 1.62, duration: 1.12, notes: [220, 246.94, 329.63] }
          ]
        }
      ]
    },
    currency: {
      choices: [
        { id: "appreciation", label: "Steady Currency Appreciation" },
        { id: "depreciation", label: "Sudden Currency Depreciation Shock" },
        { id: "stable", label: "Stable Exchange Rate" }
      ],
      scenarios: [
        {
          id: "appreciation",
          title: "Steady Currency Appreciation",
          clue: "The major chords rose step by step, signaling a steadily appreciating currency.",
          events: [
            { start: 0.06, duration: 0.38, notes: [130.81, 164.81, 196] },
            { start: 0.54, duration: 0.38, notes: [146.83, 185, 220] },
            { start: 1.02, duration: 0.38, notes: [164.81, 207.65, 246.94] },
            { start: 1.5, duration: 0.38, notes: [174.61, 220, 261.63] },
            { start: 1.98, duration: 0.38, notes: [196, 246.94, 293.66] },
            { start: 2.46, duration: 0.38, notes: [220, 277.18, 329.63] }
          ]
        },
        {
          id: "depreciation",
          title: "Sudden Currency Depreciation Shock",
          clue: "The sound dropped sharply through minor and diminished colors, signaling a sudden depreciation.",
          events: [
            { start: 0.06, duration: 0.48, notes: [293.66, 349.23, 440] },
            { start: 0.64, duration: 0.58, notes: [220, 261.63, 329.63] },
            { start: 1.34, duration: 0.68, notes: [164.81, 196, 233.08, 277.18] },
            { start: 2.14, duration: 0.7, notes: [130.81, 155.56, 196, 233.08] }
          ]
        },
        {
          id: "stable",
          title: "Stable Exchange Rate",
          clue: "The same tonic chord repeated at the same pitch, signaling a stable exchange rate.",
          events: [
            { start: 0.12, duration: 0.72, notes: [196, 246.94, 293.66] },
            { start: 1.12, duration: 0.72, notes: [196, 246.94, 293.66] },
            { start: 2.12, duration: 0.72, notes: [196, 246.94, 293.66] }
          ]
        }
      ]
    }
  };

  const settings = challengeSets[challenge.dataset.challenge];
  if (!settings) return;

  const main = document.querySelector("#main-content");
  const launchButton = document.querySelector("#challenge-start");
  const panel = document.querySelector("#challenge-panel");
  const question = document.querySelector("#challenge-question");
  const audioStatus = document.querySelector("#challenge-audio-status");
  const answerGroup = document.querySelector("#challenge-answers");
  const replayButton = document.querySelector("#challenge-replay");
  const anotherButton = document.querySelector("#challenge-another");
  const exitButton = document.querySelector("#challenge-exit");
  const feedback = document.querySelector("#challenge-feedback");
  const scoreOutput = document.querySelector("#challenge-score");
  const originalDisplay = main.style.display;
  const originalAriaHidden = main.getAttribute("aria-hidden");

  let audioContext;
  let activeVoices = [];
  let playbackTimer;
  let playbackToken = 0;
  let currentScenario;
  let previousScenarioIndex = -1;
  let hasAnswered = false;
  let correctCount = 0;
  let attemptCount = 0;

  function getAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return undefined;
    audioContext ??= new AudioContextConstructor();
    return audioContext;
  }

  function stopAudio() {
    window.clearTimeout(playbackTimer);
    playbackTimer = undefined;
    playbackToken += 1;
    const now = audioContext?.currentTime ?? 0;
    activeVoices.forEach((voice) => {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.08);
      try {
        voice.oscillator.stop(now + 0.1);
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
      }
    });
    activeVoices = [];
  }

  function setAnswerAvailability(available) {
    answerGroup.querySelectorAll("button").forEach((button) => {
      button.disabled = !available;
    });
  }

  function scheduleEvents(events, token, durationMs = 3000, completionMessage = "Soundscape complete. Choose the answer that best matches what you heard.") {
    const baseTime = audioContext.currentTime + 0.035;
    events.forEach((event) => {
      event.notes.forEach((frequency) => {
        const volume = 0.11 / event.notes.length;
        for (const [waveform, level] of [["triangle", volume * 0.68], ["sine", volume * 0.32]]) {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const voice = { oscillator, gain };
          const start = baseTime + event.start;
          const end = start + event.duration;
          const attack = Math.min(0.06, event.duration * 0.18);
          oscillator.type = waveform;
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(level, start + attack);
          gain.gain.setValueAtTime(level, end - 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.addEventListener("ended", () => {
            activeVoices = activeVoices.filter((active) => active !== voice);
          }, { once: true });
          oscillator.start(start);
          oscillator.stop(end + 0.015);
          activeVoices.push(voice);
        }
      });
    });
    playbackTimer = window.setTimeout(() => {
      if (token !== playbackToken) return;
      playbackTimer = undefined;
      replayButton.disabled = false;
      if (!hasAnswered) setAnswerAvailability(true);
      audioStatus.textContent = completionMessage;
    }, durationMs);
  }

  function chooseScenario() {
    let index = Math.floor(Math.random() * settings.scenarios.length);
    if (settings.scenarios.length > 1 && index === previousScenarioIndex) {
      index = (index + 1 + Math.floor(Math.random() * (settings.scenarios.length - 1))) % settings.scenarios.length;
    }
    previousScenarioIndex = index;
    currentScenario = settings.scenarios[index];
  }

  function renderAnswers() {
    answerGroup.replaceChildren();
    settings.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.disabled = true;
      button.addEventListener("click", () => answer(choice.id));
      answerGroup.append(button);
    });
  }

  async function playSoundscape() {
    stopAudio();
    const token = playbackToken;
    setAnswerAvailability(false);
    replayButton.disabled = true;
    audioStatus.textContent = "Playing the 3-second soundscape. Listen before choosing.";

    try {
      const context = getAudioContext();
      if (!context) {
        setAnswerAvailability(true);
        replayButton.disabled = false;
        audioStatus.textContent = "Audio is not supported in this browser. You can still answer using the visible choices.";
        return;
      }
      await context.resume();
      if (token !== playbackToken) return;
      scheduleEvents(currentScenario.events, token);
    } catch (error) {
      if (token !== playbackToken) return;
      setAnswerAvailability(true);
      replayButton.disabled = false;
      audioStatus.textContent = "The soundscape could not play. Check browser audio settings and try again.";
      console.error("Could not play the assessment soundscape.", error);
    }
  }

  function playFeedbackTone(correct) {
    stopAudio();
    const token = playbackToken;
    try {
      const context = getAudioContext();
      if (!context || context.state !== "running") return;
      const events = correct
        ? [{ start: 0, duration: 0.2, notes: [523.25, 659.25, 783.99] },
          { start: 0.2, duration: 0.3, notes: [659.25, 783.99, 987.77] }]
        : [{ start: 0, duration: 0.24, notes: [220, 261.63] },
          { start: 0.27, duration: 0.3, notes: [196, 233.08] }];
      scheduleEvents(events, token, 700, "Feedback tone complete.");
    } catch (error) {
      console.error("Could not play assessment feedback.", error);
    }
  }

  function answer(choiceId) {
    if (hasAnswered || !currentScenario) return;
    hasAnswered = true;
    attemptCount += 1;
    const correct = choiceId === currentScenario.id;
    if (correct) correctCount += 1;
    setAnswerAvailability(false);
    replayButton.disabled = false;
    anotherButton.hidden = false;
    const result = correct ? "Correct!" : "Not quite.";
    feedback.textContent = `${result} The soundscape was ${currentScenario.title}. ${currentScenario.clue}`;
    feedback.hidden = false;
    scoreOutput.textContent = `Score: ${correctCount} correct out of ${attemptCount} answered.`;
    playFeedbackTone(correct);
  }

  async function startChallenge() {
    window.dispatchEvent(new Event("monochord:stop-audio"));
    main.style.display = "none";
    main.setAttribute("aria-hidden", "true");
    launchButton.hidden = true;
    panel.hidden = false;
    hasAnswered = false;
    feedback.hidden = true;
    feedback.textContent = "";
    anotherButton.hidden = true;
    chooseScenario();
    renderAnswers();
    question.focus();
    await playSoundscape();
  }

  function tryAnother() {
    stopAudio();
    hasAnswered = false;
    feedback.hidden = true;
    feedback.textContent = "";
    anotherButton.hidden = true;
    chooseScenario();
    renderAnswers();
    void playSoundscape();
  }

  function exitChallenge() {
    stopAudio();
    panel.hidden = true;
    launchButton.hidden = false;
    main.style.display = originalDisplay;
    if (originalAriaHidden === null) main.removeAttribute("aria-hidden");
    else main.setAttribute("aria-hidden", originalAriaHidden);
    launchButton.focus();
  }

  launchButton.addEventListener("click", () => void startChallenge());
  replayButton.addEventListener("click", () => void playSoundscape());
  anotherButton.addEventListener("click", tryAnother);
  exitButton.addEventListener("click", exitChallenge);
})();
