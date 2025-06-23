"""
IntelliFlow Backend Service
Enhanced backend service that integrates with the multi-agent system for real data processing.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import io
import json
import asyncio
import sys
import os
sys.path.append('/home/ubuntu/IntelliFlow/agents')
sys.path.append('/home/ubuntu/IntelliFlow/')
from agents.orchestrator.main import OrchestratorAgent
from common.adk import Message

# Add the agents directory to the Python path
sys.path.append('/home/ubuntu/IntelliFlow/agents')

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route("/api/analyze", methods=["POST"])
def analyze_data():
    """
    Analyze uploaded data using the enhanced multi-agent system.
    """
    try:
        data = request.get_json()
        
        # Extract analysis configuration
        analysis_config = data.get("analysisConfig", {})
        file_contents = analysis_config.get("data_source", {}).get("file_contents", [])
        
        if not file_contents:
            return jsonify({
                "status": "error",
                "message": "No file contents provided"
            }), 400
        
        # Process the uploaded data using the OrchestratorAgent
        orchestrator = OrchestratorAgent(config={})
        
        # Run the async function in a new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(orchestrator.handle_start_analysis(Message(
                sender="backend_service",
                intent="start_analysis",
                content={
                    "analysis_config": analysis_config,
                    "data": {"file_contents": file_contents}
                }
            )))
        finally:
            loop.close()
        
        return jsonify(result.content)
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Analysis failed: {str(e)}"
        }), 500



@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'IntelliFlow Backend',
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

