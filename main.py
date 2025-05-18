"""
Main application entry point for IntelliFlow.

This module initializes and starts the IntelliFlow multi-agent system.
"""

import asyncio
import argparse
import json
import logging
import os
from typing import Dict, Any

from common.logging.logger import setup_logging
from common.utils.config import load_config
from agents.orchestrator.main import OrchestratorAgent
from agents.data_scout.main import DataScoutAgent
from agents.data_engineer.main import DataEngineerAgent
from agents.analysis_strategist.main import AnalysisStrategyAgent
from agents.insight_generator.main import InsightGeneratorAgent
from agents.visualization_specialist.main import VisualizationSpecialistAgent
from agents.narrative_composer.main import NarrativeComposerAgent
from orchestration.message_bus.pubsub import MessageBus

# Setup logging
setup_logging()
logger = logging.getLogger("intelliflow")

async def register_agents(orchestrator: OrchestratorAgent, agents: Dict[str, Any]) -> None:
    """
    Register all agents with the orchestrator.
    
    Args:
        orchestrator: Orchestrator agent
        agents: Dictionary of agent instances
    """
    for agent_id, agent in agents.items():
        await orchestrator.handle_register_agent({
            "agent_id": agent_id,
            "agent_info": {
                "name": agent.name,
                "capabilities": [handler for handler in agent._message_handlers.keys()]
            }
        })
        logger.info(f"Registered agent: {agent_id}")

async def start_analysis(orchestrator: OrchestratorAgent, analysis_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Start an analysis workflow.
    
    Args:
        orchestrator: Orchestrator agent
        analysis_config: Analysis configuration
        
    Returns:
        Analysis result
    """
    response = await orchestrator.handle_start_analysis({
        "analysis_type": analysis_config.get("type", "complete"),
        "data_source": analysis_config.get("data_source", {}),
        "objectives": analysis_config.get("objectives", []),
        "parameters": analysis_config.get("parameters", {})
    })
    
    return response.content

async def main(config_path: str, analysis_config_path: str = None) -> None:
    """
    Main entry point for IntelliFlow.
    
    Args:
        config_path: Path to configuration file
        analysis_config_path: Path to analysis configuration file
    """
    # Load configuration
    config = load_config(config_path)
    logger.info(f"Loaded configuration from {config_path}")
    
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
    await register_agents(agents["orchestrator"], {k: v for k, v in agents.items() if k != "orchestrator"})
    
    # If analysis configuration is provided, start analysis
    if analysis_config_path:
        with open(analysis_config_path, 'r') as f:
            analysis_config = json.load(f)
        
        logger.info(f"Starting analysis with configuration from {analysis_config_path}")
        result = await start_analysis(agents["orchestrator"], analysis_config)
        
        logger.info(f"Analysis completed: {result.get('status')}")
        if result.get("status") == "success":
            logger.info(f"Analysis summary: {result.get('summary')}")
    else:
        logger.info("No analysis configuration provided, system initialized and ready")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IntelliFlow Multi-Agent Data Analysis Platform")
    parser.add_argument("--config", default="config/default.json", help="Path to configuration file")
    parser.add_argument("--analysis", help="Path to analysis configuration file")
    
    args = parser.parse_args()
    
    asyncio.run(main(args.config, args.analysis))
