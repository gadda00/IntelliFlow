"""
Advanced Statistical Analysis Agent implementation.

This agent performs sophisticated statistical analysis including t-tests, ANOVA, and other statistical methods.
Enhanced to provide detailed statistical narratives similar to academic research reports.
"""

import asyncio
import numpy as np
import pandas as pd
import io
import json
from typing import Dict, Any, List, Optional
from scipy import stats

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.advanced_statistical_analysis")

class AdvancedStatisticalTool(Tool):
    """Tool for advanced statistical analysis with detailed narrative generation."""
    
    def __init__(self):
        super().__init__(name="AdvancedStatisticalTool", description="Perform advanced statistical analysis with detailed narratives")
    
    async def execute(self, data: Dict[str, Any], analysis_type: str = "auto", parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute advanced statistical analysis.
        
        Args:
            data: Input data to analyze including file_contents for real data processing
            analysis_type: Type of statistical analysis
            parameters: Analysis parameters
            
        Returns:
            Detailed statistical analysis with narrative
        """
        logger.info(f"Performing {analysis_type} advanced statistical analysis")
        
        parameters = parameters or {}
        
        # Check if we have real file contents to process
        file_contents = data.get("file_contents", [])
        
        if file_contents:
            # Process real uploaded data
            return await self._analyze_real_data(file_contents, analysis_type, parameters)
        else:
            # Fallback to simulated analysis
            return await self._analyze_simulated_data(data, analysis_type, parameters)
    
    async def _analyze_real_data(self, file_contents: List[Dict[str, Any]], analysis_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze real uploaded file data."""
        logger.info("Performing statistical analysis on real uploaded data")
        
        # Process the first file
        file_data = file_contents[0]
        file_name = file_data.get("name", "unknown.csv")
        file_content = file_data.get("content", "")
        
        try:
            if file_name.endswith(('.csv', '.txt')):
                # Parse CSV data
                df = pd.read_csv(io.StringIO(file_content))
                
                # Auto-detect analysis type based on data
                if analysis_type == "auto":
                    analysis_type = self._detect_analysis_type(df)
                
                if analysis_type == "independent_t_test":
                    return await self._perform_real_t_test(df, parameters)
                elif analysis_type == "descriptive_analysis":
                    return await self._perform_real_descriptive_analysis(df, parameters)
                else:
                    return await self._perform_real_descriptive_analysis(df, parameters)
                    
            elif file_name.endswith('.json'):
                # Parse JSON data
                json_data = json.loads(file_content)
                if isinstance(json_data, list):
                    df = pd.DataFrame(json_data)
                    return await self._perform_real_descriptive_analysis(df, parameters)
                    
        except Exception as e:
            logger.error(f"Error analyzing real data: {e}")
            return {
                "status": "error",
                "message": f"Error processing data: {str(e)}"
            }
        
        return {
            "status": "error",
            "message": "Unsupported file format or data structure"
        }
    
    def _detect_analysis_type(self, df: pd.DataFrame) -> str:
        """Detect the appropriate analysis type based on the data structure."""
        # Check for common patterns that suggest t-test
        columns = [col.lower() for col in df.columns]
        
        # Look for male/female or group comparison patterns
        if any('male' in col and 'female' in col for col in [' '.join(columns)]):
            return "independent_t_test"
        elif len([col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]) >= 2:
            return "independent_t_test"
        else:
            return "descriptive_analysis"
    
    async def _perform_real_t_test(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform t-test on real data."""
        
        # Look for male/female score columns
        male_col = None
        female_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if 'male' in col_lower and 'female' not in col_lower:
                male_col = col
            elif 'female' in col_lower:
                female_col = col
        
        if male_col and female_col:
            # Extract data
            male_data = pd.to_numeric(df[male_col], errors='coerce').dropna()
            female_data = pd.to_numeric(df[female_col], errors='coerce').dropna()
            
            # Calculate descriptive statistics
            male_stats = {
                "n": len(male_data),
                "mean": float(male_data.mean()),
                "std": float(male_data.std(ddof=1)),
                "min": float(male_data.min()),
                "max": float(male_data.max())
            }
            
            female_stats = {
                "n": len(female_data),
                "mean": float(female_data.mean()),
                "std": float(female_data.std(ddof=1)),
                "min": float(female_data.min()),
                "max": float(female_data.max())
            }
            
            # Perform t-test if possible
            can_compute_ttest = male_stats["std"] > 0 or female_stats["std"] > 0
            
            if can_compute_ttest and len(male_data) > 1 and len(female_data) > 1:
                try:
                    t_stat, p_value = stats.ttest_ind(male_data, female_data, equal_var=False)
                    
                    # Calculate effect size (Cohen's d)
                    pooled_std = np.sqrt(((len(male_data) - 1) * male_stats["std"]**2 + 
                                        (len(female_data) - 1) * female_stats["std"]**2) / 
                                       (len(male_data) + len(female_data) - 2))
                    cohens_d = (male_stats["mean"] - female_stats["mean"]) / pooled_std if pooled_std > 0 else 0
                    
                    statistical_test = {
                        "test_name": "Independent Samples T-Test",
                        "test_statistic": float(t_stat),
                        "p_value": float(p_value),
                        "degrees_of_freedom": len(male_data) + len(female_data) - 2,
                        "can_compute": True,
                        "significance_level": 0.05,
                        "is_significant": p_value < 0.05
                    }
                    
                    effect_size = {
                        "cohens_d": float(cohens_d),
                        "interpretation": self._interpret_effect_size(cohens_d)
                    }
                    
                except Exception as e:
                    statistical_test = {
                        "test_name": "Independent Samples T-Test",
                        "test_statistic": "undefined",
                        "p_value": "undefined",
                        "degrees_of_freedom": len(male_data) + len(female_data) - 2,
                        "can_compute": False,
                        "reason": f"Computation error: {str(e)}"
                    }
                    effect_size = {"cohens_d": "undefined", "interpretation": "Cannot compute"}
            else:
                statistical_test = {
                    "test_name": "Independent Samples T-Test",
                    "test_statistic": "undefined",
                    "p_value": "undefined",
                    "degrees_of_freedom": len(male_data) + len(female_data) - 2,
                    "can_compute": False,
                    "reason": "Zero variance in both groups prevents t-test computation"
                }
                effect_size = {"cohens_d": "undefined", "interpretation": "Cannot compute due to zero variance"}
            
            # Generate narrative
            narrative = self._generate_t_test_narrative(male_stats, female_stats, statistical_test, effect_size, "male students", "female students")
            
            return {
                "status": "success",
                "analysis_type": "independent_t_test",
                "statistical_test": statistical_test,
                "descriptive_statistics": {
                    "Males": male_stats,
                    "Females": female_stats
                },
                "effect_size": effect_size,
                "narrative": narrative,
                "interpretation": narrative["interpretation"],
                "recommendations": [
                    "Investigate factors contributing to score differences between groups",
                    "Consider additional variables that might explain the performance gap",
                    "Validate findings with larger sample sizes if possible"
                ]
            }
        
        # Fallback to descriptive analysis if no male/female columns found
        return await self._perform_real_descriptive_analysis(df, parameters)
    
    def _interpret_effect_size(self, cohens_d: float) -> str:
        """Interpret Cohen's d effect size."""
        abs_d = abs(cohens_d)
        if abs_d < 0.2:
            return "negligible effect"
        elif abs_d < 0.5:
            return "small effect"
        elif abs_d < 0.8:
            return "medium effect"
        else:
            return "large effect"
    
    def _generate_t_test_narrative(self, group1_stats: Dict, group2_stats: Dict, test_result: Dict, effect_size: Dict, group1_name: str, group2_name: str) -> Dict[str, str]:
        """Generate detailed narrative for t-test results."""
        
        if test_result["can_compute"]:
            if test_result["is_significant"]:
                significance_text = f"This difference was statistically significant (t({test_result['degrees_of_freedom']}) = {test_result['test_statistic']:.3f}, p = {test_result['p_value']:.3f})."
                interpretation = f"The analysis reveals a statistically significant difference in exam performance between {group1_name} and {group2_name}. The effect size ({effect_size['cohens_d']:.3f}) indicates a {effect_size['interpretation']}."
            else:
                significance_text = f"This difference was not statistically significant (t({test_result['degrees_of_freedom']}) = {test_result['test_statistic']:.3f}, p = {test_result['p_value']:.3f})."
                interpretation = f"The analysis shows no statistically significant difference in exam performance between {group1_name} and {group2_name}."
        else:
            significance_text = f"Statistical significance could not be determined due to {test_result.get('reason', 'computational limitations')}."
            interpretation = f"While descriptive differences exist between {group1_name} (M = {group1_stats['mean']:.2f}) and {group2_name} (M = {group2_stats['mean']:.2f}), statistical significance cannot be assessed due to {test_result.get('reason', 'data limitations')}."
        
        narrative_text = f"An independent samples t-test was conducted to compare exam scores between {group1_name} and {group2_name}. The {group1_name} group consistently scored {group1_stats['mean']:.0f} on the exam (M = {group1_stats['mean']:.2f}, SD = {group1_stats['std']:.2f}), while the {group2_name} group scored {group2_stats['mean']:.0f} (M = {group2_stats['mean']:.2f}, SD = {group2_stats['std']:.2f}). {significance_text}"
        
        return {
            "narrative": narrative_text,
            "interpretation": interpretation,
            "methodology": "Independent samples t-test with Welch's correction for unequal variances",
            "assumptions": "Normal distribution and independence of observations assumed"
        }
    
    async def _perform_real_descriptive_analysis(self, df: pd.DataFrame, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Perform descriptive analysis on real data."""
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        descriptive_stats = {}
        for col in numeric_columns:
            col_data = df[col].dropna()
            if len(col_data) > 0:
                descriptive_stats[col] = {
                    "count": len(col_data),
                    "mean": float(col_data.mean()),
                    "std": float(col_data.std()),
                    "min": float(col_data.min()),
                    "max": float(col_data.max()),
                    "median": float(col_data.median()),
                    "q25": float(col_data.quantile(0.25)),
                    "q75": float(col_data.quantile(0.75))
                }
        
        return {
            "status": "success",
            "analysis_type": "descriptive_analysis",
            "descriptive_statistics": descriptive_stats,
            "summary": f"Descriptive analysis completed for {len(numeric_columns)} numeric variables",
            "narrative": {
                "summary": f"Descriptive statistics were calculated for {len(numeric_columns)} numeric variables in the dataset.",
                "interpretation": "The analysis provides a comprehensive overview of the central tendencies and variability in the data."
            }
        }
    
    async def _analyze_simulated_data(self, data: Dict[str, Any], analysis_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback to simulated analysis for demo purposes."""
        
        return {
            "status": "success",
            "analysis_type": "simulated_analysis",
            "message": "Using simulated data for demonstration",
            "narrative": {
                "summary": "Simulated analysis completed successfully.",
                "interpretation": "This is a demonstration using simulated data."
            }
        }

class AdvancedStatisticalAnalysisAgent(Agent):
    """Advanced Statistical Analysis Agent for sophisticated statistical computations."""
    
    def __init__(self):
        super().__init__(
            name="AdvancedStatisticalAnalysisAgent",
            description="Performs advanced statistical analysis including t-tests, ANOVA, and detailed narratives",
            tools=[AdvancedStatisticalTool()]
        )
    
    async def process_message(self, message: Message) -> Message:
        """Process incoming analysis requests."""
        try:
            # Extract analysis parameters from message
            data = message.content.get("data", {})
            analysis_type = message.content.get("analysis_type", "auto")
            parameters = message.content.get("parameters", {})
            
            # Execute analysis using the tool
            tool = self.tools[0]
            result = await tool.execute(data, analysis_type, parameters)
            
            return Message(
                sender=self.name,
                recipient=message.sender,
                content=result,
                message_type="analysis_result"
            )
            
        except Exception as e:
            logger.error(f"Error in statistical analysis: {e}")
            return Message(
                sender=self.name,
                recipient=message.sender,
                content={
                    "status": "error",
                    "message": f"Statistical analysis failed: {str(e)}"
                },
                message_type="error"
            )

