# Google Cloud Integrations for IntelliFlow

This module provides comprehensive integrations with Google Cloud services for the IntelliFlow platform, enabling advanced data analysis, machine learning, and workflow automation capabilities.

## Features

### BigQuery Integration

The BigQuery integration provides a robust client for interacting with Google BigQuery, including:

- **Query Execution**: Execute SQL queries with parameter support and async operation
- **Query Builder**: Build SQL queries programmatically with type safety
- **Data Management**: Create, update, and delete datasets and tables
- **Schema Exploration**: Explore dataset and table schemas
- **Data Visualization**: Create visualizations from query results

### Vertex AI Integration

The Vertex AI integration provides access to Google's machine learning platform, including:

- **Model Management**: List, get, and deploy models
- **Prediction**: Make predictions with deployed models
- **Batch Prediction**: Run batch prediction jobs
- **Dataset Management**: Create and manage datasets
- **Training**: Create and manage training jobs
- **Gemini Integration**: Access Google's Gemini models for text generation, multimodal inputs, and chat

### Storage Integration

The Storage integration provides a client for interacting with Google Cloud Storage, including:

- **Bucket Management**: Create, list, and delete buckets
- **Object Management**: Upload, download, and delete objects
- **Metadata**: Get and update object metadata
- **Access Control**: Generate signed URLs and make objects public
- **Batch Operations**: Copy objects and perform batch operations

### Pub/Sub Integration

The Pub/Sub integration provides a client for interacting with Google Cloud Pub/Sub, including:

- **Topic Management**: Create, list, and delete topics
- **Subscription Management**: Create, list, and delete subscriptions
- **Publishing**: Publish messages to topics
- **Consuming**: Pull messages from subscriptions and acknowledge them
- **Streaming**: Subscribe to messages with callback functions

### Cloud Functions Integration

The Cloud Functions integration provides a client for interacting with Google Cloud Functions, including:

- **Function Management**: List, get, and delete functions
- **Deployment**: Deploy and update functions
- **Invocation**: Call functions and get results
- **Logging**: Get function logs

## Usage

### BigQuery

```python
from intelliflow.integrations.google_cloud import BigQueryClient
from intelliflow.integrations.google_cloud.bigquery import QueryBuilder

# Initialize client
client = BigQueryClient(
    project_id="your-project-id",
    credentials_path="/path/to/credentials.json"
)

# Execute a query
result = await client.execute_query(
    query="SELECT * FROM `dataset.table` WHERE column = @param",
    params={"param": "value"}
)

# Use query builder
query = QueryBuilder.create() \
    .select("column1", "column2") \
    .select_aggregate(AggregationType.SUM, "column3", "total") \
    .from_table("`dataset.table`") \
    .where_equals("column4", "value") \
    .group_by("column1", "column2") \
    .order_by("total", SortOrder.DESC) \
    .limit(10)

query_str, params = query.build()
result = await client.execute_query(query_str, params)

# Create visualizations
from intelliflow.integrations.google_cloud.bigquery import BigQueryVisualizer

visualizer = BigQueryVisualizer()
chart = visualizer.create_bar_chart(
    data=result["results"],
    x_column="column1",
    y_column="total",
    title="Total by Column 1"
)
```

### Vertex AI

```python
from intelliflow.integrations.google_cloud import VertexAIClient

# Initialize client
client = VertexAIClient(
    project_id="your-project-id",
    location="us-central1",
    credentials_path="/path/to/credentials.json"
)

# List models
models = await client.list_models()

# Make predictions
predictions = await client.predict(
    model_id="model-id",
    instances=[{"feature1": 1.0, "feature2": 2.0}]
)

# Use Gemini
from intelliflow.integrations.google_cloud.vertex_ai import GeminiClient

gemini = GeminiClient(
    project_id="your-project-id",
    location="us-central1",
    credentials_path="/path/to/credentials.json"
)

# Generate text
response = await gemini.generate_text(
    prompt="Write a summary of the IntelliFlow platform",
    model="gemini-1.0-pro"
)

# Generate multimodal content
response = await gemini.generate_multimodal(
    prompt="Describe this image",
    images=["/path/to/image.jpg"],
    model="gemini-1.0-pro-vision"
)
```

### Storage

```python
from intelliflow.integrations.google_cloud import StorageClient

# Initialize client
client = StorageClient(
    project_id="your-project-id",
    credentials_path="/path/to/credentials.json"
)

# List buckets
buckets = await client.list_buckets()

# Upload file
result = await client.upload_file(
    bucket_name="bucket-name",
    source_file_path="/path/to/file.txt",
    destination_blob_name="file.txt"
)

# Download file
result = await client.download_file(
    bucket_name="bucket-name",
    source_blob_name="file.txt",
    destination_file_path="/path/to/download.txt"
)

# Generate signed URL
url = await client.generate_signed_url(
    bucket_name="bucket-name",
    blob_name="file.txt",
    expiration=3600
)
```

### Pub/Sub

```python
from intelliflow.integrations.google_cloud import PubSubClient

# Initialize client
client = PubSubClient(
    project_id="your-project-id",
    credentials_path="/path/to/credentials.json"
)

# Create topic
topic = await client.create_topic("topic-name")

# Create subscription
subscription = await client.create_subscription(
    topic_name="topic-name",
    subscription_name="subscription-name"
)

# Publish message
result = await client.publish_message(
    topic_name="topic-name",
    data={"key": "value"},
    attributes={"attribute": "value"}
)

# Pull messages
messages = await client.pull_messages(
    subscription_name="subscription-name",
    max_messages=10
)

# Subscribe with callback
def process_message(message):
    print(f"Received message: {message}")

result = client.subscribe(
    subscription_name="subscription-name",
    callback=process_message
)
```

### Cloud Functions

```python
from intelliflow.integrations.google_cloud import CloudFunctionsClient

# Initialize client
client = CloudFunctionsClient(
    project_id="your-project-id",
    region="us-central1",
    credentials_path="/path/to/credentials.json"
)

# List functions
functions = await client.list_functions()

# Deploy function
result = await client.deploy_function(
    function_name="function-name",
    source_dir="/path/to/function",
    entry_point="main",
    runtime="python39",
    trigger_http=True
)

# Call function
response = await client.call_function(
    function_name="function-name",
    data={"key": "value"}
)

# Get logs
logs = await client.get_function_logs(
    function_name="function-name",
    limit=100
)
```

## Configuration

All clients accept the following common parameters:

- `project_id`: Google Cloud project ID
- `credentials_path`: Path to service account credentials JSON file

Additional parameters:

- `VertexAIClient`: `location` (default: "us-central1")
- `CloudFunctionsClient`: `region` (default: "us-central1")

## Authentication

The integrations support the following authentication methods:

1. **Service Account Key**: Provide a path to a service account key JSON file
2. **Application Default Credentials**: If no credentials path is provided, the client will use application default credentials

## Error Handling

All methods return a dictionary with a `status` field that is either "success" or "error". If the status is "error", the dictionary will also contain a `message` field with the error message.

```python
result = await client.execute_query("SELECT * FROM `dataset.table`")
if result["status"] == "error":
    print(f"Error: {result['message']}")
else:
    print(f"Success: {len(result['results'])} rows returned")
```

## Async Support

All methods are implemented as async functions to avoid blocking the main thread. This allows for efficient concurrent operations and better performance in web applications.

## Dependencies

- `google-cloud-bigquery`
- `google-cloud-storage`
- `google-cloud-pubsub`
- `google-cloud-functions`
- `google-cloud-aiplatform`
- `pandas`
- `matplotlib`
- `seaborn`

