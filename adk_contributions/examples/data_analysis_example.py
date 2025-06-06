"""
Example implementation of the Data Analysis Agent.

This example demonstrates how to use the Data Analysis Agent template
to analyze a dataset of customer feedback for an e-commerce website.
"""

import os
import uuid
import pandas as pd
import numpy as np
from adk import Message
from adk_contributions.features.data_analysis_agent import DataAnalysisAgent


def create_sample_data():
    """Create a sample dataset for demonstration."""
    # Create directory if it doesn't exist
    os.makedirs("data", exist_ok=True)
    
    # Generate sample data
    np.random.seed(42)
    n_samples = 1000
    
    # Customer ID
    customer_ids = [f"CUST{i:04d}" for i in range(1, n_samples + 1)]
    
    # Purchase date (last 90 days)
    purchase_dates = pd.date_range(end='2023-12-31', periods=90)
    purchase_dates = np.random.choice(purchase_dates, n_samples)
    
    # Product category
    categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Toys']
    product_categories = np.random.choice(categories, n_samples, p=[0.3, 0.25, 0.2, 0.15, 0.1])
    
    # Purchase amount
    purchase_amounts = np.random.lognormal(mean=4.0, sigma=0.5, size=n_samples)
    
    # Customer rating (1-5 stars)
    ratings = np.random.choice([1, 2, 3, 4, 5], n_samples, p=[0.05, 0.1, 0.15, 0.3, 0.4])
    
    # Customer age
    ages = np.random.normal(loc=35, scale=12, size=n_samples)
    ages = np.clip(ages, 18, 80).astype(int)
    
    # Customer location
    locations = np.random.choice(
        ['North', 'South', 'East', 'West', 'Central'],
        n_samples,
        p=[0.2, 0.2, 0.2, 0.2, 0.2]
    )
    
    # Is repeat customer
    is_repeat = np.random.choice([True, False], n_samples, p=[0.7, 0.3])
    
    # Days since last purchase (for repeat customers)
    days_since_last = np.zeros(n_samples)
    repeat_mask = is_repeat == True
    days_since_last[repeat_mask] = np.random.exponential(scale=30, size=repeat_mask.sum()).astype(int)
    days_since_last[~repeat_mask] = np.nan
    
    # Create correlations:
    # - Higher ratings for repeat customers
    ratings[is_repeat] = np.clip(ratings[is_repeat] + np.random.choice([0, 1], size=repeat_mask.sum(), p=[0.5, 0.5]), 1, 5)
    
    # - Higher purchase amounts for older customers
    purchase_amounts += (ages - 35) * 0.5
    
    # Create DataFrame
    df = pd.DataFrame({
        'customer_id': customer_ids,
        'purchase_date': purchase_dates,
        'product_category': product_categories,
        'purchase_amount': purchase_amounts,
        'rating': ratings,
        'customer_age': ages,
        'location': locations,
        'is_repeat_customer': is_repeat,
        'days_since_last_purchase': days_since_last
    })
    
    # Save to CSV
    data_path = "data/customer_feedback.csv"
    df.to_csv(data_path, index=False)
    
    return data_path


def main():
    """Run the example."""
    # Create sample data
    data_path = create_sample_data()
    print(f"Created sample data at {data_path}")
    
    # Create a data analysis agent
    agent = DataAnalysisAgent("data_analysis_agent", output_dir="customer_analysis_output")
    
    # Start the agent
    agent.start()
    print("Started data analysis agent")
    
    # Create an analysis request
    request_id = str(uuid.uuid4())
    request = Message(
        sender_id="user",
        receiver_id="data_analysis_agent",
        content={
            "data_source": data_path,
            "analysis_type": "exploratory",
            "options": {
                "remove_duplicates": True,
                "missing_strategy": "mean",
                "convert_dates": True,
                "pca": True,
                "clustering": True,
                "custom_transforms": {
                    "purchase_amount": "log"  # Apply log transform to purchase amount
                },
                "report_format": "html"
            }
        },
        message_type="analyze_data",
        metadata={
            "request_id": request_id
        }
    )
    
    # Send the request to the agent
    agent.receive_message(request)
    print(f"Sent analysis request with ID: {request_id}")
    
    # In a real application, we would wait for the agent to complete the analysis
    # and then process the results. For this example, we'll just print a message.
    print("Analysis request sent. Check the customer_analysis_output directory for results.")
    
    # Stop the agent
    agent.stop()
    print("Stopped data analysis agent")


if __name__ == "__main__":
    main()

