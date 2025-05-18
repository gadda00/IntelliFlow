"""
Narrative Composer Agent implementation.

This agent is responsible for creating natural language explanations of analytical findings.
"""

import asyncio
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.narrative_composer")

class NaturalLanguageGenerationTool(Tool):
    """Tool for generating natural language explanations."""
    
    def __init__(self):
        super().__init__(name="NaturalLanguageGenerationTool", description="Generate natural language explanations of analytical findings")
    
    async def execute(self, insights: List[Dict[str, Any]], context: Dict[str, Any] = None, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute natural language generation.
        
        Args:
            insights: List of insights to explain
            context: Additional context information
            parameters: Generation parameters
            
        Returns:
            Generated narrative
        """
        logger.info(f"Generating narrative for {len(insights)} insights")
        
        # This would use NLG libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        context = context or {}
        
        # Sort insights by importance
        importance_order = {"high": 0, "medium": 1, "low": 2}
        sorted_insights = sorted(insights, key=lambda x: importance_order.get(x.get("importance", "low"), 3))
        
        # Generate narrative sections
        sections = []
        
        # Introduction
        introduction = {
            "title": "Executive Summary",
            "content": f"This analysis examined {context.get('data_description', 'the provided data')} to identify key insights and patterns. "
                      f"The analysis focused on {context.get('analysis_focus', 'multiple aspects of the data')} and revealed several significant findings."
        }
        sections.append(introduction)
        
        # Key Findings
        key_findings = []
        for insight in sorted_insights:
            if insight.get("importance") == "high":
                key_findings.append(insight.get("description", ""))
        
        if key_findings:
            key_findings_section = {
                "title": "Key Findings",
                "content": "The analysis revealed the following key findings:\n\n" + 
                          "\n".join([f"- {finding}" for finding in key_findings])
            }
            sections.append(key_findings_section)
        
        # Detailed Analysis
        detailed_insights = {}
        for insight in sorted_insights:
            insight_type = insight.get("type", "other")
            if insight_type not in detailed_insights:
                detailed_insights[insight_type] = []
            detailed_insights[insight_type].append(insight.get("description", ""))
        
        for insight_type, descriptions in detailed_insights.items():
            section_title = insight_type.capitalize() + " Analysis"
            section_content = f"The {insight_type} analysis revealed the following insights:\n\n" + \
                             "\n".join([f"- {desc}" for desc in descriptions])
            
            sections.append({
                "title": section_title,
                "content": section_content
            })
        
        # Recommendations
        if parameters.get("include_recommendations", True):
            recommendations = self._generate_recommendations(sorted_insights, context)
            if recommendations:
                sections.append({
                    "title": "Recommendations",
                    "content": "Based on the analysis, we recommend the following actions:\n\n" + 
                              "\n".join([f"- {rec}" for rec in recommendations])
                })
        
        # Conclusion
        conclusion = {
            "title": "Conclusion",
            "content": f"The analysis of {context.get('data_description', 'the data')} has provided valuable insights into "
                      f"{context.get('analysis_focus', 'the subject matter')}. "
                      f"By addressing the recommendations outlined above, the organization can leverage these insights to "
                      f"{parameters.get('conclusion_goal', 'improve decision-making and achieve better outcomes')}."
        }
        sections.append(conclusion)
        
        # Combine all sections into a complete narrative
        narrative = {
            "title": parameters.get("title", "Analysis Report"),
            "summary": introduction["content"],
            "sections": sections
        }
        
        result = {
            "status": "success",
            "narrative": narrative
        }
        
        return result
    
    def _generate_recommendations(self, insights: List[Dict[str, Any]], context: Dict[str, Any]) -> List[str]:
        """
        Generate recommendations based on insights.
        
        Args:
            insights: List of insights
            context: Additional context information
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        # This would use more sophisticated logic in a real implementation
        # For now, we'll use simple rules
        
        for insight in insights:
            insight_type = insight.get("type")
            description = insight.get("description", "").lower()
            
            if insight_type == "correlation" and "strong positive correlation" in description:
                recommendations.append(f"Leverage the positive relationship between the correlated variables to optimize outcomes.")
            
            elif insight_type == "correlation" and "strong negative correlation" in description:
                recommendations.append(f"Address the inverse relationship between the correlated variables in strategic planning.")
            
            elif insight_type == "clustering" and "distinct clusters" in description:
                recommendations.append(f"Develop targeted strategies for each identified segment to maximize effectiveness.")
            
            elif insight_type == "sentiment" and "primarily negative" in description:
                recommendations.append(f"Investigate the causes of negative sentiment and develop an action plan to address concerns.")
            
            elif insight_type == "sentiment" and "primarily positive" in description:
                recommendations.append(f"Identify and reinforce the factors contributing to positive sentiment.")
            
            elif insight_type == "topics" and "prominent topic" in description:
                topic = description.split("keywords:")[1].split(",")[0].strip() if "keywords:" in description else "identified"
                recommendations.append(f"Focus communication and development efforts on the {topic} topic to align with audience interests.")
        
        # Add generic recommendations if needed
        if not recommendations:
            recommendations = [
                "Continue monitoring key metrics to track progress and identify emerging trends.",
                "Share insights with relevant stakeholders to inform strategic decision-making.",
                "Conduct follow-up analysis to explore specific areas of interest in greater depth."
            ]
        
        return recommendations


class TemplateBasedNarrativeTool(Tool):
    """Tool for generating narratives using templates."""
    
    def __init__(self):
        super().__init__(name="TemplateBasedNarrativeTool", description="Generate narratives using predefined templates")
    
    async def execute(self, template_id: str, data: Dict[str, Any], parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute template-based narrative generation.
        
        Args:
            template_id: Template identifier
            data: Data to populate the template
            parameters: Generation parameters
            
        Returns:
            Generated narrative
        """
        logger.info(f"Generating narrative using template: {template_id}")
        
        # This would use a template system in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        
        # Simulate template selection
        templates = {
            "executive_summary": {
                "title": "Executive Summary",
                "structure": [
                    {"section": "Overview", "required": True},
                    {"section": "Key Findings", "required": True},
                    {"section": "Recommendations", "required": False}
                ]
            },
            "detailed_report": {
                "title": "Detailed Analysis Report",
                "structure": [
                    {"section": "Executive Summary", "required": True},
                    {"section": "Background", "required": True},
                    {"section": "Methodology", "required": True},
                    {"section": "Findings", "required": True},
                    {"section": "Analysis", "required": True},
                    {"section": "Recommendations", "required": True},
                    {"section": "Conclusion", "required": True},
                    {"section": "Appendix", "required": False}
                ]
            },
            "insight_brief": {
                "title": "Insight Brief",
                "structure": [
                    {"section": "Key Insight", "required": True},
                    {"section": "Supporting Evidence", "required": True},
                    {"section": "Business Implications", "required": True},
                    {"section": "Next Steps", "required": False}
                ]
            }
        }
        
        template = templates.get(template_id, templates["executive_summary"])
        
        # Generate content for each section
        sections = []
        for section in template["structure"]:
            section_name = section["section"]
            if section["required"] or parameters.get("include_optional", True):
                content = self._generate_section_content(section_name, data)
                sections.append({
                    "title": section_name,
                    "content": content
                })
        
        # Combine all sections into a complete narrative
        narrative = {
            "title": parameters.get("title", template["title"]),
            "summary": sections[0]["content"] if sections else "",
            "sections": sections
        }
        
        result = {
            "status": "success",
            "narrative": narrative
        }
        
        return result
    
    def _generate_section_content(self, section_name: str, data: Dict[str, Any]) -> str:
        """
        Generate content for a specific section.
        
        Args:
            section_name: Section name
            data: Data to populate the section
            
        Returns:
            Section content
        """
        # This would use more sophisticated template filling in a real implementation
        # For now, we'll use simple placeholders
        
        if section_name == "Overview" or section_name == "Executive Summary":
            return f"This analysis examined {data.get('data_description', 'the provided data')} to identify key insights and patterns. " \
                   f"The analysis revealed several significant findings that can inform strategic decision-making."
        
        elif section_name == "Key Findings" or section_name == "Findings":
            findings = data.get("findings", [
                "Finding 1: Significant pattern identified in the data.",
                "Finding 2: Strong correlation between key variables.",
                "Finding 3: Distinct segments emerged from the analysis."
            ])
            return "The analysis revealed the following key findings:\n\n" + "\n".join([f"- {finding}" for finding in findings])
        
        elif section_name == "Background":
            return f"This analysis was conducted to {data.get('purpose', 'gain insights from the available data')}. " \
                   f"The data includes {data.get('data_description', 'various metrics and dimensions')} collected over " \
                   f"{data.get('time_period', 'the relevant time period')}."
        
        elif section_name == "Methodology":
            return f"The analysis employed {data.get('methodology', 'various analytical techniques')} to examine the data. " \
                   f"This included {data.get('techniques', 'statistical analysis, pattern recognition, and trend identification')}."
        
        elif section_name == "Analysis":
            return f"The analysis revealed several important patterns and relationships in the data. " \
                   f"{data.get('analysis_details', 'Key variables were examined for relationships and trends, and significant patterns were identified.')}"
        
        elif section_name == "Recommendations" or section_name == "Next Steps":
            recommendations = data.get("recommendations", [
                "Continue monitoring key metrics to track progress.",
                "Share insights with relevant stakeholders.",
                "Conduct follow-up analysis to explore specific areas in greater depth."
            ])
            return "Based on the analysis, we recommend the following actions:\n\n" + "\n".join([f"- {rec}" for rec in recommendations])
        
        elif section_name == "Conclusion":
            return f"The analysis of {data.get('data_description', 'the data')} has provided valuable insights that can inform " \
                   f"{data.get('application', 'strategic decision-making')}. By addressing the recommendations outlined above, " \
                   f"the organization can leverage these insights to achieve better outcomes."
        
        elif section_name == "Key Insight":
            return f"The most significant insight from the analysis is {data.get('key_insight', 'the identified pattern or relationship')}. " \
                   f"This insight has important implications for {data.get('impact_area', 'the business')}."
        
        elif section_name == "Supporting Evidence":
            return f"This insight is supported by {data.get('evidence', 'multiple data points and analytical findings')}. " \
                   f"The evidence demonstrates a {data.get('confidence', 'high')} level of confidence in the insight."
        
        elif section_name == "Business Implications":
            return f"This insight has several important implications for the business, including " \
                   f"{data.get('implications', 'potential opportunities and challenges')}. " \
                   f"Addressing these implications can lead to {data.get('outcomes', 'improved performance and competitive advantage')}."
        
        elif section_name == "Appendix":
            return f"Additional supporting information and detailed analysis results are provided in this appendix."
        
        else:
            return f"Content for {section_name} section."


class NarrativeComposerAgent(Agent):
    """Agent responsible for creating natural language explanations of analytical findings."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Narrative Composer agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="NarrativeComposerAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            NaturalLanguageGenerationTool(),
            TemplateBasedNarrativeTool()
        ])
        
        # Register message handlers
        self.register_message_handler("GENERATE_NARRATIVE", self.handle_generate_narrative)
        self.register_message_handler("GENERATE_TEMPLATE_NARRATIVE", self.handle_generate_template_narrative)
        self.register_message_handler("COMPOSE_NARRATIVE", self.handle_compose_narrative)
        
        logger.info("NarrativeComposerAgent initialized")
    
    async def handle_generate_narrative(self, message: Message) -> Message:
        """
        Handle narrative generation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with generated narrative
        """
        logger.info(f"Handling GENERATE_NARRATIVE request: {message.content}")
        
        insights = message.content.get("insights", [])
        context = message.content.get("context", {})
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "NaturalLanguageGenerationTool", 
            insights=insights, 
            context=context, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="NARRATIVE_GENERATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_generate_template_narrative(self, message: Message) -> Message:
        """
        Handle template-based narrative generation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with generated narrative
        """
        logger.info(f"Handling GENERATE_TEMPLATE_NARRATIVE request: {message.content}")
        
        template_id = message.content.get("template_id", "executive_summary")
        data = message.content.get("data", {})
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "TemplateBasedNarrativeTool", 
            template_id=template_id, 
            data=data, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="TEMPLATE_NARRATIVE_GENERATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_compose_narrative(self, message: Message) -> Message:
        """
        Handle comprehensive narrative composition requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with composed narrative
        """
        logger.info(f"Handling COMPOSE_NARRATIVE request: {message.content}")
        
        analysis_results = message.content.get("analysis_results", {})
        insights = message.content.get("insights", [])
        visualizations = message.content.get("visualizations", {})
        parameters = message.content.get("parameters", {})
        
        # Determine the appropriate narrative approach based on parameters
        narrative_type = parameters.get("narrative_type", "comprehensive")
        
        if narrative_type == "template":
            # Use template-based approach
            template_id = parameters.get("template_id", "detailed_report")
            
            # Prepare data for template
            template_data = {
                "data_description": parameters.get("data_description", "the analyzed data"),
                "purpose": parameters.get("purpose", "gain actionable insights"),
                "findings": [insight.get("description") for insight in insights if insight.get("importance") == "high"],
                "recommendations": self._generate_recommendations(insights),
                "key_insight": next((insight.get("description") for insight in insights if insight.get("importance") == "high"), "the primary finding"),
                "analysis_details": self._summarize_analysis_results(analysis_results)
            }
            
            result = await self.execute_tool(
                "TemplateBasedNarrativeTool", 
                template_id=template_id, 
                data=template_data, 
                parameters=parameters
            )
        else:
            # Use insight-based approach
            context = {
                "data_description": parameters.get("data_description", "the analyzed data"),
                "analysis_focus": parameters.get("analysis_focus", "key patterns and relationships")
            }
            
            result = await self.execute_tool(
                "NaturalLanguageGenerationTool", 
                insights=insights, 
                context=context, 
                parameters=parameters
            )
        
        # Add visualization references if available
        if visualizations and "narrative" in result:
            narrative = result["narrative"]
            
            # Add visualization references to relevant sections
            for section in narrative.get("sections", []):
                section_title = section.get("title", "").lower()
                section_content = section.get("content", "")
                
                if "finding" in section_title or "analysis" in section_title:
                    viz_references = self._generate_visualization_references(visualizations)
                    if viz_references:
                        section["content"] = section_content + "\n\n" + viz_references
        
        return Message(
            sender=self.name,
            intent="NARRATIVE_COMPOSED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    def _generate_recommendations(self, insights: List[Dict[str, Any]]) -> List[str]:
        """
        Generate recommendations based on insights.
        
        Args:
            insights: List of insights
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        # This would use more sophisticated logic in a real implementation
        # For now, we'll use simple rules
        
        for insight in insights:
            insight_type = insight.get("type")
            description = insight.get("description", "").lower()
            
            if insight_type == "correlation" and "strong positive correlation" in description:
                recommendations.append(f"Leverage the positive relationship between the correlated variables to optimize outcomes.")
            
            elif insight_type == "correlation" and "strong negative correlation" in description:
                recommendations.append(f"Address the inverse relationship between the correlated variables in strategic planning.")
            
            elif insight_type == "clustering" and "distinct clusters" in description:
                recommendations.append(f"Develop targeted strategies for each identified segment to maximize effectiveness.")
            
            elif insight_type == "sentiment" and "primarily negative" in description:
                recommendations.append(f"Investigate the causes of negative sentiment and develop an action plan to address concerns.")
            
            elif insight_type == "sentiment" and "primarily positive" in description:
                recommendations.append(f"Identify and reinforce the factors contributing to positive sentiment.")
            
            elif insight_type == "topics" and "prominent topic" in description:
                topic = description.split("keywords:")[1].split(",")[0].strip() if "keywords:" in description else "identified"
                recommendations.append(f"Focus communication and development efforts on the {topic} topic to align with audience interests.")
        
        # Add generic recommendations if needed
        if not recommendations:
            recommendations = [
                "Continue monitoring key metrics to track progress and identify emerging trends.",
                "Share insights with relevant stakeholders to inform strategic decision-making.",
                "Conduct follow-up analysis to explore specific areas of interest in greater depth."
            ]
        
        return recommendations
    
    def _summarize_analysis_results(self, analysis_results: Dict[str, Any]) -> str:
        """
        Summarize analysis results.
        
        Args:
            analysis_results: Analysis results to summarize
            
        Returns:
            Summary text
        """
        summary_parts = []
        
        # Check for different types of analysis results
        if "summary" in analysis_results:
            summary_parts.append("Statistical summary analysis was performed to understand the central tendencies and distributions of key variables.")
        
        if "correlations" in analysis_results:
            summary_parts.append("Correlation analysis was conducted to identify relationships between variables.")
        
        if "clusters" in analysis_results:
            summary_parts.append(f"Clustering analysis identified distinct segments within the data.")
        
        if "model" in analysis_results:
            model_type = analysis_results.get("model", {}).get("type", "predictive")
            summary_parts.append(f"A {model_type} model was developed to analyze patterns and relationships.")
        
        if "sentiment" in analysis_results:
            summary_parts.append("Sentiment analysis was performed to understand emotional content and reactions.")
        
        if "topics" in analysis_results:
            summary_parts.append("Topic modeling was applied to identify key themes and subjects.")
        
        # If no specific analyses were identified, provide a generic summary
        if not summary_parts:
            summary_parts = ["Multiple analytical techniques were applied to extract insights from the data."]
        
        return " ".join(summary_parts)
    
    def _generate_visualization_references(self, visualizations: Dict[str, Any]) -> str:
        """
        Generate references to visualizations.
        
        Args:
            visualizations: Visualization information
            
        Returns:
            Visualization reference text
        """
        if not visualizations:
            return ""
        
        charts = visualizations.get("charts", [])
        dashboard = visualizations.get("dashboard")
        
        references = []
        
        if charts:
            chart_types = set(chart.get("type") for chart in charts if "type" in chart)
            chart_type_str = ", ".join(chart_types)
            references.append(f"These findings are visualized in the accompanying {chart_type_str} charts.")
        
        if dashboard:
            dashboard_title = dashboard.get("title", "Analysis Dashboard")
            references.append(f"For a comprehensive view of all insights, refer to the {dashboard_title}.")
        
        if visualizations.get("data_studio"):
            data_studio_url = visualizations.get("data_studio", {}).get("report", {}).get("url")
            if data_studio_url:
                references.append(f"An interactive version of this analysis is available in Google Data Studio at {data_studio_url}.")
        
        return "\n".join(references) if references else ""
