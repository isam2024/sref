/* app.js - Main application logic */

class App {
  constructor() {
    this.db = new SrefDatabase();
    this.setupEventListeners();
    this.loadSavedSets();

    // Hide result area initially
    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'none';

    // Track current set
    this.currentSetId = null;
    this.currentBaseNumber = null;
    this.selectedFile = null;
    this.currentSrefValues = [];
  }

  generateIncrements(baseNumber) {
    return Array.from({ length: 10 }, (_, i) => baseNumber + i);
  }

  generatePrompt(numbers) {
    return `--sref {${numbers.join(', ')}}`;
  }

  generateRandomSet(randomnessLevel = 500) {
    const max = 1409621067;
    const min = 1;
    const range = max - min;
    const variance = Math.floor(range * (randomnessLevel / 1000));
    const base = Math.floor(Math.random() * (range - variance + 1)) + min;
    return base;
  }

  async createSet(baseNumber, notes = '') {
    try {
      const isUsed = await this.db.isSetUsed(baseNumber);
      if (isUsed) {
        this.showMessage(
          `Set starting with ${baseNumber} overlaps with existing sets`,
          'error'
        );
        return false;
      }

      const setId = await this.db.addSet(baseNumber, notes);
      this.currentSetId = setId;
      this.currentBaseNumber = baseNumber;
      this.currentSrefValues = this.generateIncrements(baseNumber);
      this.loadSavedSets();
      return true;
    } catch (error) {
      this.showMessage(`Error creating set: ${error}`, 'error');
      return false;
    }
  }

  async findUnusedRandomSet(maxAttempts = 100, randomnessLevel = 500) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const baseNumber = this.generateRandomSet(randomnessLevel);
      const isUsed = await this.db.isSetUsed(baseNumber);
      if (!isUsed) {
        return baseNumber;
      }
      attempts++;
    }
    throw new Error(
      'Could not find an unused random set after maximum attempts'
    );
  }

  async displaySetResult(baseNumber) {
    // Find the setId for this base number
    try {
      const sets = await this.db.getAllSets();
      const setData = sets.find((set) => set.baseNumber === baseNumber);

      if (setData) {
        this.currentSetId = setData.id;
        this.currentBaseNumber = baseNumber;
      } else {
        this.currentSetId = null;
        this.currentBaseNumber = baseNumber;
      }

      const numbers = this.generateIncrements(baseNumber);
      this.currentSrefValues = numbers;
      const prompt = this.generatePrompt(numbers);

      const resultArea = document.getElementById('resultArea');
      const resultNumbers = document.getElementById('resultNumbers');
      const resultPrompt = document.getElementById('resultPrompt');
      const uploadArea = document.getElementById('uploadArea');

      resultNumbers.textContent = numbers.join(', ');
      resultPrompt.textContent = prompt;

      // Hide upload area when displaying results
      uploadArea.style.display = 'none';

      // Show result area with animation
      resultArea.style.display = 'block';
      setTimeout(() => {
        resultArea.classList.add('show');
      }, 10);

      // Scroll to the result
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Populate the sref value select dropdown
      this.populateSrefValueSelect();

      // If we have a valid set ID, load any images
      if (this.currentSetId) {
        this.loadSetDetails(this.currentSetId, baseNumber);
      }
    } catch (error) {
      this.showMessage(`Error retrieving set data: ${error}`, 'error');
    }
  }

  populateSrefValueSelect() {
    const srefValueSelect = document.getElementById('srefValueSelect');

    // Clear existing options
    srefValueSelect.innerHTML = '';

    // Add options for each sref value in the current set
    if (this.currentSrefValues && this.currentSrefValues.length > 0) {
      this.currentSrefValues.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        srefValueSelect.appendChild(option);
      });
    }
  }

  async loadSavedSets() {
    try {
      const sets = await this.db.getAllSets();
      const setsList = document.getElementById('setsList');
      const noSetsMessage = document.getElementById('noSetsMessage');
      const setsTable = document.getElementById('setsTable');

      setsList.innerHTML = '';

      if (sets.length === 0) {
        noSetsMessage.style.display = 'block';
        setsTable.style.display = 'none';
      } else {
        noSetsMessage.style.display = 'none';
        setsTable.style.display = 'table';

        sets.forEach((set) => {
          const row = document.createElement('tr');

          const rangeCell = document.createElement('td');
          rangeCell.textContent = `${set.baseNumber} - ${set.baseNumber + 9}`;

          const dateCell = document.createElement('td');
          dateCell.textContent = new Date(set.timestamp).toLocaleString(
            undefined,
            {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }
          );

          const notesCell = document.createElement('td');
          notesCell.textContent = set.notes || '-';

          const actionsCell = document.createElement('td');
          const actionDiv = document.createElement('div');
          actionDiv.className = 'table-actions';

          const viewBtn = document.createElement('button');
          viewBtn.className = 'view-btn';
          viewBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        View
                    `;
          viewBtn.addEventListener('click', () => {
            this.displaySetResult(set.baseNumber);
          });

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn';
          deleteBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        Delete
                    `;
          deleteBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete set ${set.baseNumber}?`)) {
              await this.db.deleteSet(set.id);
              this.loadSavedSets();
              this.showMessage(
                `Set ${set.baseNumber} deleted successfully`,
                'success'
              );
            }
          });

          actionDiv.appendChild(viewBtn);
          actionDiv.appendChild(deleteBtn);
          actionsCell.appendChild(actionDiv);

          row.appendChild(rangeCell);
          row.appendChild(dateCell);
          row.appendChild(notesCell);
          row.appendChild(actionsCell);

          setsList.appendChild(row);
        });
      }
    } catch (error) {
      this.showMessage(`Error loading sets: ${error}`, 'error');
    }
  }

  showMessage(message, type = 'success') {
    const messagesContainer = document.getElementById('messages-container');

    // Create message element
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);

    // Icon based on message type
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="message-icon">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            `;
    } else {
      iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="message-icon">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            `;
    }

    // Close button
    const closeBtn = `
            <button class="message-close">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

    messageElement.innerHTML = iconSvg + message + closeBtn;

    // Add to container
    messagesContainer.prepend(messageElement);

    // Add close button event listener
    const closeButton = messageElement.querySelector('.message-close');
    closeButton.addEventListener('click', () => {
      messageElement.remove();
    });

    // Remove message after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      this.showMessage('Please select an image file', 'error');
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imagePreview = document.getElementById('imagePreview');
      imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;

      // Enable upload button
      document.getElementById('uploadImage').disabled = false;
    };

    reader.readAsDataURL(file);
  }

  handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.add('dragover');
  }

  handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.remove('dragover');
  }

  handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const uploadArea = document.getElementById('uploadArea');
    uploadArea.classList.remove('dragover');

    const fileInput = document.getElementById('imageFile');

    if (event.dataTransfer.files.length) {
      fileInput.files = event.dataTransfer.files;

      // Trigger the change event manually
      const changeEvent = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(changeEvent);
    }
  }

  async saveImageToSet() {
    if (!this.selectedFile || !this.currentSetId) {
      this.showMessage('No file selected or no active set', 'error');
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const imageData = e.target.result;

          // Get the selected sref value
          const srefValueSelect = document.getElementById('srefValueSelect');
          const selectedSrefValue = parseInt(srefValueSelect.value);

          await this.db.saveImage(
            this.currentSetId,
            imageData,
            selectedSrefValue
          );

          this.showMessage(
            `Image saved successfully for sref value: ${selectedSrefValue}`
          );

          // Reset the upload area
          document.getElementById('uploadArea').style.display = 'none';
          document.getElementById('imagePreview').innerHTML = '';
          document.getElementById('imageFile').value = '';
          document.getElementById('uploadImage').disabled = true;
          this.selectedFile = null;

          // Refresh the images
          this.loadSetDetails(this.currentSetId, this.currentBaseNumber);
        } catch (error) {
          this.showMessage(`Error saving image: ${error}`, 'error');
        }
      };

      reader.readAsDataURL(this.selectedFile);
    } catch (error) {
      this.showMessage(`Error processing image: ${error}`, 'error');
    }
  }

  async loadSetDetails(setId, baseNumber) {
    try {
      // Load images for the set, grouped by sref value
      const groupedImages = await this.db.getImagesGroupedBySref(setId);

      // Remove existing images container if it exists
      const existingContainer = document.querySelector('.images-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Create a new images container
      const imagesContainer = document.createElement('div');
      imagesContainer.className = 'images-container';

      // Insert after the result area
      const resultArea = document.getElementById('resultArea');
      resultArea.parentNode.insertBefore(
        imagesContainer,
        resultArea.nextSibling
      );

      // Check if there are any images
      const allImages = Object.values(groupedImages).flat();

      // Update content
      if (allImages.length === 0) {
        imagesContainer.innerHTML =
          '<p class="no-images">No reference images for this set. Click "Add Reference Image" to add some.</p>';
      } else {
        imagesContainer.innerHTML = '<h3>Reference Images</h3>';

        // Sort the sref values numerically
        const srefValues = Object.keys(groupedImages).sort((a, b) => {
          // Handle 'unassigned' specially
          if (a === 'unassigned') return 1;
          if (b === 'unassigned') return -1;
          return parseInt(a) - parseInt(b);
        });

        // For each sref value, create a group of images
        srefValues.forEach((srefValue) => {
          const images = groupedImages[srefValue];
          if (!images || images.length === 0) return;

          const group = document.createElement('div');
          group.className = 'image-group';

          const groupHeader = document.createElement('div');
          groupHeader.className = 'image-group-header';

          const srefBadge = document.createElement('div');
          srefBadge.className = 'sref-badge';
          srefBadge.textContent =
            srefValue === 'unassigned' ? 'Unassigned' : `Sref Value: ${srefValue}`;

          groupHeader.appendChild(srefBadge);
          group.appendChild(groupHeader);

          const grid = document.createElement('div');
          grid.className = 'images-grid';

          images.forEach((image) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';

            const img = document.createElement('img');
            img.src = image.data;
            img.alt = `Reference for sref value ${srefValue}`;

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'image-delete';
            deleteBtn.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

            deleteBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              if (confirm('Delete this reference image?')) {
                await this.db.deleteImage(image.id);
                this.loadSetDetails(setId, baseNumber);
                this.showMessage('Image deleted successfully');
              }
            });

            imageItem.appendChild(img);
            imageItem.appendChild(deleteBtn);
            grid.appendChild(imageItem);
          });

          group.appendChild(grid);
          imagesContainer.appendChild(group);
        });
      }
    } catch (error) {
      this.showMessage(`Error loading images: ${error}`, 'error');
    }
  }

  setupEventListeners() {
    // Randomness level slider
    const randomnessLevelInput = document.getElementById('randomnessLevel');
    const randomnessValueSpan = document.getElementById('randomnessValue');

    randomnessLevelInput.addEventListener('input', () => {
      randomnessValueSpan.textContent = randomnessLevelInput.value;
    });

    // Random set generation
    document
      .getElementById('generateRandom')
      .addEventListener('click', async () => {
        try {
          const randomnessLevel = parseInt(randomnessLevelInput.value);
          const baseNumber = await this.findUnusedRandomSet(
            100,
            randomnessLevel
          );
          const notesInput = document.getElementById('setNotes');
          const notes = notesInput.value;

          const success = await this.createSet(baseNumber, notes);
          if (success) {
            this.displaySetResult(baseNumber);
            this.showMessage(`Generated random set starting at: ${baseNumber}`);
            notesInput.value = '';
          }
        } catch (error) {
          this.showMessage(error.message, 'error');
        }
      });

    // Manual set creation
    document
      .getElementById('generateManual')
      .addEventListener('click', async () => {
        const baseNumberInput = document.getElementById('baseNumber');
        const baseNumber = parseInt(baseNumberInput.value);
        const notesInput = document.getElementById('setNotes');
        const notes = notesInput.value;

        if (isNaN(baseNumber)) {
          this.showMessage('Please enter a valid number', 'error');
          return;
        }

        const success = await this.createSet(baseNumber, notes);
        if (success) {
          this.displaySetResult(baseNumber);
          this.showMessage(`Created set starting at: ${baseNumber}`);
          baseNumberInput.value = '';
          notesInput.value = '';
        }
      });

    // Copy prompt button
    document.getElementById('copyPrompt').addEventListener('click', () => {
      const promptText = document.getElementById('resultPrompt').textContent;
      navigator.clipboard
        .writeText(promptText)
        .then(() => {
          this.showMessage('Prompt copied to clipboard!');
        })
        .catch((err) => {
          this.showMessage('Failed to copy: ' + err, 'error');
        });
    });

    // Add image button
    document.getElementById('addImageBtn').addEventListener('click', () => {
      if (!this.currentSetId) {
        this.showMessage('Please generate or select a set first', 'error');
        return;
      }

      const uploadArea = document.getElementById('uploadArea');

      if (uploadArea.style.display === 'none' || !uploadArea.style.display) {
        uploadArea.style.display = 'block';
        this.populateSrefValueSelect();
      } else {
        uploadArea.style.display = 'none';
      }
    });

    // File input change
    document.getElementById('imageFile').addEventListener('change', (event) => {
      this.handleFileSelect(event);
    });

    // Upload button
    document.getElementById('uploadImage').addEventListener('click', () => {
      this.saveImageToSet();
    });

    // Cancel upload button
    document.getElementById('cancelUpload').addEventListener('click', () => {
      document.getElementById('uploadArea').style.display = 'none';
      document.getElementById('imagePreview').innerHTML = '';
      document.getElementById('imageFile').value = '';
      document.getElementById('uploadImage').disabled = true;
      this.selectedFile = null;
    });

    // Drag and drop support
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', (event) => this.handleDragOver(event));
    uploadArea.addEventListener('dragleave', (event) =>
      this.handleDragLeave(event)
    );
    uploadArea.addEventListener('drop', (event) => this.handleDrop(event));

    // File drop zone
    const fileLabel = document.querySelector('.file-label');
    fileLabel.addEventListener('dragover', (event) => this.handleDragOver(event));
    fileLabel.addEventListener('dragleave', (event) =>
      this.handleDragLeave(event)
    );
    fileLabel.addEventListener('drop', (event) => this.handleDrop(event));
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
});
