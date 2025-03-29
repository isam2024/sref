// Settings JavaScript file
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const ollamaEndpointInput = document.getElementById('ollamaEndpoint');
    const saveOllamaEndpointBtn = document.getElementById('saveOllamaEndpoint');
    const connectOllamaBtn = document.getElementById('connectOllama');
    const endpointStatusEl = document.getElementById('endpointStatus');

    // Load saved endpoint from localStorage if it exists
    const savedEndpoint = localStorage.getItem('ollamaEndpoint');
    if (savedEndpoint) {
        ollamaEndpointInput.value = savedEndpoint;
        endpointStatusEl.textContent = 'Endpoint saved. Connection status: Not connected';
        endpointStatusEl.style.color = 'orange';
    }

    // Save Ollama endpoint to localStorage
    saveOllamaEndpointBtn.addEventListener('click', () => {
        const endpointUrl = ollamaEndpointInput.value.trim();
        
        if (!endpointUrl) {
            endpointStatusEl.textContent = 'Please enter a valid endpoint URL';
            endpointStatusEl.style.color = 'red';
            return;
        }

        localStorage.setItem('ollamaEndpoint', endpointUrl);
        endpointStatusEl.textContent = 'Endpoint saved successfully. Connection status: Not connected';
        endpointStatusEl.style.color = 'green';
        
        // Clear status after 3 seconds
        setTimeout(() => {
            endpointStatusEl.textContent = 'Endpoint saved. Connection status: Not connected';
            endpointStatusEl.style.color = 'orange';
        }, 3000);
    });

    // Test connection to Ollama endpoint
    connectOllamaBtn.addEventListener('click', async () => {
        const endpointUrl = ollamaEndpointInput.value.trim();
        
        if (!endpointUrl) {
            endpointStatusEl.textContent = 'Please enter and save an endpoint URL first';
            endpointStatusEl.style.color = 'red';
            return;
        }

        endpointStatusEl.textContent = 'Testing connection...';
        endpointStatusEl.style.color = 'blue';

        try {
            const response = await fetch(`${endpointUrl}/api/version`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                endpointStatusEl.textContent = `Connected successfully! Ollama version: ${data.version}`;
                endpointStatusEl.style.color = 'green';
            } else {
                endpointStatusEl.textContent = `Connection failed: ${response.status} ${response.statusText}`;
                endpointStatusEl.style.color = 'red';
            }
        } catch (error) {
            endpointStatusEl.textContent = `Connection error: ${error.message}`;
            endpointStatusEl.style.color = 'red';
        }
    });
});