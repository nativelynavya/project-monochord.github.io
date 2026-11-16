"use strict";

const menuId = "sonify-selected-numbers";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: menuId,
      title: "Sonify Selected Numbers with Project Monochord",
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Project Monochord could not register its selection menu.", chrome.runtime.lastError.message);
      }
    });
  });
});

function sendSonificationRequest(tab, frameId) {
  if (!tab?.id) {
    return;
  }
  const onResponse = () => {
    if (chrome.runtime.lastError) {
      console.warn("Project Monochord could not reach this webpage.", chrome.runtime.lastError.message);
    }
  };
  if (frameId === undefined) {
    chrome.tabs.sendMessage(tab.id, { type: "sonify-selection" }, onResponse);
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "sonify-selection" }, { frameId }, onResponse);
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "sonify-selection") {
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    sendSonificationRequest(tab);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === menuId) {
    sendSonificationRequest(tab, info.frameId);
  }
});
