#!/bin/bash
set -e
echo "Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh
echo "Pulling models..."
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5-coder:14b
echo "Testing connection..."
curl -s http://127.0.0.1:11434/api/tags | head -20
echo "Ollama installation complete!"
