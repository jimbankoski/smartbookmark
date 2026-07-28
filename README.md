# Smart Bookmark

Often when I get a chance on particularly quiet weeks, I pick up little side projects. One recent idea was to create a Smart Bookmark extension that pulls data from a page you are on and reformats how you like using a prompt, and then stores it with your bookmarks as a data URL that you can edit and save as you see fit. Basically, it makes the page work for you. 

I had lots of fun using vibe coding to write prompts to give to the model, and have been surprised at the quality of the experiences I got using just innertext and Gemini prompts on the new 3.0 models.

Page built from a complicated site with a prompt that basically said build a page that shows me the recipe on one page so I don’t need to scroll and convert all the measurements to grams.

Then I decided to try the on-device model and was less impressed. The first attempt produced working html that ignored all of my guidelines multiple times — it sometimes duplicated whole sections. I tried prompt engineering to improve the results but made little progress. I remembered that on the backend we use an AI planner, which breaks the task up into smaller tasks to pass out to AI or sub tools. 

To try and resolve, I vibecoded a quick planner and then did a lot of tweaking on the output of the vibe coded planner. This planner tries to split the creation of a web page into several sub tasks. One big task is layout and styling. That sub task gets special instructions about being a css expert with some suggestions on modern web design (e.g. which tags to use). Other tasks are based on the specific instructions you have created, for instance if you are on a recipe page sub tasks might include creating a section or div tag for ingredients, instructions and comments. On top of creating the list of subtasks, the planner tries to create a prompt for use on that section. If the user’s prompt suggests that we “convert all measurements to grams and 4 servings”, the prompt for the ingredient section will include that. Because I found that the on-device model frequently used data outside what it should, I also created a “tool for the model” that pulls only the appropriate data from the page to use with a prompt. The end result was significantly better than not having a planner at all. 

However: 
* It occasionally still ignores directions (for instance, convert all measurements to grams)
* It produces pages that look a lot worse than the the 3.0 model I’m using on the backend
* The on-device model gets 4-6 separate calls to get this work done and frequently takes 20-30 seconds.   

Some things I learned from this project: 
* The new model produces great looking rich HTML with very little guidance.  
* The on-device model is prone to ignoring instructions.  
* Smaller models need to get only relevant data. A big part of the work here is picking out what to share with the model.  
* The on device model is lagging significantly behind the new 3.0 model, in a way that feels bigger than what we saw before.

---

## Features

- **Smart Bookmarks (Data URLs):** The generated web page is automatically stored in your browser's bookmarks as a Data URL. You can reopen it anytime, and even edit the page directly from that location using the context menu or by double-clicking on it!
- **AI-Powered Layout Engine:** Automatically selects from predefined templates (e.g., Split-Screen Box Layout, Standard Blog Layout, Centered Landing Page) based on the content and your stylistic preferences.
- **Content Extraction:** Uses generative AI models to accurately scrape and interpret the most important content from your current browser tab.
- **Dynamic CSS & Styling:** Generates a custom color palette and injects it seamlessly into the layout.
- **On-Device or Cloud Execution:** Capable of running using the local `window.ai` model or falling back to the cloud-based Gemini API.

## To try out this extension follow the instructions here: to make it more fun

1. Clone or download this repository and expand the directory.
2. Go to `chrome://extensions` and turn on **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the directory you just expanded.
4. Pin the PageCreator extension (the gray 'P' icon) to your Chrome toolbar so you can see it.

### Setup & Configuration

1. Right-click on the PageCreator icon (the gray 'P') and select **Options**.
2. Copy your Gemini API key (e.g., from your `GEMINI_API_KEY` environment variable) into the Gemini API Key field.
3. Uncheck **Use On-Device Model** and click **Save Settings**.
4. Add a new prompt to the system. For instance, try this powerful layout prompt:
   - **Prompt Name:** `Recipes`
   - **Prompt Text:** 
     > try to fit the recipe all on one wide page so I can read it without scrolling, create a hero image on the left side of the screen at all times that covers the left hand 30% of the page from top to bottom no matter how we scroll, and all the other sections are stored to the right. create a section for the ingredients which includes each ingredient and its measurement converted from anything not grams (teaspoons, tablespoons, cups, pounds, ounces etc) to grams. create a section for comments in which we'll summarize all the comments in the page with a 5-6 sentence "comment summary"

### Usage Example

1. Go to a web page with a recipe on it.
2. Right-click anywhere on the page and select **Page Creator -> Recipes** (the 'P' icon should change to a progress indicator).
3. When it is done, you will automatically be taken to your newly created page!
4. **Editing the Page:**
   - Try double-clicking on any text element to edit it inline.
   - Right-click with your mouse on an item to duplicate it, delete it, or cut and paste it elsewhere.
5. **Smart Bookmarks:** Check out your browser's bookmarks. You'll see that this new page was automatically stored under `Page Creator -> Recipes`. You can reopen and edit it anytime!

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for more details.
