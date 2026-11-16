"use strict";

const chordModes = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  suspended: [0, 5, 7],
  seventh: [0, 4, 7, 10]
};
const chordDuration = 0.62;
const gapDuration = 0.08;
const titleInput = document.querySelector("#graph-title");
const valuesInput = document.querySelector("#data-values");
const modeInput = document.querySelector("#chord-mode");
const previewButton = document.querySelector("#preview-button");
const exportButton = document.querySelector("#export-button");
const status = document.querySelector("#status");
let previewContext;
let previewTimer;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

function getGraphData() {
  const title = titleInput.value.trim();
  const rawValues = valuesInput.value.split(",").map((value) => value.trim());
  if (!title) {
    throw new Error("Enter a graph title.");
  }
  if (rawValues.some((value) => value === "")) {
    throw new Error("Check the data: separate each number with a comma.");
  }
  if (rawValues.length > 64) {
    throw new Error("Use 64 numbers or fewer for a quick browser export.");
  }

  const values = rawValues.map(Number);
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Enter one or more valid finite numbers.");
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const roots = values.map((value) => {
    const position = maximum === minimum ? 0.5 : (value - minimum) / (maximum - minimum);
    return 48 + Math.round(position * 24);
  });
  return { title, roots, intervals: chordModes[modeInput.value] };
}

function frequencyForMidi(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

function addChordTone(context, destination, note, startTime, duration) {
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
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.01);
}

function scheduleProgression(context, destination, graph, startTime) {
  graph.roots.forEach((root, index) => {
    const chordStart = startTime + index * (chordDuration + gapDuration);
    graph.intervals.forEach((interval) => {
      addChordTone(context, destination, root + interval, chordStart, chordDuration);
    });
  });
}

function getDuration(rootCount) {
  return rootCount * (chordDuration + gapDuration);
}

async function previewChords() {
  let graph;
  try {
    graph = getGraphData();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  previewButton.disabled = true;
  try {
    if (previewContext && previewContext.state !== "closed") {
      await previewContext.close();
    }
    window.clearTimeout(previewTimer);
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) {
      throw new Error("Audio preview is not supported in this browser.");
    }
    previewContext = new AudioContextType();
    await previewContext.resume();
    scheduleProgression(previewContext, previewContext.destination, graph, previewContext.currentTime + 0.03);
    setStatus(`Playing ${graph.roots.length} chords for “${graph.title}”.`);
    previewTimer = window.setTimeout(() => {
      setStatus("Preview complete. Adjust your data or export the WAV.");
      previewContext?.close();
    }, getDuration(graph.roots.length) * 1000 + 100);
  } catch (error) {
    setStatus(error.message || "Could not play the chord preview.", true);
  } finally {
    previewButton.disabled = false;
  }
}

function encodeWav(audioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function makeFilename(title) {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${safeTitle || "monochord-sonification"}.wav`;
}

async function exportWav() {
  let graph;
  try {
    graph = getGraphData();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  exportButton.disabled = true;
  setStatus("Synthesizing your WAV file…");
  try {
    if (!window.OfflineAudioContext) {
      throw new Error("WAV export requires OfflineAudioContext, which is not available in this browser.");
    }
    const sampleRate = 44100;
    const duration = getDuration(graph.roots.length) + 0.2;
    const frameCount = Math.ceil(sampleRate * duration);
    const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
    scheduleProgression(offlineContext, offlineContext.destination, graph, 0.03);
    const renderedAudio = await offlineContext.startRendering();
    const wavBlob = encodeWav(renderedAudio);
    const downloadUrl = URL.createObjectURL(wavBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = makeFilename(graph.title);
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
    setStatus(`Downloaded ${downloadLink.download} (${graph.roots.length} chords).`);
  } catch (error) {
    setStatus(error.message || "Could not create the WAV file.", true);
  } finally {
    exportButton.disabled = false;
  }
}

document.querySelectorAll(".preset-button").forEach((button) => {
  button.addEventListener("click", () => {
    titleInput.value = button.dataset.title;
    valuesInput.value = button.dataset.values;
    setStatus(`${button.dataset.title} preset loaded.`);
    valuesInput.focus();
  });
});

previewButton.addEventListener("click", previewChords);
exportButton.addEventListener("click", exportWav);
