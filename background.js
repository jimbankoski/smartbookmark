// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const PROMPTS_KEY = 'prompts';
importScripts('web-builder-agent.js');
const defaultPrompts = [
  { name: 'Summarize', prompt: 'Summarize this page in a single paragraph.' },
  { name: 'Explain Like I am 5', prompt: 'Explain this page to me like I am 5 years old.' }
];

// --- (Icon generation code remains the same) ---
const DIMS = { SIZE: 32, CENTER: 16, RADIUS: 12, STROKE: 3 };
const ICON_PATHS = {
    default: new Path2D("M24 2H8C6.9 2 6 2.9 6 4V30L16 22L26 30V4C26 2.9 25.1 2 24 2Z"),
    error: new Path2D("M16,2C8.3,2,2,8.3,2,16s6.3,14,14,14s14-6.3,14-14S23.7,2,16,2z M20.7,19.3c0.4,0.4,0.4,1,0,1.4l-1.4,1.4 c-0.4,0.4-1,0.4-1.4,0L16,18.4l-2.9,2.9c-0.4,0.4-1,0.4-1.4,0l-1.4-1.4c-0.4-0.4-0.4-1,0-1.4L13.2,16l-2.9-2.9 c-0.4-0.4-0.4-1,0-1.4l1.4-1.4c0.4-0.4,1-0.4,1.4,0L16,13.2l2.9-2.9c0.4-0.4,1-0.4,1.4,0l1.4,1.4c0.4,0.4,0.4,1,0,1.4L18.8,16 L20.7,19.3z")
};
function generateIconImageData(state, frame = 0) {
    const canvas = new OffscreenCanvas(DIMS.SIZE, DIMS.SIZE);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, DIMS.SIZE, DIMS.SIZE);
    if (state === 'progress') {
        ctx.beginPath();
        ctx.lineWidth = DIMS.STROKE;
        ctx.strokeStyle = '#4285F4';
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (frame + 1) * (Math.PI / 4);
        ctx.arc(DIMS.CENTER, DIMS.CENTER, DIMS.RADIUS, startAngle, endAngle);
        ctx.stroke();
    } else if (state === 'error') {
        ctx.fillStyle = '#D93025';
        ctx.fill(ICON_PATHS.error);
    } else {
        ctx.fillStyle = '#4F4F4F';
        ctx.fill(ICON_PATHS.default);
    }
    return ctx.getImageData(0, 0, DIMS.SIZE, DIMS.SIZE);
}
let progressInterval;
let animationFrames = [];
async function prepareAnimationFrames() {
    if (animationFrames.length > 0) return;
    for (let i = 0; i < 8; i++) animationFrames.push(generateIconImageData('progress', i));
}
async function setIconState(state) {
    clearInterval(progressInterval);
    if (state === 'progress') {
        if (animationFrames.length === 0) {
            await prepareAnimationFrames();
        }
        let frame = 0;
        progressInterval = setInterval(() => {
            chrome.action.setIcon({ imageData: animationFrames[frame] });
            frame = (frame + 1) % animationFrames.length;
        }, 100);
    } else {
        chrome.action.setIcon({ imageData: generateIconImageData(state) });
    }
}
// ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(PROMPTS_KEY, (data) => {
    if (!data[PROMPTS_KEY]) chrome.storage.sync.set({ [PROMPTS_KEY]: defaultPrompts });
  });
  createContextMenu();
  prepareAnimationFrames();
  setIconState('default');
});

// --- (Other listeners and context menu setup remain the same) ---
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[PROMPTS_KEY]) createContextMenu();
});

function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        const safeCreate = (config) => {
            chrome.contextMenus.create(config, () => {
                // Read lastError to suppress "Unchecked runtime.lastError" console warnings
                const err = chrome.runtime.lastError;
            });
        };
        
        safeCreate({ id: 'page-creator', title: 'Page Creator', contexts: ['page'] });
        chrome.storage.sync.get(PROMPTS_KEY, (data) => {
            (data[PROMPTS_KEY] || []).forEach(prompt => {
                safeCreate({ id: prompt.name, title: prompt.name, parentId: 'page-creator', contexts: ['page'] });
            });
            safeCreate({ id: 'separator', type: 'separator', parentId: 'page-creator', contexts: ['page'] });
            safeCreate({ id: 'new-prompt', title: 'New Prompt', parentId: 'page-creator', contexts: ['page'] });
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'new-prompt') {
        chrome.runtime.openOptionsPage();
        return;
    }
    chrome.storage.sync.get(PROMPTS_KEY, (data) => {
        const selectedPrompt = (data[PROMPTS_KEY] || []).find(p => p.name === info.menuItemId);
        if (selectedPrompt) createPage(selectedPrompt.prompt, tab, selectedPrompt.name);
    });
});
// ---

// --- Helper function to select the best hero image ---
function selectHeroImage(images, title) {
    if (!images || images.length === 0) {
        return null;
    }

    const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let bestMatch = { score: -1, image: null, area: 0 };

    images.forEach(image => {
        let score = 0;
        const imageText = `${image.alt} ${image.src}`.toLowerCase();
        
        titleWords.forEach(word => {
            if (imageText.includes(word)) {
                score++;
            }
        });

        const area = image.width * image.height;
        if (score > bestMatch.score) {
            bestMatch = { score, image, area };
        } else if (score === bestMatch.score && area > bestMatch.area) {
            // Tie-break with larger area
            bestMatch = { score, image, area };
        }
    });

    // If no text match was found, fall back to the largest image.
    if (bestMatch.score === 0) {
        let largestImage = images[0];
        let maxArea = largestImage.width * largestImage.height;
        for (let i = 1; i < images.length; i++) {
            const area = images[i].width * images[i].height;
            if (area > maxArea) {
                maxArea = area;
                largestImage = images[i];
            }
        }
        return largestImage;
    }

    return bestMatch.image;
}


async function runWebBuilderAgentFromBackground(userGoal, sourceText, imageList, titleClean, faviconDataUrl) {
    const agent = new WebBuilderAgent();
    const generatedHtml = await agent.run(userGoal, sourceText, imageList, titleClean, faviconDataUrl);
    return generatedHtml;
}

async function createPage(prompt, tab, promptName) {
    try {
        await setIconState('progress');

        const [injectionResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const text = document.body.innerText;
                const imgElements = Array.from(document.querySelectorAll('img'));
                
                // Filter and map images
                const images = imgElements.filter(img => img.src.length <= 300 && img.height > 100 && !img.src.startsWith('data:image')).map(img => ({
                    src: img.src,
                    alt: img.alt,
                    width: img.width,
                    height: img.height
                }));

                // Find "Hero" candidate for favicon (largest area)
                let bestImg = null;
                let maxArea = 0;
                // Use a simple heuristic to find a representative image
                imgElements.forEach(img => {
                    const area = img.width * img.height;
                    // Ensure it's substantial enough and not an icon itself (unless it's the only option)
                    // We check naturalWidth/Height if available, otherwise client dimensions
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    
                    if (w * h > maxArea && w > 64 && h > 64 && !img.src.startsWith('data:image')) {
                        maxArea = w * h;
                        bestImg = img;
                    }
                });

                let favicon = null;
                if (bestImg) {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 64;
                        canvas.height = 64;
                        const ctx = canvas.getContext('2d');
                        // Draw image to fit/cover 64x64
                        ctx.drawImage(bestImg, 0, 0, 64, 64);
                        favicon = canvas.toDataURL('image/png');
                    } catch (e) {
                        // Handle tainted canvas or other errors silently
                    }
                }
                
                return { text, images, favicon };
            }
        });
        if (!injectionResult?.result) throw new Error("Failed to inject script.");
        
        const { text: pageText, images: pageImages, favicon } = injectionResult.result;
        const agent = new WebBuilderAgent();
        await agent.init();
        const titleRaw = await agent.getInfo("Extract a single, short, descriptive title for a webpage from this text. Output ONLY the title text.", pageText);
        const titleClean = titleRaw.replace(/"/g, '').replace(/Title:/i, '').trim();
        console.log("[AGENT LOG] WebBuilderAgent: Title found:", titleClean);

        const { apiKey, useOnDeviceModel } = await chrome.storage.sync.get(['apiKey', 'useOnDeviceModel']);
        if (!apiKey && !useOnDeviceModel) throw new Error("API key not found and on-device model not enabled.");

        let generatedHtml;
        let responseData;
        if (useOnDeviceModel) {
            console.log("Using on-device model flow (WebBuilderAgent direct in Service Worker)...");
            const availability = await LanguageModel.availability();
            if (availability !== "available") {
                throw new Error(`On-device model is not available. Status: ${availability}`);
            }
            generatedHtml = await runWebBuilderAgentFromBackground(prompt, pageText, pageImages, titleClean, favicon);

        } else {
            console.log("Using standard Gemini API call...");

            // Strip out massive data URIs to avoid token bloat and confusion for the model
            const safeImages = pageImages.map(img => {
                if (img.src && img.src.startsWith('data:image/') && img.src.length > 1000) {
                    return { src: img.src.substring(0, 100) + '... (data URI truncated)', alt: img.alt };
                }
                return { src: img.src, alt: img.alt };
            });

            let promptText = `Create a visually engaging page for the prompt: "${prompt}". Use the provided text and consider these images: ${JSON.stringify(safeImages)}. IMPORTANT: You MUST include a link back to the original page: ${tab.url}. 
IMAGE RULES: Please rely exclusively on CSS to determine image sizes and omit 'width' and 'height' attributes on <img> tags. Please use each image at most once.
Page text: ${pageText}`;
            
            if (favicon) {
                promptText += `\nIMPORTANT: Include the following data URL as the favicon in the head section: <link rel="icon" href="${favicon}">`;
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    systemInstruction: { parts: [{ text: "You are an expert web developer. You must return ONLY raw HTML code. Do not use markdown formatting like ```html." }] },
                    contents: [{ parts: [{ text: promptText }] }] 
                })
            });
            if (!response.ok) throw new Error(`API request failed: ${response.status}`);

            responseData = await response.json();
            generatedHtml = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (generatedHtml) {
                // Strip markdown just in case the model ignores the instruction
                generatedHtml = generatedHtml.replace(/^```html\n?/g, '').replace(/\n?```$/g, '').trim();
            }
        }

        if (generatedHtml) {
            await handleGeneratedHtml(generatedHtml, tab, promptName);
        }
        else {
            throw new Error("Model did not return any content. Response: " + JSON.stringify(responseData));
        }
    }
    catch (error) {
        console.error('Create page process failed:', error);
        await setIconState('error');
        setTimeout(() => setIconState('default'), 4000);
    }
    finally {
        if (progressInterval) await setIconState('default');
    }
}
// --- (handleGeneratedHtml, injectEditorScript, and onMessageExternal remain the same) ---
async function handleGeneratedHtml(generatedHtml, sourceTab, promptName) {
    let finalHtml = generatedHtml;
    if (!finalHtml.includes(sourceTab.url)) {
        const backLink = `<p><a href="${sourceTab.url}">Back to original</a></p>`;
        finalHtml = finalHtml.replace('</body>', backLink + '</body>');
    }
    const title = finalHtml.match(/<title>(.*?)<\/title>/i)?.[1] || sourceTab.title;
    const initialDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`;
    const [pageCreatorFolder] = await chrome.bookmarks.search({ title: "Page Creator" });
    let parentFolder = pageCreatorFolder || await chrome.bookmarks.create({ title: "Page Creator" });
    const children = await chrome.bookmarks.getChildren(parentFolder.id);
    let promptFolder = children.find(folder => folder.title === promptName) || await chrome.bookmarks.create({ parentId: parentFolder.id, title: promptName });
    const newBookmark = await chrome.bookmarks.create({ parentId: promptFolder.id, title, url: initialDataUrl });
    const htmlWithScript = injectEditorScript(finalHtml, newBookmark.id);
    const finalDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlWithScript)}`;
    await chrome.bookmarks.update(newBookmark.id, { url: finalDataUrl });
    await chrome.tabs.create({ url: finalDataUrl });
}
function injectEditorScript(html, bookmarkId) {
    const extensionId = chrome.runtime.id;
    const script = `
        <style>
            #page-creator-context-menu {
                position: fixed;
                display: none;
                background-color: #fff;
                border: 1px solid #ccc;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
                padding: 5px 0;
                z-index: 10000;
                font-family: sans-serif;
                font-size: 14px;
            }
            #page-creator-context-menu div {
                padding: 8px 15px;
                cursor: pointer;
            }
            #page-creator-context-menu div:hover {
                background-color: #f0f0f0;
            }
        </style>
        <script>
        (function() {
            const BOOKMARK_ID = "${bookmarkId}";
            const EXTENSION_ID = "${extensionId}";
            let contextMenu = null;
            let currentTargetElement = null;
            let lastHoveredElement = null;
            let cutElement = null; // Variable to hold the cut element

            function finalizeEdit(element) {
                if (element && element.getAttribute('contenteditable') === 'true') {
                    element.removeAttribute('contenteditable');
                }
                const newHtml = document.documentElement.outerHTML;
                window.pageDom = newHtml;
                try {
                    chrome.runtime.sendMessage(EXTENSION_ID, { type: 'update-page-bookmark', bookmarkId: BOOKMARK_ID, newHtml });
                } catch (e) { console.error("Failed to send message to extension.", e); }
            }
            
            function createContextMenu() {
                if (contextMenu) return;
                contextMenu = document.createElement('div');
                contextMenu.id = 'page-creator-context-menu';
                
                const duplicateButton = document.createElement('div');
                duplicateButton.textContent = 'Duplicate';
                duplicateButton.addEventListener('click', () => {
                    if (currentTargetElement) {
                        const clone = currentTargetElement.cloneNode(true);
                        currentTargetElement.parentNode.insertBefore(clone, currentTargetElement.nextSibling);
                        finalizeEdit(document.body); 
                    }
                    hideContextMenu();
                });

                const deleteButton = document.createElement('div');
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', () => {
                    if (currentTargetElement && currentTargetElement.parentNode) {
                        currentTargetElement.parentNode.removeChild(currentTargetElement);
                        finalizeEdit(document.body);
                    }
                    hideContextMenu();
                });

                const cutButton = document.createElement('div');
                cutButton.textContent = 'Cut';
                cutButton.addEventListener('click', () => {
                    if (currentTargetElement && currentTargetElement.parentNode) {
                        cutElement = currentTargetElement;
                        currentTargetElement.parentNode.removeChild(currentTargetElement);
                        finalizeEdit(document.body);
                    }
                    hideContextMenu();
                });

                const pasteButton = document.createElement('div');
                pasteButton.id = 'page-creator-paste-button';
                pasteButton.textContent = 'Paste';
                pasteButton.addEventListener('click', () => {
                    if (cutElement && currentTargetElement) {
                        currentTargetElement.parentNode.insertBefore(cutElement, currentTargetElement.nextSibling);
                        cutElement = null;
                        finalizeEdit(document.body);
                    }
                    hideContextMenu();
                });

                const downloadButton = document.createElement('div');
                downloadButton.textContent = 'Download';
                downloadButton.addEventListener('click', () => {
                    const htmlContent = document.documentElement.outerHTML;
                    const blob = new Blob([htmlContent], {type: 'text/html'});
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = document.title + '.html';
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    hideContextMenu();
                });

                contextMenu.appendChild(duplicateButton);
                contextMenu.appendChild(deleteButton);
                contextMenu.appendChild(cutButton);
                contextMenu.appendChild(pasteButton);
                contextMenu.appendChild(downloadButton);
                document.body.appendChild(contextMenu);
            }

            function showContextMenu(event) {
                event.preventDefault();
                currentTargetElement = event.target;
                
                if (!contextMenu) createContextMenu();

                const pasteButton = document.getElementById('page-creator-paste-button');
                if (pasteButton) {
                    pasteButton.style.display = cutElement ? 'block' : 'none';
                }

                contextMenu.style.display = 'block';
                contextMenu.style.left = event.pageX + 'px';
                contextMenu.style.top = event.pageY + 'px';
            }

            function hideContextMenu() {
                if (contextMenu) {
                    contextMenu.style.display = 'none';
                }
                currentTargetElement = null;
            }

            document.body.addEventListener('contextmenu', showContextMenu);
            document.addEventListener('click', hideContextMenu);

            document.body.addEventListener('dblclick', (e) => {
                const target = e.target;
                if (!['BUTTON','INPUT','A','TEXTAREA','IMG'].includes(target.tagName) && !target.isContentEditable) {
                    target.setAttribute('contenteditable', 'true');
                    target.focus();
                }
            });

            document.body.addEventListener('blur', (e) => finalizeEdit(e.target), true);

            document.body.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.isContentEditable) {
                    e.preventDefault();
                    finalizeEdit(e.target);
                }
            });

            // --- Paste Functionality ---
            document.body.addEventListener('mouseover', (e) => {
                lastHoveredElement = e.target;
            });

            document.body.addEventListener('paste', (e) => {
                e.preventDefault();
                if (!lastHoveredElement || !lastHoveredElement.parentNode) return;

                const items = (e.clipboardData || window.clipboardData).items;
                let changesMade = false;
                
                const insertAfter = (newNode, referenceNode) => {
                    if (referenceNode && referenceNode.parentNode) {
                        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
                        changesMade = true;
                    }
                };

                const processItems = async () => {
                    for (const item of items) {
                        if (item.kind === 'file' && item.type.startsWith('image/')) {
                            const blob = item.getAsFile();
                            await new Promise(resolve => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = document.createElement('img');
                                    img.src = event.target.result;
                                    insertAfter(img, lastHoveredElement);
                                    resolve();
                                };
                                reader.readAsDataURL(blob);
                            });
                        } else if (item.kind === 'string' && item.type === 'text/plain') {
                             await new Promise(resolve => {
                                item.getAsString((s) => {
                                    const p = document.createElement('p');
                                    p.textContent = s;
                                    insertAfter(p, lastHoveredElement);
                                    resolve();
                                });
                            });
                        }
                    }
                    if (changesMade) {
                        finalizeEdit(document.body);
                    }
                };

                processItems();
            });


        })();
        </script>
    `;
    return html.replace('</body>', script + '</body>');
}
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.type === 'update-page-bookmark') {
        const { bookmarkId, newHtml } = request;
        const newTitle = newHtml.match(/<title>(.*?)<\/title>/i)?.[1] || 'Updated Page';
        const newDataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(newHtml)}`;
        chrome.bookmarks.update(bookmarkId, { url: newDataUrl, title: newTitle })
            .then(() => sendResponse({status: "success"}))
            .catch(err => {
                console.error("Failed to update bookmark:", err);
                sendResponse({status: "error"});
            });
        return true;
    }
});
