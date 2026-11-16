(() => {
  "use strict";

  const MAX_POINTS = 40;
  const MIN_VALUE = -1000000;
  const MAX_VALUE = 1000000;
  const SAMPLE_RATE = 44100;
  const CHORD_DURATION = 0.42;
  const CHORD_GAP = 0.12;
  const MAJOR = [0, 4, 7];
  const MINOR = [0, 3, 7];
  const DIMINISHED = [0, 3, 6];
  const PRESETS = {
    ppf: {
      title: "Production Possibility Frontier",
      xLabel: "Consumer Goods",
      yLabel: "Capital Goods (units)",
      xValues: ["0", "20", "40", "60", "80"],
      curveALabel: "Initial PPF",
      curveA: [100, 90, 75, 50, 0],
      curveBLabel: "Shifted PPF",
      curveB: [100, 100, 90, 70, 35]
    },
    "cost-revenue": {
      title: "Marginal Cost vs. Marginal Revenue",
      xLabel: "Quantity (units)",
      yLabel: "Cost / Revenue (₹)",
      xValues: ["1", "2", "3", "4", "5", "6"],
      curveALabel: "Marginal Cost",
      curveA: [12, 16, 22, 32, 48, 70],
      curveBLabel: "Marginal Revenue",
      curveB: [64, 56, 48, 40, 32, 24]
    },
    "tax-incidence": {
      title: "Tax Incidence",
      xLabel: "Quantity (units)",
      yLabel: "Price (₹)",
      xValues: ["0", "20", "40", "60", "80", "100"],
      curveALabel: "Price Buyers Pay",
      curveA: [10, 12, 14, 16, 18, 20],
      curveBLabel: "Price Sellers Receive",
      curveB: [10, 9, 8, 7, 6, 5]
    }
  };
  const DEFAULT_CONFIG = PRESETS.ppf;
  const form = document.querySelector("#graph-form");
  const titleInput = document.querySelector("#graph-title");
  const xLabelInput = document.querySelector("#x-label");
  const yLabelInput = document.querySelector("#y-label");
  const xValuesInput = document.querySelector("#x-values");
  const curveALabelInput = document.querySelector("#curve-a-label");
  const curveAInput = document.querySelector("#curve-a-values");
  const curveBLabelInput = document.querySelector("#curve-b-label");
  const curveBInput = document.querySelector("#curve-b-values");
  const presetInput = document.querySelector("#economics-preset");
  const importInput = document.querySelector("#table-import");
  const chart = document.querySelector("#interactive-chart");
  const svg = document.querySelector("#graph-svg");
  const svgTitle = document.querySelector("#svg-title");
  const svgDescription = document.querySelector("#svg-description");
  const grid = document.querySelector("#graph-grid");
  const curveAElement = document.querySelector("#graph-curve-a");
  const curveBElement = document.querySelector("#graph-curve-b");
  const pointsGroup = document.querySelector("#graph-points");
  const labelsGroup = document.querySelector("#graph-labels");
  const pointReadout = document.querySelector("#point-readout");
  const status = document.querySelector("#studio-status");
  const playButton = document.querySelector("#play-curve");
  const stopButton = document.querySelector("#stop-curve");
  const downloadButton = document.querySelector("#download-wav");
  const copyButton = document.querySelector("#copy-link");
  const dataRows = document.querySelector("#graph-data-rows");
  const xTableHeading = document.querySelector("#x-table-heading");
  const curveATableHeading = document.querySelector("#curve-a-table-heading");
  const curveBTableHeading = document.querySelector("#curve-b-table-heading");
  const plot = { left: 90, right: 690, top: 35, bottom: 315 };
  let config = makeConfig(DEFAULT_CONFIG);
  let selectedIndex = 0;
  let audioContext;
  let activeOscillators = [];
  let playbackToken = 0;
  let importTimer;
  let importRequest = 0;
  let speechToken = 0;

  function makeConfig(source) {
    return {
      title: source.title,
      xLabel: source.xLabel,
      yLabel: source.yLabel,
      xValues: [...source.xValues],
      curveALabel: source.curveALabel,
      curveA: [...source.curveA],
      curveBLabel: source.curveBLabel,
      curveB: source.curveB ? [...source.curveB] : null
    };
  }

  function createSvgElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, String(value));
    }
    return element;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 5 }).format(value);
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function valuesInForm(input, label, minCount = 2) {
    const values = input.value.split(",").map((value) => value.trim());
    if (values.length < minCount || values.length > MAX_POINTS || values.some((value) => value === "")) {
      throw new Error(`${label} must contain between ${minCount} and ${MAX_POINTS} comma-separated values.`);
    }
    return values.map((text) => {
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
        throw new Error(`${label} must contain only finite numbers.`);
      }
      const value = Number(text);
      if (!Number.isFinite(value) || value < MIN_VALUE || value > MAX_VALUE) {
        throw new Error(`${label} values must be between ${MIN_VALUE} and ${MAX_VALUE}.`);
      }
      return value;
    });
  }

  function readForm() {
    const requiredText = [
      [titleInput, "Enter a graph title."],
      [xLabelInput, "Enter an X-axis label."],
      [yLabelInput, "Enter a Y-axis label."],
      [curveALabelInput, "Enter a name for Curve A."]
    ];
    const missing = requiredText.find(([input]) => !input.value.trim());
    if (missing) {
      throw new Error(missing[1]);
    }
    const xValues = xValuesInput.value.split(",").map((value) => value.trim());
    if (xValues.length < 2 || xValues.length > MAX_POINTS || xValues.some((value) => !value)) {
      throw new Error(`X-axis values must contain between 2 and ${MAX_POINTS} comma-separated values.`);
    }
    const curveA = valuesInForm(curveAInput, "Curve A");
    const curveB = curveBInput.value.trim()
      ? valuesInForm(curveBInput, "Curve B")
      : null;
    if (xValues.length !== curveA.length || (curveB && curveB.length !== curveA.length)) {
      throw new Error("X-axis values and each curve must have the same number of points.");
    }
    if (curveB && !curveBLabelInput.value.trim()) {
      throw new Error("Enter a name for Curve B.");
    }
    return {
      title: titleInput.value.trim(),
      xLabel: xLabelInput.value.trim(),
      yLabel: yLabelInput.value.trim(),
      xValues,
      curveALabel: curveALabelInput.value.trim(),
      curveA,
      curveBLabel: curveBLabelInput.value.trim() || "Curve B",
      curveB
    };
  }

  function updateConfigFromForm(message = "Graph updated. Explore it with the arrow keys or Play Curve.") {
    stopPlayback("");
    config = readForm();
    selectedIndex = 0;
    updateChart();
    setStatus(message);
  }

  function allYValues() {
    return config.curveB ? [...config.curveA, ...config.curveB] : config.curveA;
  }

  function updateChart() {
    const yValues = allYValues();
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const padding = max === min ? Math.max(Math.abs(max) * 0.1, 1) : (max - min) * 0.12;
    const lower = min - padding;
    const upper = max + padding;
    const numericXValues = config.xValues.map(Number);
    const numericXMin = Math.min(...numericXValues);
    const numericXMax = Math.max(...numericXValues);
    const useNumericX = numericXValues.every(Number.isFinite) && numericXMin !== numericXMax;
    const xAt = (index) => {
      const position = useNumericX
        ? (numericXValues[index] - numericXMin) / (numericXMax - numericXMin)
        : index / (config.xValues.length - 1);
      return plot.left + position * (plot.right - plot.left);
    };
    const yAt = (value) => plot.bottom - ((value - lower) / (upper - lower)) * (plot.bottom - plot.top);

    grid.replaceChildren();
    pointsGroup.replaceChildren();
    labelsGroup.replaceChildren();
    for (let step = 0; step <= 4; step += 1) {
      const value = upper - ((upper - lower) * step) / 4;
      const y = yAt(value);
      grid.append(createSvgElement("line", {
        x1: plot.left, x2: plot.right, y1: y, y2: y, class: "studio-grid-line"
      }));
      const tick = createSvgElement("text", {
        x: plot.left - 10, y: y + 5, "text-anchor": "end", class: "studio-tick-label"
      });
      tick.textContent = formatNumber(value);
      labelsGroup.append(tick);
    }

    const xTickIndexes = [...new Set([0, Math.floor((config.xValues.length - 1) / 2), config.xValues.length - 1])];
    xTickIndexes.forEach((index) => {
      const x = xAt(index);
      grid.append(createSvgElement("line", {
        x1: x, x2: x, y1: plot.top, y2: plot.bottom, class: "studio-grid-line"
      }));
      const tick = createSvgElement("text", {
        x, y: plot.bottom + 24, "text-anchor": "middle", class: "studio-tick-label"
      });
      tick.textContent = config.xValues[index];
      labelsGroup.append(tick);
    });

    curveAElement.setAttribute(
      "points",
      config.curveA.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ")
    );
    curveBElement.setAttribute(
      "points",
      config.curveB
        ? config.curveB.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ")
        : ""
    );
    [config.curveA, config.curveB].filter(Boolean).forEach((values, curveIndex) => {
      values.forEach((value, index) => {
        pointsGroup.append(createSvgElement("circle", {
          cx: xAt(index),
          cy: yAt(value),
          r: index === selectedIndex ? 8 : 5,
          class: `studio-point studio-point-${curveIndex === 0 ? "a" : "b"}${index === selectedIndex ? " is-selected" : ""}`
        }));
      });
    });

    const xAxisLabel = createSvgElement("text", {
      x: (plot.left + plot.right) / 2,
      y: 390,
      "text-anchor": "middle",
      class: "studio-axis-label"
    });
    xAxisLabel.textContent = config.xLabel;
    const yAxisLabel = createSvgElement("text", {
      x: 22,
      y: (plot.top + plot.bottom) / 2,
      transform: `rotate(-90 22 ${(plot.top + plot.bottom) / 2})`,
      "text-anchor": "middle",
      class: "studio-axis-label"
    });
    yAxisLabel.textContent = config.yLabel;
    labelsGroup.append(xAxisLabel, yAxisLabel);

    const summary = `${config.title}. ${config.xValues.length} points. ` +
      `${config.xLabel} from ${config.xValues[0]} to ${config.xValues.at(-1)}. ` +
      `${config.curveALabel} ranges from ${formatNumber(Math.min(...config.curveA))} to ${formatNumber(Math.max(...config.curveA))}.` +
      (config.curveB
        ? ` ${config.curveBLabel} ranges from ${formatNumber(Math.min(...config.curveB))} to ${formatNumber(Math.max(...config.curveB))}.`
        : "");
    svgTitle.textContent = config.title;
    svgDescription.textContent = summary;
    svg.setAttribute("aria-label", summary);
    chart.setAttribute("aria-label", `Interactive graph: ${summary}`);
    document.querySelector("#rendered-title").textContent = config.title;
    document.querySelector("#curve-a-legend").textContent = config.curveALabel;
    document.querySelector("#curve-b-legend").textContent = config.curveBLabel;
    document.querySelector("#curve-b-legend-item").hidden = !config.curveB;
    xTableHeading.textContent = config.xLabel;
    curveATableHeading.textContent = config.curveALabel;
    curveBTableHeading.textContent = config.curveB ? config.curveBLabel : "Curve B (not plotted)";
    curveBTableHeading.hidden = !config.curveB;
    document.querySelectorAll(".studio-table-curve-b").forEach((cell) => {
      cell.hidden = !config.curveB;
    });
    updateTable();
    announcePoint();
  }

  function pitchFor(value) {
    const values = allYValues();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const position = max === min ? 0.5 : (value - min) / (max - min);
    return 48 + Math.round(position * 24);
  }

  function updateTable() {
    dataRows.replaceChildren();
    config.xValues.forEach((xValue, index) => {
      const row = document.createElement("tr");
      if (index === selectedIndex) row.setAttribute("aria-current", "true");
      const pointCell = document.createElement("th");
      pointCell.scope = "row";
      pointCell.textContent = `Point ${index + 1}`;
      const xCell = document.createElement("td");
      xCell.textContent = xValue;
      const aCell = document.createElement("td");
      aCell.textContent = String(config.curveA[index]);
      const bCell = document.createElement("td");
      bCell.className = "studio-table-curve-b";
      bCell.textContent = config.curveB ? String(config.curveB[index]) : "—";
      bCell.hidden = !config.curveB;
      row.append(pointCell, xCell, aCell, bCell);
      dataRows.append(row);
    });
  }

  function pointSummary() {
    const index = selectedIndex;
    const valueA = config.curveA[index];
    const text = `Point ${index + 1} of ${config.xValues.length}. ${config.xLabel} ${config.xValues[index]}. ` +
      `${config.curveALabel} ${formatNumber(valueA)}${config.curveB ? `; ${config.curveBLabel} ${formatNumber(config.curveB[index])}` : ""}.`;
    return text;
  }

  function announcePoint() {
    pointReadout.textContent = pointSummary();
  }

  function selectPoint(index) {
    selectedIndex = Math.max(0, Math.min(config.xValues.length - 1, index));
    updateChart();
  }

  function chordForPoint(index) {
    const valueA = config.curveA[index];
    const previousA = config.curveA[Math.max(0, index - 1)];
    const nextA = config.curveA[Math.min(config.curveA.length - 1, index + 1)];
    const slope = index === 0 ? nextA - valueA : valueA - previousA;
    const steepness = Math.abs(slope) / Math.max(1, Math.max(...allYValues()) - Math.min(...allYValues()));
    const quality = slope > 0
      ? MAJOR
      : slope < 0 ? (steepness > 0.2 ? DIMINISHED : MINOR) : MAJOR;
    const root = pitchFor(valueA);
    if (!config.curveB) {
      return { notes: quality.map((interval) => root + interval), message: "single curve" };
    }
    const valueB = config.curveB[index];
    const range = Math.max(1, Math.max(...allYValues()) - Math.min(...allYValues()));
    const gap = Math.abs(valueA - valueB) / range;
    const previousGap = index > 0
      ? Math.abs(config.curveA[index - 1] - config.curveB[index - 1]) / range
      : gap;
    const nextGap = index < config.curveA.length - 1
      ? Math.abs(config.curveA[index + 1] - config.curveB[index + 1]) / range
      : gap;
    const gapChange = Math.abs(nextGap - previousGap);
    const difference = valueA - valueB;
    const crossesCurve = (neighborIndex) => {
      const neighboringDifference = config.curveA[neighborIndex] - config.curveB[neighborIndex];
      return difference === 0 || difference * neighboringDifference < 0;
    };
    const crossesIntersection =
      (index > 0 && crossesCurve(index - 1)) ||
      (index < config.curveA.length - 1 && crossesCurve(index + 1));
    const consonant = gap <= 0.06 || gapChange <= 0.015 || crossesIntersection;
    const intervals = consonant
      ? MAJOR
      : gap > 0.24 ? [0, 1, 6] : [0, 2, 7];
    const secondRoot = pitchFor(valueB);
    const notes = consonant
      ? [...intervals.map((interval) => root + interval), secondRoot]
      : [...intervals.map((interval) => root + interval), secondRoot, secondRoot + 1];
    return { notes, message: consonant ? "resolved curves" : "curves in tension" };
  }

  function addChordTone(context, destination, note, startTime, duration) {
    const frequency = 440 * (2 ** ((note - 69) / 12));
    const endTime = startTime + duration;
    const voice = context.createGain();
    voice.gain.setValueAtTime(0.0001, startTime);
    voice.gain.linearRampToValueAtTime(0.055, startTime + 0.04);
    voice.gain.setValueAtTime(0.055, endTime - 0.09);
    voice.gain.exponentialRampToValueAtTime(0.0001, endTime);
    voice.connect(destination);
    const oscillators = [];
    [["triangle", 0.68], ["sine", 0.32]].forEach(([type, level]) => {
      const oscillator = context.createOscillator();
      const layerGain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);
      layerGain.gain.value = level;
      oscillator.connect(layerGain);
      layerGain.connect(voice);
      oscillator.start(startTime);
      oscillator.stop(endTime + 0.015);
      oscillators.push(oscillator);
    });
    return oscillators;
  }

  function playChord(notes, context, token) {
    return new Promise((resolve, reject) => {
      if (token !== playbackToken || !context || context.state === "closed") {
        resolve();
        return;
      }
      const start = context.currentTime + 0.02;
      const voices = notes.flatMap((note) => addChordTone(context, context.destination, note, start, CHORD_DURATION));
      let pending = voices.length;
      activeOscillators = voices;
      voices.forEach((oscillator) => {
        oscillator.addEventListener("ended", () => {
          pending -= 1;
          if (pending === 0) {
            activeOscillators = [];
            resolve();
          }
        }, { once: true });
        oscillator.addEventListener("error", reject, { once: true });
      });
    });
  }

  function stopPlayback(message = "Curve playback stopped.") {
    playbackToken += 1;
    speechToken += 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    activeOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
      }
    });
    activeOscillators = [];
    playButton.disabled = false;
    stopButton.disabled = true;
    if (message) setStatus(message);
  }

  async function playSelectedPoint() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      setStatus("Audio playback is not supported in this browser. The graph and spoken readout remain available.");
      return;
    }
    const token = playbackToken;
    try {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      audioContext ??= new AudioContextType();
      await audioContext.resume();
      if (token === playbackToken) {
        const chord = chordForPoint(selectedIndex);
        setStatus(`Playing ${chord.message} chord at point ${selectedIndex + 1}.`);
        await playChord(chord.notes, audioContext, token);
      }
    } catch (error) {
      if (token === playbackToken) {
        setStatus("The selected point's chord could not be played. Check browser audio settings and try again.");
      }
      console.error("Could not preview the selected graph chord.", error);
    }
  }

  function speakThenPlayPoint() {
    const token = ++speechToken;
    if (!document.body.classList.contains("audio-only-mode") ||
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)) {
      void playSelectedPoint();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(pointSummary());
    utterance.rate = 0.92;
    utterance.onend = () => {
      if (token === speechToken) void playSelectedPoint();
    };
    utterance.onerror = (event) => {
      if (token === speechToken && event.error !== "canceled" && event.error !== "interrupted") {
        setStatus("The selected values could not be spoken. Check browser speech settings.");
        console.error("Speech synthesis failed while reading graph values.", event.error);
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  async function playCurve() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      setStatus("Audio playback is not supported in this browser. The graph and WAV export remain available.");
      return;
    }
    stopPlayback("");
    const token = playbackToken;
    try {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      audioContext ??= new AudioContextType();
      await audioContext.resume();
      if (token !== playbackToken) return;
      playButton.disabled = true;
      stopButton.disabled = false;
      setStatus("Playing the chord progression.");
      for (let index = 0; index < config.xValues.length; index += 1) {
        if (token !== playbackToken) return;
        selectPoint(index);
        await playChord(chordForPoint(index).notes, audioContext, token);
        if (token !== playbackToken) return;
        await new Promise((resolve) => window.setTimeout(resolve, CHORD_GAP * 1000));
      }
      if (token === playbackToken) stopPlayback("Chord progression complete.");
    } catch (error) {
      if (token === playbackToken) stopPlayback("Audio playback could not start. Check browser audio settings and try again.");
      console.error("Could not play the custom graph progression.", error);
    }
  }

  function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  }

  function encodeWav(buffer) {
    const channelCount = buffer.numberOfChannels;
    const frameCount = buffer.length;
    const bytesPerSample = 2;
    const dataSize = frameCount * channelCount * bytesPerSample;
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);
    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true);
    view.setUint16(32, channelCount * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);
    const channels = Array.from({ length: channelCount }, (_, channel) => buffer.getChannelData(channel));
    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
        view.setInt16(
          44 + (frame * channelCount + channel) * bytesPerSample,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
      }
    }
    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  async function downloadWav() {
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineContext) {
      setStatus("WAV rendering is not supported in this browser. Try a current version of Chrome, Firefox, Safari, or Edge.");
      return;
    }
    downloadButton.disabled = true;
    setStatus("Rendering the chord progression as a WAV file.");
    try {
      const duration = config.xValues.length * (CHORD_DURATION + CHORD_GAP) + 0.1;
      const offlineContext = new OfflineContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
      config.xValues.forEach((_, index) => {
        const start = index * (CHORD_DURATION + CHORD_GAP);
        chordForPoint(index).notes.forEach((note) => {
          addChordTone(offlineContext, offlineContext.destination, note, start, CHORD_DURATION);
        });
      });
      const renderedAudio = await offlineContext.startRendering();
      const url = URL.createObjectURL(encodeWav(renderedAudio));
      const link = document.createElement("a");
      const filename = config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-graph";
      link.href = url;
      link.download = `${filename}.wav`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus("WAV download created. Add the file to your presentation slides.");
    } catch (error) {
      setStatus("The WAV file could not be rendered. Try a shorter graph or another browser.");
      console.error("Could not render a WAV file for the custom graph.", error);
    } finally {
      downloadButton.disabled = false;
    }
  }

  async function copyShareableLink() {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("title", config.title);
    url.searchParams.set("xLabel", config.xLabel);
    url.searchParams.set("yLabel", config.yLabel);
    url.searchParams.set("xValues", config.xValues.join(","));
    url.searchParams.set("curveALabel", config.curveALabel);
    url.searchParams.set("curveA", config.curveA.join(","));
    url.searchParams.set("curveBLabel", config.curveBLabel);
    if (config.curveB) url.searchParams.set("curveB", config.curveB.join(","));
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url.href);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = url.href;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) throw new Error("Clipboard access is unavailable.");
      }
      setStatus("Shareable graph link copied to the clipboard.");
    } catch (error) {
      setStatus("Could not copy the link. Check clipboard permissions and try again.");
      console.error("Could not copy the custom graph link.", error);
    }
  }

  function parseDelimitedLine(line, delimiter) {
    const fields = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"' && quoted) {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        fields.push(field.trim());
        field = "";
      } else {
        field += character;
      }
    }
    if (quoted) throw new Error("Check the pasted table for an unclosed quoted field.");
    fields.push(field.trim());
    return fields;
  }

  function parseTable(text) {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2 || lines.length > MAX_POINTS + 1) {
      throw new Error(`Paste a header and 2–${MAX_POINTS} rows of table data.`);
    }
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    let rows = lines.map((line) => parseDelimitedLine(line, delimiter));
    const width = rows[0].length;
    if (![2, 3].includes(width) || rows.some((row) => row.length !== width)) {
      throw new Error("Each table row must have exactly two or three columns: X, Curve A, and optional Curve B.");
    }
    let headers = ["X", "Curve A", "Curve B"];
    if (rows[0].slice(1).some((value) => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) {
      headers = rows.shift().map((header, index) => header || headers[index]);
    }
    if (rows.length < 2 || rows.length > MAX_POINTS) {
      throw new Error(`The table must contain 2–${MAX_POINTS} data rows.`);
    }
    const xValues = [];
    const curveA = [];
    const curveB = [];
    rows.forEach((row) => {
      const xValue = row[0].trim();
      if (!row[1].trim() || (width === 3 && !row[2].trim())) {
        throw new Error("Every curve data cell must contain a number.");
      }
      const a = Number(row[1]);
      const b = width === 3 ? Number(row[2]) : undefined;
      if (!xValue || !Number.isFinite(a) || Math.abs(a) > MAX_VALUE ||
          (width === 3 && (!Number.isFinite(b) || Math.abs(b) > MAX_VALUE))) {
        throw new Error(`Table values must be finite numbers no larger than ${MAX_VALUE} in magnitude.`);
      }
      xValues.push(xValue);
      curveA.push(a);
      if (width === 3) curveB.push(b);
    });
    return {
      xValues,
      curveA,
      curveB: width === 3 ? curveB : null,
      xLabel: headers[0] || "X",
      curveALabel: headers[1] || "Curve A",
      curveBLabel: headers[2] || "Curve B"
    };
  }

  function applyImportedTable(table) {
    xValuesInput.value = table.xValues.join(", ");
    curveAInput.value = table.curveA.join(", ");
    curveBInput.value = table.curveB ? table.curveB.join(", ") : "";
    xLabelInput.value = table.xLabel;
    curveALabelInput.value = table.curveALabel;
    curveBLabelInput.value = table.curveBLabel;
    presetInput.value = "";
    updateConfigFromForm(`Imported ${table.xValues.length} points from the pasted table.`);
  }

  function sheetCsvUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com") return null;
    const match = url.pathname.match(/^\/spreadsheets\/d\/(e\/)?([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Use a Google Sheets spreadsheet URL.");
    const [, published, id] = match;
    const gid = url.searchParams.get("gid") || new URLSearchParams(url.hash.slice(1)).get("gid");
    if (published) {
      const csvUrl = new URL(`/spreadsheets/d/e/${id}/pub`, url.origin);
      csvUrl.searchParams.set("output", "csv");
      if (gid) csvUrl.searchParams.set("gid", gid);
      return csvUrl.href;
    }
    const csvUrl = new URL(`/spreadsheets/d/${id}/export`, url.origin);
    csvUrl.searchParams.set("format", "csv");
    if (gid) csvUrl.searchParams.set("gid", gid);
    return csvUrl.href;
  }

  async function importGoogleSheet(value) {
    let url;
    try {
      url = sheetCsvUrl(value);
    } catch (error) {
      setStatus(error.message);
      return;
    }
    if (!url) return;
    const request = ++importRequest;
    setStatus("Loading the public Google Sheet…");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Sheets returned ${response.status}. Check that the sheet is public.`);
      const csv = await response.text();
      if (/^\s*<(?:!doctype|html)\b/i.test(csv)) {
        throw new Error("Google Sheets did not return CSV. Check that the sheet is public.");
      }
      if (request !== importRequest) return;
      const table = parseTable(csv);
      applyImportedTable(table);
      importInput.value = csv;
    } catch (error) {
      if (request === importRequest) {
        setStatus(error.message || "Could not load the public Google Sheet.");
      }
    }
  }

  function handleImportInput() {
    window.clearTimeout(importTimer);
    importRequest += 1;
    const value = importInput.value.trim();
    if (!value) return;
    try {
      const url = sheetCsvUrl(value);
      if (url) {
        setStatus("Public Google Sheet detected. Loading CSV…");
        importTimer = window.setTimeout(() => void importGoogleSheet(value), 450);
        return;
      }
    } catch (error) {
      setStatus(error.message);
      return;
    }
    if (!value.includes("\n") && !value.includes("\t")) return;
    try {
      applyImportedTable(parseTable(value));
    } catch (error) {
      setStatus(error.message);
    }
  }

  function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    titleInput.value = preset.title;
    xLabelInput.value = preset.xLabel;
    yLabelInput.value = preset.yLabel;
    xValuesInput.value = preset.xValues.join(", ");
    curveALabelInput.value = preset.curveALabel;
    curveAInput.value = preset.curveA.join(", ");
    curveBLabelInput.value = preset.curveBLabel;
    curveBInput.value = preset.curveB.join(", ");
    updateConfigFromForm(`${preset.title} preset loaded.`);
  }

  function loadSharedGraph() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("title")) return;
    titleInput.value = params.get("title");
    xLabelInput.value = params.get("xLabel") || "X";
    yLabelInput.value = params.get("yLabel") || "Value";
    if (params.has("xValues")) {
      xValuesInput.value = params.get("xValues");
      curveALabelInput.value = params.get("curveALabel") || "Curve A";
      curveAInput.value = params.get("curveA") || "";
      curveBLabelInput.value = params.get("curveBLabel") || "Curve B";
      curveBInput.value = params.get("curveB") || "";
    } else {
      const oldValues = params.get("values");
      if (oldValues) {
        const values = oldValues.split(",");
        xValuesInput.value = values.map((_, index) => String(index + 1)).join(", ");
        curveAInput.value = oldValues;
        curveALabelInput.value = params.get("yLabel") || "Curve A";
        curveBInput.value = "";
      }
    }
    try {
      updateConfigFromForm("Shared graph loaded. Explore it with the arrow keys or Play Curve.");
    } catch (error) {
      setStatus(`The shared graph link is invalid: ${error.message} The example graph is shown until you update the fields.`);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      updateConfigFromForm();
    } catch (error) {
      setStatus(error.message);
    }
  });
  chart.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stopPlayback("");
    selectPoint(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
    speakThenPlayPoint();
  });
  playButton.addEventListener("click", () => void playCurve());
  stopButton.addEventListener("click", () => stopPlayback());
  downloadButton.addEventListener("click", () => void downloadWav());
  copyButton.addEventListener("click", () => void copyShareableLink());
  presetInput.addEventListener("change", () => loadPreset(presetInput.value));
  importInput.addEventListener("input", handleImportInput);

  titleInput.value = config.title;
  xLabelInput.value = config.xLabel;
  yLabelInput.value = config.yLabel;
  xValuesInput.value = config.xValues.join(", ");
  curveALabelInput.value = config.curveALabel;
  curveAInput.value = config.curveA.join(", ");
  curveBLabelInput.value = config.curveBLabel;
  curveBInput.value = "";
  config.curveB = null;
  updateChart();
  loadSharedGraph();
})();
