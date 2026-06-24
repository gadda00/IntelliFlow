"""
Flask API server for IntelliFlow platform

This module provides a REST API for the IntelliFlow platform,
allowing the frontend to interact with the multi-agent system.
"""

import os
import json
import uuid
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend/intelliflow-ui/dist')
CORS(app)

# Mock data for demonstration
ANALYSIS_TYPES = [
    {
        "id": "customer_feedback",
        "name": "Customer Feedback Analysis",
        "description": "Analyze customer feedback to extract sentiment, topics, and actionable insights.",
        "default_objectives": ["analyze_text", "discover_patterns", "detect_anomalies"]
    },
    {
        "id": "sales_trends",
        "name": "Sales Trends Analysis",
        "description": "Identify patterns and trends in sales data to optimize business strategies.",
        "default_objectives": ["discover_patterns", "predict", "summarize"]
    },
    {
        "id": "product_performance",
        "name": "Product Performance Analysis",
        "description": "Evaluate product performance metrics to identify strengths and areas for improvement.",
        "default_objectives": ["classify", "detect_anomalies", "summarize"]
    }
]

DATA_SOURCES = [
    {
        "id": "bigquery",
        "name": "BigQuery",
        "description": "Connect to Google BigQuery datasets",
        "parameters": ["project_id", "dataset_id", "table_id"]
    },
    {
        "id": "cloud_storage",
        "name": "Cloud Storage",
        "description": "Access data from Google Cloud Storage buckets",
        "parameters": ["bucket_name", "object_prefix"]
    },
    {
        "id": "api",
        "name": "External API",
        "description": "Fetch data from external APIs",
        "parameters": ["url", "method", "headers"]
    },
    {
        "id": "upload",
        "name": "File Upload",
        "description": "Upload files directly for analysis",
        "parameters": ["file"]
    }
]

# In-memory storage for analyses
analyses = {}

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success",
        "message": "IntelliFlow API is running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/analysis-types', methods=['GET'])
def get_analysis_types():
    return jsonify({
        "status": "success",
        "analysis_types": ANALYSIS_TYPES
    })

@app.route('/api/data-sources', methods=['GET'])
def get_data_sources():
    return jsonify({
        "status": "success",
        "data_sources": DATA_SOURCES
    })

@app.route('/api/analysis/start', methods=['POST'])
def start_analysis():
    try:
        analysis_config = request.json
        
        # Generate a unique ID for this analysis
        analysis_id = str(uuid.uuid4())
        
        # Store the analysis with initial status
        analyses[analysis_id] = {
            "id": analysis_id,
            "config": analysis_config,
            "status": "running",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "completed_at": None,
            "result": None,
            "error": None
        }
        
        # In a real implementation, this would trigger the multi-agent system
        # For demo purposes, we'll simulate this with a background process
        
        return jsonify({
            "status": "success",
            "message": "Analysis started successfully",
            "analysis_id": analysis_id
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to start analysis: {str(e)}"
        }), 500

@app.route('/api/analysis/<analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    try:
        if analysis_id not in analyses:
            return jsonify({
                "status": "error",
                "message": f"Analysis with ID {analysis_id} not found"
            }), 404
        
        analysis = analyses[analysis_id]
        
        # Simulate analysis completion after a few seconds
        if analysis["status"] == "running":
            elapsed_time = (datetime.now() - datetime.fromisoformat(analysis["created_at"])).total_seconds()
            
            if elapsed_time > 10:  # Complete after 10 seconds
                analysis["status"] = "completed"
                analysis["completed_at"] = datetime.now().isoformat()
                analysis["result"] = generate_mock_result(analysis["config"])
        
        return jsonify({
            "status": "success",
            "analysis": analysis
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to get analysis: {str(e)}"
        }), 500

@app.route('/api/analysis/history', methods=['GET'])
def get_analysis_history():
    try:
        history = []
        
        for analysis_id, analysis in analyses.items():
            history.append({
                "id": analysis_id,
                "type": analysis["config"]["type"],
                "status": analysis["status"],
                "created_at": analysis["created_at"],
                "completed_at": analysis["completed_at"],
                "sentiment": analysis["result"]["metrics"]["sentimentScore"] if analysis["result"] else None
            })
        
        # Sort by creation date, newest first
        history.sort(key=lambda x: x["created_at"], reverse=True)
        
        return jsonify({
            "status": "success",
            "history": history
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to get analysis history: {str(e)}"
        }), 500

def generate_mock_result(config):
    """Generate mock analysis results based on the configuration"""
    analysis_type = config["type"]
    
    if analysis_type == "customer_feedback":
        return {
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
                "type": config["data_source"]["source_type"],
                "project": config["data_source"].get("project_id", "intelliflow-project"),
                "dataset": config["data_source"].get("dataset_id", "customer_data"),
                "table": config["data_source"].get("table_id", "feedback"),
                "recordCount": 10000,
                "timePeriod": "Last 30 Days"
            }
        }
    elif analysis_type == "sales_trends":
        return {
            "insights": [
                {
                    "id": "i1",
                    "title": "Q4 sales increased by 18% year-over-year",
                    "description": "Fourth quarter sales showed significant growth compared to the same period last year."
                },
                {
                    "id": "i2",
                    "title": "Product category A is the top performer",
                    "description": "Category A products account for 45% of total sales, with consistent growth across all regions."
                },
                {
                    "id": "i3",
                    "title": "Regional variations in product preferences",
                    "description": "Western region shows stronger preference for premium products compared to other regions."
                }
            ],
            "recommendations": [
                {
                    "id": "r1",
                    "title": "Increase inventory for Category A products",
                    "description": "Ensure sufficient inventory for the top-performing product category to meet growing demand."
                },
                {
                    "id": "r2",
                    "title": "Tailor marketing strategies by region",
                    "description": "Develop region-specific marketing campaigns that align with local product preferences."
                }
            ],
            "metrics": {
                "insightCount": 8,
                "sentimentScore": 0.65,
                "topicCount": 3
            },
            "narrative": {
                "summary": "This analysis examined sales data to identify trends, patterns, and opportunities for optimization.",
                "keyFindings": "The analysis revealed significant year-over-year growth, particularly in Q4, with Product Category A emerging as the top performer. Regional variations in product preferences were also identified.",
                "recommendations": "Based on the analysis, we recommend increasing inventory for Category A products and developing region-specific marketing strategies.",
                "conclusion": "The sales trend analysis has provided valuable insights into performance patterns and customer preferences. By implementing the recommended strategies, the organization can capitalize on growth opportunities and address regional variations."
            },
            "dataSource": {
                "type": config["data_source"]["source_type"],
                "project": config["data_source"].get("project_id", "intelliflow-project"),
                "dataset": config["data_source"].get("dataset_id", "sales_data"),
                "table": config["data_source"].get("table_id", "transactions"),
                "recordCount": 25000,
                "timePeriod": "Last 12 Months"
            }
        }
    else:
        return {
            "insights": [
                {
                    "id": "i1",
                    "title": "Key insight 1",
                    "description": "Description of key insight 1."
                },
                {
                    "id": "i2",
                    "title": "Key insight 2",
                    "description": "Description of key insight 2."
                }
            ],
            "recommendations": [
                {
                    "id": "r1",
                    "title": "Recommendation 1",
                    "description": "Description of recommendation 1."
                }
            ],
            "metrics": {
                "insightCount": 5,
                "sentimentScore": 0.6,
                "topicCount": 2
            },
            "narrative": {
                "summary": "Analysis summary.",
                "keyFindings": "Key findings from the analysis.",
                "recommendations": "Recommendations based on the analysis.",
                "conclusion": "Conclusion of the analysis."
            },
            "dataSource": {
                "type": config["data_source"]["source_type"],
                "recordCount": 5000,
                "timePeriod": "Last 30 Days"
            }
        }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
