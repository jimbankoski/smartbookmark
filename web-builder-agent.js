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

// --- WebBuilderAgent and Schema (Adapted for Service Worker LanguageModel) ---
const sectionPlanSchema = {
    type: "object",
    properties: {
        sections: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    sectionName: { type: "string" },
                    extractionQuery: { type: "string", description: "A HIGHLY SPECIFIC query for the extraction tool." },
                    generationInstruction: { type: "string", description: "Detailed instruction for the HTML writer." }
                },
                required: ["sectionName", "extractionQuery", "generationInstruction"]
            }
        }
    },
    required: ["sections"]
};

class WebBuilderAgent {
    constructor() {
        this.plannerSession = null;
        this.executorSession = null;
        this.extractorSession = null;
        this.styleExtractorSession = null;
    }

    async init() {
        if (this.plannerSession) return;
        const commonConfig = {
            expectedInputs: [{ type: "text", languages: ["en"] }],
            expectedOutputs: [{ type: "text", languages: ["en"] }]
        };
        this.plannerSession = await LanguageModel.create({ systemPrompt: `You are a Website Architect. AVOID creating summary sections.`, ...commonConfig });
        this.extractorSession = await LanguageModel.create({ systemPrompt: "You are an Information Extraction Tool...", ...commonConfig });
        this.executorSession = await LanguageModel.create({ systemPrompt: "You are a Frontend Developer...", ...commonConfig });
        this.styleExtractorSession = await LanguageModel.create({ systemPrompt: "You are a CSS designer and style expert. Your output should be in the format requested by the user's prompt, such as VALID CSS CODE or JSON.", ...commonConfig });
    }

    async getInfo(query, fullText) {
        const prompt = `SOURCE TEXT:
${fullText}

QUERY: ${query}. IMPORTANT: Never use markdown in your response.`;
        const result = await this.extractorSession.prompt(prompt);
        console.log(`[AGENT LOG - TOOL] Extracting: "${query}": ${result}`);
        return result;
    }

    async createSectionList(userGoal, pageTitle) {
        console.log(`[AGENT LOG - PLANNER] Planning Sections. Goal: "${userGoal}" | Title: "${pageTitle}"`);
        const prompt = `Consider the PAGE TITLE: ${pageTitle}.
USER PROMPT: ${userGoal}

List the sections for this page, deriving them from the USER PROMPT. One possible section name is 'title' but do not create a section named ${pageTitle}. Break sections into the smallest possible unit (e.g., a recipe should have separate 'ingredients' and 'instructions' sections). RETAIN THE ORDER OF SECTIONS AS IMPLIED BY THE USER'S PROMPT. For sections directly from the user's prompt, the 'generationInstruction' MUST be short, marked as 'IMPORTANT', and contain NO div or section tags no styling and no layout information. IMPORTANT: No CSS styling or layout information should be created in the generationInstruction. IMPORTANT: For each section's 'generationInstruction', ensure it does NOT include content that belongs to other sections.`;

        const responseString = await this.plannerSession.prompt([{ role: "user", content: prompt }], { responseConstraint: sectionPlanSchema });
        let cleanedResponse = responseString.replace(/```json|```/g, '').trim();
        const startBrace = cleanedResponse.indexOf('{');
        if (startBrace !== -1) {
            cleanedResponse = cleanedResponse.substring(startBrace);
        }

        let response;
        try {
            response = JSON.parse(cleanedResponse);
        } catch (e) {
            console.warn("[AGENT LOG - PLANNER] JSON parse failed, attempting repair. Error:", e.message);
            const lastValidBrace = cleanedResponse.lastIndexOf('}');
            if (lastValidBrace !== -1 && lastValidBrace > startBrace) {
                // Cut off incomplete trailing data and close the array/object
                let repaired = cleanedResponse.substring(0, lastValidBrace + 1) + ']}';
                try {
                    response = JSON.parse(repaired);
                    console.log("[AGENT LOG - PLANNER] Successfully repaired truncated JSON.");
                } catch (repairError) {
                    throw new Error(`Failed to parse and repair JSON: ${e.message}\\nRaw Output: ${cleanedResponse}`);
                }
            } else {
                throw new Error(`Failed to parse JSON: ${e.message}\\nRaw Output: ${cleanedResponse}`);
            }
        }

        console.log(`[AGENT LOG - PLANNER] Section List Created:`, response.sections);
        return response.sections;
    }

    async buildSectionHtml(section, extractedContent, imageList) {
        console.log(`[AGENT LOG - EXECUTOR] Building: ${section.sectionName}: ${section.generationInstruction}`);
        const prompt = `CURRENT SECTION: ${section.sectionName}
INSTRUCTION: ${section.generationInstruction}
CONTENT TO USE: ${extractedContent}
AVAILABLE IMAGES: ${imageList}

Write valid HTML for this section based strictly on the instruction above. Do NOT use a section tag. 
CRITICAL IMAGE RULES: NEVER put a 'width' or 'height' attribute on any <img> tag; set img width and height to 100% to ensure image sizes MUST be determined by the layout CSS. Ensure that the same image NEVER appears on the page more than once.`;
        const result = await this.executorSession.prompt(prompt);
        return result.replace(/```html|```/g, '').trim();
    }

    async run(userGoal, sourceText, imageList, titleClean) {
        console.log("[AGENT LOG] WebBuilderAgent: Starting run...");
        await this.init();

        const sections = await this.createSectionList(userGoal, titleClean);
        const sectionClasses = sections.map(s => s.sectionName.toLowerCase().replace(/\s+/g, '-')).join(', ');

        const styleExtractionPrompt = `USER PROMPT: ${userGoal}

For the following CSS classes, extract any stylistic or layout descriptions from the user prompt: ${sectionClasses}`; 
        const extractedStyles = await this.getInfo(styleExtractionPrompt, userGoal);

        const colorPalettePrompt = `Inspired by the title "${titleClean}", generate a color palette. I need three colors in hexadecimal format:
1. headerTitleColor: A color for the main page title.
2. sectionTitleColor: A color for section titles.
3. lightBackgroundColor: A light, complementary background color.

Return ONLY a valid JSON object with the keys "headerTitleColor", "sectionTitleColor", and "lightBackgroundColor". Do not include any other text or markdown.`;

        const colorPaletteJSON = await this.styleExtractorSession.prompt(colorPalettePrompt);
        const colorPalette = JSON.parse(colorPaletteJSON.replace(/```json|```/g, '').trim());
        const { headerTitleColor, sectionTitleColor, lightBackgroundColor } = colorPalette;

        const stylePrompt = `ROLE:
You are a UI Layout Engine. Your goal is to produce a structural HTML5 skeleton by selecting and adjusting a predefined template.

INPUTS:
STYLE GUIDE: ${extractedStyles}
SECTION CLASSES: ${sectionClasses}
PAGE TITLE: ${titleClean}
COLORS:
- Header Title: ${headerTitleColor}
- Section Title: ${sectionTitleColor}
- Background:  ${lightBackgroundColor}

PREDEFINED TEMPLATES:

[TEMPLATE 1: Split-Screen Box Layout] (Best for fitting everything on one page without scrolling)
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; display:flex; flex-direction:column; width:100vw; height:100vh; overflow:hidden; font-family:sans-serif; background-color:var(--bg); }
  .page-header { width:100%; padding:2vw; text-align:center; border-bottom:1px solid #ccc; box-sizing:border-box; flex-shrink: 0; }
  .main-content { display:flex; flex:1; width:100vw; overflow:hidden; }
  .text-column { flex:1; display:flex; flex-direction:column; padding:2vw; box-sizing:border-box; overflow-y:auto; gap: 2vw; }
  .image-column { flex:1; display:flex; flex-direction:column; width:20%; overflow:hidden; background-color:#eee; }
  /* When image is placed in image-column, make it fill and crop */
  .image-column img { width:100%; height:100%; object-fit:cover; }
  /* General image rules */
  img { max-width:100%; height:auto; object-fit:contain; }
</style>
</head>
<body>
  <header class="page-header">
    <!-- HOLDING SPOT: Title section ONLY -->
  </header>
  <div class="main-content">
    <div class="image-column">
      <!-- HOLDING SPOT: Place the 'image' section alone here to fill the column -->
    </div>
    <div class="text-column">
      <!-- HOLDING SPOT: Text content sections -->
    </div>
  </div>
</body>
</html>

[TEMPLATE 2: Standard Blog Layout] (Best for reading articles, scrolling vertically)
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin:0; padding:0; font-family:serif; background-color:var(--bg); color:#333; overflow-y:auto; }
  .blog-header { width:100%; padding:4vw 0; text-align:center; border-bottom:1px solid #ccc; }
  .blog-container { max-width:800px; margin:0 auto; padding:2vw; display:flex; flex-direction:column; gap:2vw; }
  img { max-width:100%; height:auto; object-fit:contain; }
</style>
</head>
<body>
  <header class="blog-header">
    <!-- HOLDING SPOT: Title section -->
  </header>
  <div class="blog-container">
    <!-- HOLDING SPOT: All content sections -->
  </div>
</body>
</html>

INSTRUCTIONS:
1. Select the best template based on the STYLE GUIDE.
2. Modify the chosen template's <style> block to incorporate the provided COLORS and apply any styling requested in the STYLE GUIDE.
3. CRUCIAL: You MUST create an empty div for each of these ${sectionClasses} and store each of these in an appropriate div tag from the template. For example, within the best template div and pick an appropriate style to add to the class list.  For template 1 this might be if the class is "ingredients", you MUST add output <div class="ingredients text-column"></div> to <div class="text-column">
4. CRITICAL LAYOUT RULES:
   - Never put more than one title on the page (use the 'title' section class in the header holding spot, do not hardcode a duplicate TITLE element).
   - NEVER place the 'image' section inside the full-width title/header holding spot. Place the image section in a side column (like the 'image-column' in Template 1) so it can appear alone and be cropped appropriately.
   - Never add borders around sections unless explicitly requested.
   - The size of columns MUST be decided by the template CSS and the text content. The size of an image must NEVER be used to dictate the size of a column or row.
5. Return ONLY the raw, valid HTML string starting with <!DOCTYPE html>.

`;

        let fullHtml = await this.styleExtractorSession.prompt(stylePrompt);
        fullHtml = fullHtml.replace(/^```html\n*/, '').replace(/\n*```$/, '');
        console.log(stylePrompt);
        console.log(fullHtml)

        let globallyUsedImages = [];

        for (let i = sections.length - 1; i >= 0; --i) {
            const currentSection = sections[i];
            let content;
            if (currentSection.sectionName.toLowerCase().includes("title")||currentSection.sectionName.toLowerCase().includes("image")) {
                content = `Title: ${titleClean}`;
            } else {
                const otherSectionNames = sections.slice(0, i).concat(sections.slice(i + 1)).map(s => s.sectionName).join(', ');
                const modifier = `. DO NOT INCLUDE ANY TEXT THAT MIGHT BE IN ANY OF THESE SECTIONS: ${otherSectionNames}`;
                content = await this.getInfo(currentSection.extractionQuery + modifier, sourceText);
            }
            let htmlChunk = await this.buildSectionHtml(currentSection, content, JSON.stringify(imageList));
            
            // Surgical removal of any already-used images that the model hallucinated from its conversation history
            for (const usedObj of globallyUsedImages) {
                const usedUrl = usedObj.src;
                const escaped = usedUrl.replace(/&/g, '&amp;');
                [usedUrl, escaped].forEach(url => {
                    let idx;
                    while ((idx = htmlChunk.indexOf(url)) !== -1) {
                        let imgStart = htmlChunk.lastIndexOf('<img', idx);
                        let imgEnd = htmlChunk.indexOf('>', idx);
                        if (imgStart !== -1 && imgEnd !== -1 && imgStart < imgEnd) {
                            htmlChunk = htmlChunk.slice(0, imgStart) + htmlChunk.slice(imgEnd + 1);
                        } else {
                            break;
                        }
                    }
                });
            }

            // Identify which new images were successfully consumed by this chunk
            const newlyUsed = imageList.filter(imgObj => {
                const url = imgObj.src;
                return htmlChunk.includes(url) || htmlChunk.includes(url.replace(/&/g, '&amp;'));
            });
            globallyUsedImages.push(...newlyUsed);
            
            // Remove newly used images from the available list so they aren't provided to subsequent sections
            imageList = imageList.filter(imgObj => !newlyUsed.includes(imgObj));
            
            console.log(htmlChunk);
            const sectionClass = currentSection.sectionName.toLowerCase().replace(/\s+/g, '-');
            const insertionPoint = fullHtml.indexOf(`class="${sectionClass}"`);
            if (insertionPoint !== -1) {
                const closingTag = fullHtml.indexOf('>', insertionPoint);
                fullHtml = fullHtml.slice(0, closingTag + 1) + htmlChunk + fullHtml.slice(closingTag + 1);
            } else {
                const contentDivStart = fullHtml.indexOf('<div class="content">');
                if (contentDivStart !== -1) {
                    const insertIndex = fullHtml.indexOf('>', contentDivStart) + 1;
                    fullHtml = fullHtml.slice(0, insertIndex) +
                               `<div class="${sectionClass}">${htmlChunk}</div>` +
                               fullHtml.slice(insertIndex);
                } else {
                    // Fallback if the content div itself is not found (should ideally not happen with the strict prompt)
                    fullHtml = fullHtml.replace('</body>', `<div class="${sectionClass}">${htmlChunk}</div></body>`);
                }
            }
        }

        console.log(fullHtml);
        console.log("[AGENT LOG] WebBuilderAgent: Run complete.");
        return fullHtml;
    }
}