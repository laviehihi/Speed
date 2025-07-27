
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
        chrome.tabs.create({
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        });
    }
});
