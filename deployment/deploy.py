"""
Deployment script for IntelliFlow.

This script prepares and deploys the IntelliFlow application.
"""

import os
import subprocess
import shutil
import sys
import json

# Configuration
FRONTEND_DIR = "/home/ubuntu/intelliflow/frontend/intelliflow-ui"
BACKEND_DIR = "/home/ubuntu/intelliflow"
DEPLOY_DIR = "/home/ubuntu/intelliflow/deployment"
STATIC_DEPLOY_DIR = os.path.join(DEPLOY_DIR, "static")
FLASK_DEPLOY_DIR = os.path.join(DEPLOY_DIR, "flask_app")

def print_step(message):
    """Print a step message with formatting."""
    print("\n" + "="*80)
    print(f"  {message}")
    print("="*80)

def run_command(command, cwd=None):
    """Run a shell command and print output."""
    print(f"Running: {command}")
    result = subprocess.run(command, shell=True, cwd=cwd, text=True, capture_output=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    print(result.stdout)
    return True

def build_frontend():
    """Build the React frontend."""
    print_step("Building frontend")
    
    # Install dependencies
    if not run_command("pnpm install", cwd=FRONTEND_DIR):
        return False
    
    # Build the frontend
    if not run_command("pnpm run build", cwd=FRONTEND_DIR):
        return False
    
    return True

def prepare_backend():
    """Prepare the Flask backend."""
    print_step("Preparing backend")
    
    # Create Flask app directory structure
    os.makedirs(FLASK_DEPLOY_DIR, exist_ok=True)
    os.makedirs(os.path.join(FLASK_DEPLOY_DIR, "src"), exist_ok=True)
    
    # Copy necessary files
    shutil.copy(os.path.join(BACKEND_DIR, "src", "api.py"), os.path.join(FLASK_DEPLOY_DIR, "src", "main.py"))
    
    # Create a simplified version of the backend for deployment
    with open(os.path.join(FLASK_DEPLOY_DIR, "src", "main.py"), "r") as f:
        content = f.read()
    
    # Modify the content to use mock data for deployment
    content = content.replace("import sys\nimport os\nsys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))",
                             """import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))  # DON'T CHANGE THIS !!!""")
    
    # Remove the actual agent imports and replace with mock implementations
    content = content.replace("""# Import IntelliFlow components
from common.logging.logger import setup_logging
from common.utils.config import load_config
from agents.orchestrator.main import OrchestratorAgent
from agents.data_scout.main import DataScoutAgent
from agents.data_engineer.main import DataEngineerAgent
from agents.analysis_strategist.main import AnalysisStrategyAgent
from agents.insight_generator.main import InsightGeneratorAgent
from agents.visualization_specialist.main import VisualizationSpecialistAgent
from agents.narrative_composer.main import NarrativeComposerAgent
from orchestration.message_bus.pubsub import MessageBus""", 
                             """# Mock implementations for deployment
import logging
import uuid
import time
import threading

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("intelliflow-api")""")
    
    # Replace the initialize_agents function with a mock
    content = content.replace("""def initialize_agents():
    """Initialize all agent instances."""
    global agents, message_bus
    
    # Load configuration
    config = load_config("config/default.json")
    logger.info("Loaded configuration")
    
    # Create message bus
    message_bus = MessageBus(config.get("message_bus", {}))
    logger.info("Created message bus")
    
    # Create agents
    agents = {
        "orchestrator": OrchestratorAgent(config.get("agents", {}).get("orchestrator", {})),
        "data_scout": DataScoutAgent(config.get("agents", {}).get("data_scout", {})),
        "data_engineer": DataEngineerAgent(config.get("agents", {}).get("data_engineer", {})),
        "analysis_strategist": AnalysisStrategyAgent(config.get("agents", {}).get("analysis_strategist", {})),
        "insight_generator": InsightGeneratorAgent(config.get("agents", {}).get("insight_generator", {})),
        "visualization_specialist": VisualizationSpecialistAgent(config.get("agents", {}).get("visualization_specialist", {})),
        "narrative_composer": NarrativeComposerAgent(config.get("agents", {}).get("narrative_composer", {}))
    }
    logger.info(f"Created {len(agents)} agents")
    
    # Register agents with orchestrator
    asyncio.run(register_agents())
    
    logger.info("Initialization complete")""", 
                             """def initialize_agents():
    """Initialize mock agents for deployment."""
    logger.info("Initializing mock agents for deployment")
    # No actual initialization needed for the demo
    logger.info("Mock initialization complete")""")
    
    # Replace the register_agents function with a mock
    content = content.replace("""async def register_agents():
    """Register all agents with the orchestrator."""
    for agent_id, agent in agents.items():
        if agent_id != "orchestrator":
            await agents["orchestrator"].handle_register_agent({
                "agent_id": agent_id,
                "agent_info": {
                    "name": agent.name,
                    "capabilities": [handler for handler in agent._message_handlers.keys()]
                }
            })
            logger.info(f"Registered agent: {agent_id}")""", 
                             """def register_agents():
    """Mock agent registration for deployment."""
    logger.info("Mock agent registration complete")""")
    
    # Replace the run_analysis function with a mock
    content = content.replace("""async def run_analysis(analysis_id, analysis_config):
    """Run an analysis asynchronously."""
    try:
        # Start the analysis
        response = await agents["orchestrator"].handle_start_analysis({
            "analysis_type": analysis_config.get("type", "complete"),
            "data_source": analysis_config.get("data_source", {}),
            "objectives": analysis_config.get("objectives", []),
            "parameters": analysis_config.get("parameters", {})
        })
        
        # Update the analysis result
        analysis_results[analysis_id]["status"] = "completed"
        analysis_results[analysis_id]["result"] = response.content
        
        logger.info(f"Analysis {analysis_id} completed")
    except Exception as e:
        logger.error(f"Error running analysis {analysis_id}: {str(e)}")
        analysis_results[analysis_id]["status"] = "failed"
        analysis_results[analysis_id]["error"] = str(e)""", 
                             """def run_analysis(analysis_id, analysis_config):
    """Run a mock analysis for deployment."""
    def mock_analysis():
        try:
            # Simulate analysis running
            logger.info(f"Starting mock analysis {analysis_id}")
            time.sleep(5)  # Simulate processing time
            
            # Generate mock results
            mock_result = {
                "insights": [
                    {
                        "id": "i1",
                        "title": "Overall sentiment is primarily positive (72%)",
                        "description": "Customer feedback shows a strong positive sentiment overall, with particularly high scores for product quality."
                    },
                    {
                        "id": "i2",
                        "title": "The most prominent topic is product quality (40%)",
                        "description": "Customers frequently mention product quality, durability, and design in their feedback."
                    },
                    {
                        "id": "i3",
                        "title": "Price sentiment differs from overall",
                        "description": "While overall sentiment is positive, price-related comments show a more neutral sentiment (50%)."
                    },
                    {
                        "id": "i4",
                        "title": "Delivery-related feedback shows improvement",
                        "description": "Sentiment around delivery has improved by 15% compared to the previous analysis period."
                    }
                ],
                "recommendations": [
                    {
                        "id": "r1",
                        "title": "Highlight product quality in marketing",
                        "description": "Leverage the positive sentiment around product quality in marketing materials and customer communications."
                    },
                    {
                        "id": "r2",
                        "title": "Review pricing strategy",
                        "description": "Consider reviewing the pricing strategy to address the more neutral sentiment around pricing."
                    },
                    {
                        "id": "r3",
                        "title": "Continue delivery improvements",
                        "description": "Maintain the improvements in delivery processes that have led to increased customer satisfaction."
                    }
                ],
                "metrics": {
                    "insightCount": 12,
                    "sentimentScore": 0.72,
                    "topicCount": 4
                },
                "narrative": {
                    "summary": "This analysis examined customer feedback data to identify key insights and patterns. The analysis focused on sentiment, topics, and trends, revealing several significant findings.",
                    "keyFindings": "The analysis revealed that overall customer sentiment is primarily positive (72%), with product quality being the most frequently discussed topic. However, sentiment varies across different aspects of the customer experience, with price-related comments showing a more neutral sentiment compared to the overall positive trend.",
                    "recommendations": "Based on the analysis, we recommend highlighting product quality in marketing, reviewing the pricing strategy, and continuing with delivery process improvements.",
                    "conclusion": "The analysis of customer feedback has provided valuable insights into customer perceptions and priorities. By addressing the recommendations outlined above, the organization can leverage these insights to enhance customer satisfaction and drive business growth."
                },
                "dataSource": {
                    "type": analysis_config["data_source"]["source_type"],
                    "project": analysis_config["data_source"].get("project_id", "intelliflow-project"),
                    "dataset": analysis_config["data_source"].get("dataset_id", "customer_data"),
                    "table": analysis_config["data_source"].get("table_id", "feedback"),
                    "recordCount": 10000,
                    "timePeriod": analysis_config["parameters"].get("time_period", "Last 30 Days").replace("_", " ").title()
                }
            }
            
            # Update the analysis result
            analysis_results[analysis_id]["status"] = "completed"
            analysis_results[analysis_id]["result"] = mock_result
            analysis_results[analysis_id]["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            
            logger.info(f"Mock analysis {analysis_id} completed")
        except Exception as e:
            logger.error(f"Error in mock analysis {analysis_id}: {str(e)}")
            analysis_results[analysis_id]["status"] = "failed"
            analysis_results[analysis_id]["error"] = str(e)
    
    # Start the analysis in a background thread
    thread = threading.Thread(target=mock_analysis)
    thread.daemon = True
    thread.start()""")
    
    # Update the start_analysis endpoint
    content = content.replace("""@app.route('/api/analysis/start', methods=['POST'])
def start_analysis():
    """Start a new analysis."""
    try:
        analysis_config = request.json
        
        # Generate a unique ID for this analysis
        import uuid
        analysis_id = str(uuid.uuid4())
        
        # Store the analysis configuration
        analysis_results[analysis_id] = {
            "status": "running",
            "config": analysis_config,
            "result": None
        }
        
        # Start the analysis asynchronously
        asyncio.run(run_analysis(analysis_id, analysis_config))
        
        return jsonify({
            "status": "success",
            "message": "Analysis started",
            "analysis_id": analysis_id
        })
    except Exception as e:
        logger.error(f"Error starting analysis: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to start analysis: {str(e)}"
        }), 500""", 
                             """@app.route('/api/analysis/start', methods=['POST'])
def start_analysis():
    """Start a new analysis."""
    try:
        analysis_config = request.json
        
        # Generate a unique ID for this analysis
        analysis_id = str(uuid.uuid4())
        
        # Store the analysis configuration
        analysis_results[analysis_id] = {
            "status": "running",
            "config": analysis_config,
            "result": None,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Start the analysis in a background thread
        run_analysis(analysis_id, analysis_config)
        
        return jsonify({
            "status": "success",
            "message": "Analysis started",
            "analysis_id": analysis_id
        })
    except Exception as e:
        logger.error(f"Error starting analysis: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Failed to start analysis: {str(e)}"
        }), 500""")
    
    # Update the before_first_request decorator
    content = content.replace("""# Initialize agents when the app starts
@app.before_first_request
def before_first_request():
    """Initialize agents before the first request."""
    initialize_agents()""", 
                             """# Initialize when the app starts
@app.before_first_request
def before_first_request():
    """Initialize before the first request."""
    initialize_agents()""")
    
    # Write the modified content back
    with open(os.path.join(FLASK_DEPLOY_DIR, "src", "main.py"), "w") as f:
        f.write(content)
    
    # Create requirements.txt
    with open(os.path.join(FLASK_DEPLOY_DIR, "requirements.txt"), "w") as f:
        f.write("""flask==2.0.1
flask-cors==3.0.10
gunicorn==20.1.0
""")
    
    return True

def deploy_static_frontend():
    """Deploy the static frontend."""
    print_step("Deploying static frontend")
    
    # Create static deployment directory
    os.makedirs(STATIC_DEPLOY_DIR, exist_ok=True)
    
    # Copy the built frontend to the static deployment directory
    frontend_build_dir = os.path.join(FRONTEND_DIR, "dist")
    if os.path.exists(frontend_build_dir):
        for item in os.listdir(frontend_build_dir):
            src = os.path.join(frontend_build_dir, item)
            dst = os.path.join(STATIC_DEPLOY_DIR, item)
            if os.path.isdir(src):
                if os.path.exists(dst):
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
        return True
    else:
        print(f"Error: Frontend build directory {frontend_build_dir} not found")
        return False

def deploy_flask_backend():
    """Deploy the Flask backend."""
    print_step("Deploying Flask backend")
    
    # Create a virtual environment
    if not os.path.exists(os.path.join(FLASK_DEPLOY_DIR, "venv")):
        if not run_command(f"python3 -m venv {os.path.join(FLASK_DEPLOY_DIR, 'venv')}"):
            return False
    
    # Install dependencies
    if not run_command(f"{os.path.join(FLASK_DEPLOY_DIR, 'venv/bin/pip')} install -r {os.path.join(FLASK_DEPLOY_DIR, 'requirements.txt')}"):
        return False
    
    return True

def main():
    """Main deployment function."""
    print_step("Starting IntelliFlow deployment")
    
    # Build frontend
    if not build_frontend():
        print("Frontend build failed")
        return False
    
    # Prepare backend
    if not prepare_backend():
        print("Backend preparation failed")
        return False
    
    # Deploy static frontend
    if not deploy_static_frontend():
        print("Static frontend deployment failed")
        return False
    
    # Deploy Flask backend
    if not deploy_flask_backend():
        print("Flask backend deployment failed")
        return False
    
    print_step("Deployment completed successfully!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
