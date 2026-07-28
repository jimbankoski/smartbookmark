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

document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('save-options');
  const apiKeyInput = document.getElementById('api-key');
  const apiModelToggle = document.getElementById('api-model-toggle');
  const promptsListContainer = document.getElementById('prompts-list');
  const addPromptButton = document.getElementById('add-prompt-button');
  const newPromptNameInput = document.getElementById('new-prompt-name');
  const newPromptTextInput = document.getElementById('new-prompt-prompt');

  // --- API Settings ---
  chrome.storage.sync.get(['apiKey', 'useOnDeviceModel'], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    apiModelToggle.checked = result.useOnDeviceModel || false;
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    const useOnDeviceModel = apiModelToggle.checked;
    chrome.storage.sync.set({ 
      apiKey: apiKey,
      useOnDeviceModel: useOnDeviceModel 
    }, () => {
      alert('API Settings saved!');
    });
  });

  // --- Icon Definitions ---
  const ICONS = {
    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`,
    delete: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    save: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    cancel: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  };

  // --- Prompt Management ---

  function loadPrompts() {
    chrome.storage.sync.get({prompts: []}, (result) => {
      renderPrompts(result.prompts);
    });
  }

  function savePrompts(prompts, callback) {
    chrome.storage.sync.set({prompts: prompts}, callback);
  }

  function renderPrompts(prompts) {
    promptsListContainer.innerHTML = '';
    if (!prompts || prompts.length === 0) {
      promptsListContainer.innerHTML = '<p>No prompts saved yet. Add one below!</p>';
      return;
    }

    prompts.forEach((prompt, index) => {
      const promptElement = document.createElement('div');
      promptElement.className = 'prompt-item';
      promptElement.innerHTML = `
        <div class="prompt-details">
          <strong class="prompt-name">${prompt.name}</strong>
          <p class="prompt-prompt">${prompt.prompt}</p>
        </div>
        <div class="prompt-actions">
          <button class="edit-button" data-index="${index}" title="Edit Prompt">${ICONS.edit}</button>
          <button class="delete-button" data-index="${index}" title="Delete Prompt">${ICONS.delete}</button>
        </div>
      `;
      promptsListContainer.appendChild(promptElement);
    });
  }

  addPromptButton.addEventListener('click', () => {
    const name = newPromptNameInput.value.trim();
    const prompt = newPromptTextInput.value.trim();
    if (name && prompt) {
      chrome.storage.sync.get({prompts: []}, (result) => {
        const prompts = result.prompts;
        if (prompts.some(p => p.name === name)) {
          alert('A prompt with this name already exists.');
          return;
        }
        prompts.push({ name, prompt });
        savePrompts(prompts, () => {
          newPromptNameInput.value = '';
          newPromptTextInput.value = '';
          loadPrompts();
        });
      });
    } else {
      alert('Please provide both a name and a prompt.');
    }
  });

  promptsListContainer.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const index = button.dataset.index;

    if (button.classList.contains('delete-button')) {
      if (confirm('Are you sure you want to delete this prompt?')) {
        chrome.storage.sync.get({prompts: []}, (result) => {
          const prompts = result.prompts;
          prompts.splice(index, 1);
          savePrompts(prompts, loadPrompts);
        });
      }
    }

    if (button.classList.contains('edit-button')) {
      const promptItem = button.closest('.prompt-item');
      chrome.storage.sync.get({prompts: []}, (result) => {
        const prompts = result.prompts;
        const prompt = prompts[index];
        
        promptItem.innerHTML = `
          <div class="prompt-details">
            <input type="text" class="edit-prompt-name" value="${prompt.name}">
            <textarea class="edit-prompt-prompt">${prompt.prompt}</textarea>
          </div>
          <div class="prompt-actions">
            <button class="save-edit-button" data-index="${index}" title="Save Changes">${ICONS.save}</button>
            <button class="cancel-edit-button" title="Cancel">${ICONS.cancel}</button>
          </div>
        `;
      });
    }

    if (button.classList.contains('save-edit-button')) {
      const promptItem = button.closest('.prompt-item');
      const newName = promptItem.querySelector('.edit-prompt-name').value.trim();
      const newPrompt = promptItem.querySelector('.edit-prompt-prompt').value.trim();
      
      if (newName && newPrompt) {
        chrome.storage.sync.get({prompts: []}, (result) => {
          const prompts = result.prompts;
          if (prompts.some((p, i) => p.name === newName && i != index)) {
            alert('A prompt with this name already exists.');
            return;
          }
          prompts[index] = { name: newName, prompt: newPrompt };
          savePrompts(prompts, loadPrompts);
        });
      } else {
        alert('Prompt name and text cannot be empty.');
      }
    }

    if (button.classList.contains('cancel-edit-button')) {
      loadPrompts();
    }
  });

  // Initial load
  loadPrompts();
});