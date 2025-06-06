# Enhanced ADK for IntelliFlow

This module provides enhanced capabilities for the IntelliFlow project, building on the Google ADK (Agent Development Kit) framework. It includes improvements and extensions to the core ADK functionality, as well as specialized modules for data analysis, planning, memory, monitoring, and communication.

## Modules

- **Data Analysis**: Comprehensive data analysis capabilities, including preprocessing, analysis, and visualization
- **Planning**: Enhanced planning capabilities for agent workflows
- **Memory**: Improved memory systems for agent state management
- **Monitoring**: Tools for monitoring agent performance and behavior
- **Communication**: Enhanced communication capabilities for agent interactions

## Data Analysis Module

The Data Analysis module provides comprehensive data analysis capabilities, including:

- **Data Loading**: Load data from various sources and formats
- **Data Preprocessing**: Clean and prepare data for analysis
- **Data Analysis**: Analyze data to extract insights
- **Data Visualization**: Create visualizations to illustrate findings

See the [Data Analysis README](./data_analysis/README.md) for more details.

## Usage

```python
from IntelliFlow.common.enhanced_adk.data_analysis import DataAnalysisAgent

# Create a data analysis agent
agent = DataAnalysisAgent(
    name="data_analyst",
    model="gemini-1.5-pro",
    data_sources=["data.csv", "data.json", "data.xlsx"],
    analysis_types=["summary", "correlation", "distribution", "outliers", "time_series"],
    visualization_types=["line", "bar", "scatter", "histogram", "boxplot", "heatmap", "pie"],
    preprocessing_operations=["clean_missing_values", "handle_outliers", "engineer_features", 
                             "encode_categorical", "normalize_data", "remove_duplicates", "convert_types"]
)

# Start a conversation with the agent
response = agent.generate_content("Can you help me analyze this dataset?")
print(response.text)
```

## Examples

See the [examples](../../examples/) directory for complete examples of how to use the Enhanced ADK modules.

## Contributing

This module is part of the IntelliFlow project's contributions to the Google ADK ecosystem. The enhancements made here have been contributed back to the ADK Python repository to benefit the broader community.

## License

Licensed under the Apache License, Version 2.0.

