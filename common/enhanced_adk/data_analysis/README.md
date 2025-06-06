# Enhanced ADK Data Analysis Module

This module provides enhanced data analysis capabilities for the IntelliFlow project, building on the Google ADK (Agent Development Kit) framework. It includes comprehensive data preprocessing tools, analysis capabilities, and visualization features.

## Features

- **Data Loading**: Load data from various sources and formats (CSV, JSON, Excel)
- **Data Preprocessing**: Clean and prepare data for analysis
  - Handle missing values (drop, fill with mean/median/mode/constant)
  - Detect and handle outliers (z-score, IQR, percentile methods)
  - Engineer features (polynomial, interaction, binning, date features)
  - Encode categorical variables (one-hot, label, ordinal, target encoding)
  - Normalize data (min-max, z-score, robust scaling)
  - Remove duplicates
  - Convert data types
- **Data Analysis**: Analyze data to extract insights
  - Summary statistics
  - Correlation analysis
  - Distribution analysis
  - Outlier detection
  - Time series analysis
- **Data Visualization**: Create visualizations to illustrate findings
  - Line plots
  - Bar plots
  - Scatter plots
  - Histograms
  - Box plots
  - Heatmaps
  - Pie charts

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

## Preprocessing Operations

The Data Analysis Agent includes a comprehensive set of preprocessing operations:

### 1. Clean Missing Values
- **Strategy**: drop, fill_mean, fill_median, fill_mode, fill_constant, fill_forward, fill_backward, fill_interpolate
- **Example**: `{"strategy": "fill_mean", "columns": ["numeric_col1", "numeric_col2"]}`

### 2. Handle Outliers
- **Method**: zscore, iqr, percentile
- **Treatment**: remove, cap, null
- **Example**: `{"method": "zscore", "columns": ["numeric_col"], "threshold": 3, "treatment": "cap"}`

### 3. Engineer Features
- **Operation**: polynomial, interaction, binning, date_features, text_features
- **Example**: `{"operation": "date_features", "column": "date_col", "features": ["year", "month", "day"]}`

### 4. Encode Categorical
- **Method**: one_hot, label, ordinal, target
- **Example**: `{"method": "one_hot", "columns": ["categorical_col"], "drop_first": true}`

### 5. Normalize Data
- **Method**: minmax, zscore, robust, log
- **Example**: `{"method": "minmax", "columns": ["numeric_col"], "feature_range": [0, 1]}`

### 6. Remove Duplicates
- **Example**: `{"subset": ["col1", "col2"], "keep": "first"}`

### 7. Convert Types
- **Example**: `{"type_mappings": {"col1": "float32", "col2": "category", "col3": "datetime"}}`

## Analysis Types

The Data Analysis Agent supports various analysis types:

- **Summary**: Generate a summary of the data (shape, columns, data types, missing values, numeric summary)
- **Correlation**: Calculate correlation matrix for numeric columns
- **Distribution**: Analyze the distribution of a column (min, max, mean, median, std, quantiles for numeric; value counts for categorical)
- **Outliers**: Detect outliers in a column using z-score or IQR method
- **Time Series**: Analyze time series data (start/end date, duration, data points, trends)

## Visualization Types

The Data Analysis Agent supports various visualization types:

- **Line**: Create a line plot (requires x and y parameters)
- **Bar**: Create a bar plot (requires x and y parameters)
- **Scatter**: Create a scatter plot (requires x and y parameters)
- **Histogram**: Create a histogram (requires column parameter)
- **Boxplot**: Create a box plot (requires column parameter, optional by parameter)
- **Heatmap**: Create a correlation heatmap (optional columns parameter)
- **Pie**: Create a pie chart (requires column parameter)

## Customization

You can customize the agent by:

- Specifying allowed data sources
- Limiting available analysis types
- Restricting visualization types
- Providing additional tools
- Customizing the instruction

## Example

See the [data_analysis_example.py](../../examples/data_analysis_example.py) file for a complete example of how to use the Data Analysis Agent.

## Contributing

This module is part of the IntelliFlow project's contributions to the Google ADK ecosystem. The enhancements made here have been contributed back to the ADK Python repository to benefit the broader community.

## License

Licensed under the Apache License, Version 2.0.

