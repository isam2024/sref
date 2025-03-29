// Settings JavaScript file
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const ollamaEndpointInput = document.getElementById('ollamaEndpoint');
    const saveOllamaEndpointBtn = document.getElementById('saveOllamaEndpoint');
    const connectOllamaBtn = document.getElementById('connectOllama');
    const endpointStatusEl = document.getElementById('endpointStatus');

    // URL validation regex
    const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    
    // Function to validate URL format
    function isValidUrl(url) {
        return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || urlRegex.test(url);
    }

    // Function to update status with appropriate class
    function updateStatus(message, type) {
        endpointStatusEl.textContent = message;
        endpointStatusEl.className = type; // Apply the CSS class
    }

    // Load saved endpoint from localStorage if it exists
    const savedEndpoint = localStorage.getItem('ollamaEndpoint');
    if (savedEndpoint) {
        ollamaEndpointInput.value = savedEndpoint;
        updateStatus('Endpoint saved. Connection status: Not connected', 'warning');
    }

    // Save Ollama endpoint to localStorage
    saveOllamaEndpointBtn.addEventListener('click', () => {
        const endpointUrl = ollamaEndpointInput.value.trim();
        
        if (!endpointUrl) {
            updateStatus('Please enter a valid endpoint URL', 'error');
            return;
        }

        if (!isValidUrl(endpointUrl)) {
            updateStatus('Please enter a properly formatted URL', 'error');
            return;
        }

        localStorage.setItem('ollamaEndpoint', endpointUrl);
        updateStatus('Endpoint saved successfully. Connection status: Not connected', 'success');
        
        // Clear success status after 3 seconds
        setTimeout(() => {
            updateStatus('Endpoint saved. Connection status: Not connected', 'warning');
        }, 3000);
    });

    // Test connection to Ollama endpoint
    connectOllamaBtn.addEventListener('click', async () => {
        const endpointUrl = ollamaEndpointInput.value.trim();
        
        if (!endpointUrl) {
            updateStatus('Please enter and save an endpoint URL first', 'error');
            return;
        }

        if (!isValidUrl(endpointUrl)) {
            updateStatus('Please enter a properly formatted URL', 'error');
            return;
        }

        updateStatus('Testing connection...', 'info');

        try {
            const response = await fetch(`${endpointUrl}/api/version`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                updateStatus(`Connected successfully! Ollama version: ${data.version}`, 'success');
            } else {
                updateStatus(`Connection failed: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            updateStatus(`Connection error: ${error.message}`, 'error');
        }
    });
});