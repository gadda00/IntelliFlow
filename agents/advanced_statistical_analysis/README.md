# Advanced Statistical Analysis Agent

This agent performs sophisticated statistical analysis including:

- Independent samples t-tests with detailed narratives
- Descriptive statistics with comprehensive summaries  
- Distribution analysis and goodness-of-fit tests
- Comparative analysis with ANOVA and post-hoc tests

## Features

- Generates academic-quality statistical narratives
- Handles edge cases like zero variance data
- Provides detailed interpretations and assumptions
- Supports multiple statistical test types

## Usage

The agent responds to `PERFORM_ADVANCED_ANALYSIS` messages with:
- `data`: Input data for analysis
- `analysis_type`: Type of statistical analysis to perform
- `parameters`: Analysis-specific parameters

## Supported Analysis Types

- `independent_t_test`: Compare means between two groups
- `descriptive_analysis`: Comprehensive descriptive statistics
- `distribution_analysis`: Test for distribution fit
- `comparative_analysis`: Multi-group comparisons with ANOVA

