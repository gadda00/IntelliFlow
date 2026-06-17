"""
IntelliFlow Backend Service v2.0
=================================
A production-grade backend with:
- Parallel agent execution via asyncio DAG
- JWT authentication
- Paystack payment integration
- Rate limiting
- WebSocket for real-time agent updates
- Smart caching with TTL
- Circuit breakers for agent resilience
- Full input validation
- Comprehensive error handling
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import asyncio
import json
import time
import os
import sys
import logging
import hashlib
import hmac
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from functools import wraps
import threading

# ─── Path Resolution (no more hardcoded paths) ────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from agents.orchestrator.main import OrchestratorAgent
from agents.data_scout.main import DataScoutAgent
from agents.data_engineer.main import DataEngineerAgent
from agents.analysis_strategist.main import AnalysisStrategyAgent
from agents.insight_generator.main import InsightGeneratorAgent
from agents.visualization_specialist.main import VisualizationSpecialistAgent
from agents.narrative_composer.main import NarrativeComposerAgent

# ─── New Agent Imports ─────────────────────────────────────────────────────────
from agents.anomaly_sentinel.main import AnomalySentinelAgent
from agents.forecasting_oracle.main import ForecastingOracleAgent
from agents.causal_architect.main import CausalArchitectAgent
from agents.nlq_interpreter.main import NLQInterpreterAgent
from agents.data_quality_guardian.main import DataQualityGuardianAgent

from common.parallel_executor import ParallelAgentExecutor
from common.circuit_breaker import CircuitBreaker
from common.smart_cache import SmartCache
from common.paystack_service import PaystackService
from common.auth_middleware import AuthMiddleware
from common.adk import Message

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger("intelliflow.backend")

# ─── App Initialization ────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'intelliflow-dev-secret-2026')
CORS(app, origins=os.getenv('ALLOWED_ORIGINS', '*').split(','))
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ─── Services ────────────────────────────────────────────────────────────────
cache = SmartCache(max_size=500, ttl_minutes=60)
auth = AuthMiddleware(secret=app.config['SECRET_KEY'])
paystack = PaystackService(
    secret_key=os.getenv('PAYSTACK_SECRET_KEY', ''),
    public_key=os.getenv('PAYSTACK_PUBLIC_KEY', '')
)

# ─── Rate Limiting (in-memory, production should use Redis) ────────────────────
_rate_limit_store: Dict[str, List[float]] = {}
_rate_limit_lock = threading.Lock()

def rate_limit(max_calls: int = 20, window_seconds: int = 60):
    """Sliding window rate limiter."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip = request.remote_addr or 'unknown'
            now = time.time()
            with _rate_limit_lock:
                calls = _rate_limit_store.get(ip, [])
                calls = [t for t in calls if now - t < window_seconds]
                if len(calls) >= max_calls:
                    return jsonify({
                        'error': 'rate_limit_exceeded',
                        'message': f'Maximum {max_calls} requests per {window_seconds}s exceeded.',
                        'retry_after': window_seconds - (now - calls[0])
                    }), 429
                calls.append(now)
                _rate_limit_store[ip] = calls
            return f(*args, **kwargs)
        return wrapper
    return decorator

def require_auth(f):
    """JWT auth decorator."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        api_key = request.headers.get('X-API-Key', '')
        
        user = auth.verify_token(token) or auth.verify_api_key(api_key)
        if not user:
            return jsonify({'error': 'unauthorized', 'message': 'Valid token or API key required'}), 401
        
        g.user = user
        return f(*args, **kwargs)
    return wrapper

def validate_request(schema: dict):
    """Simple schema validator for request JSON."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True)
            if not data:
                return jsonify({'error': 'invalid_request', 'message': 'JSON body required'}), 400
            
            errors = []
            for field, rules in schema.items():
                value = data.get(field)
                if rules.get('required') and value is None:
                    errors.append(f"'{field}' is required")
                if value is not None:
                    expected_type = rules.get('type')
                    if expected_type and not isinstance(value, expected_type):
                        errors.append(f"'{field}' must be {expected_type.__name__}")
                    max_len = rules.get('max_length')
                    if max_len and hasattr(value, '__len__') and len(value) > max_len:
                        errors.append(f"'{field}' exceeds max length of {max_len}")
            
            if errors:
                return jsonify({'error': 'validation_failed', 'details': errors}), 422
            
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ─── Agent Pool (singleton, initialized once) ─────────────────────────────────
_agent_pool: Optional[Dict[str, Any]] = None
_agent_pool_lock = threading.Lock()

def get_agent_pool() -> Dict[str, Any]:
    global _agent_pool
    if _agent_pool is None:
        with _agent_pool_lock:
            if _agent_pool is None:
                logger.info("Initializing IntelliFlow v2.0 agent pool (12 agents)...")
                _agent_pool = {
                    # Core 7 agents
                    "orchestrator": OrchestratorAgent(config={}),
                    "data_scout": DataScoutAgent(config={}),
                    "data_engineer": DataEngineerAgent(config={}),
                    "analysis_strategist": AnalysisStrategyAgent(config={}),
                    "insight_generator": InsightGeneratorAgent(config={}),
                    "visualization_specialist": VisualizationSpecialistAgent(config={}),
                    "narrative_composer": NarrativeComposerAgent(config={}),
                    # New 5 agents
                    "anomaly_sentinel": AnomalySentinelAgent(config={}),
                    "forecasting_oracle": ForecastingOracleAgent(config={}),
                    "causal_architect": CausalArchitectAgent(config={}),
                    "nlq_interpreter": NLQInterpreterAgent(config={}),
                    "data_quality_guardian": DataQualityGuardianAgent(config={})
                }
                logger.info(f"Agent pool ready: {len(_agent_pool)} agents loaded")
    return _agent_pool

# ─── WebSocket: Real-time agent status streaming ───────────────────────────────
@socketio.on('subscribe_analysis')
def handle_subscribe(data):
    analysis_id = data.get('analysis_id')
    if analysis_id:
        join_room(analysis_id)
        emit('subscribed', {'analysis_id': analysis_id, 'status': 'watching'})

def broadcast_agent_update(analysis_id: str, agent_name: str, status: str, progress: int, result: Any = None):
    """Broadcast agent progress to subscribed WebSocket clients."""
    socketio.emit('agent_update', {
        'analysis_id': analysis_id,
        'agent': agent_name,
        'status': status,
        'progress': progress,
        'result': result,
        'timestamp': datetime.utcnow().isoformat()
    }, room=analysis_id)

# ─── Core Analysis Endpoint ─────────────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
@rate_limit(max_calls=10, window_seconds=60)
@validate_request({
    'analysisConfig': {'required': True, 'type': dict}
})
def analyze_data():
    """
    Main analysis endpoint - runs all 12 agents with parallel execution,
    circuit breakers, caching, and real-time WebSocket updates.
    """
    try:
        data = request.get_json()
        analysis_config = data.get("analysisConfig", {})
        analysis_id = data.get("analysis_id", hashlib.md5(
            json.dumps(analysis_config, sort_keys=True).encode()
        ).hexdigest()[:12])
        
        # Check cache first
        cache_key = f"analysis:{analysis_id}"
        cached = cache.get(cache_key)
        if cached and not data.get("force_refresh", False):
            logger.info(f"Cache hit for analysis {analysis_id}")
            return jsonify({**cached, "cached": True, "analysis_id": analysis_id})

        file_contents = analysis_config.get("data_source", {}).get("file_contents", [])
        nlq_query = analysis_config.get("nlq_query", None)

        if not file_contents and not analysis_config.get("data_source", {}).get("bigquery_table"):
            return jsonify({
                "status": "error",
                "message": "Provide file_contents or a BigQuery table in analysisConfig.data_source"
            }), 400

        agents = get_agent_pool()
        executor = ParallelAgentExecutor(agents, broadcast_fn=broadcast_agent_update)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                executor.run_full_pipeline(
                    analysis_id=analysis_id,
                    analysis_config=analysis_config,
                    nlq_query=nlq_query
                )
            )
        finally:
            loop.close()

        if result.get("status") == "success":
            cache.set(cache_key, result)

        return jsonify({**result, "analysis_id": analysis_id})

    except Exception as e:
        logger.exception("Analysis failed")
        return jsonify({
            "status": "error",
            "message": str(e),
            "analysis_id": analysis_id if 'analysis_id' in locals() else None
        }), 500

# ─── Natural Language Query ─────────────────────────────────────────────────────
@app.route("/api/nlq", methods=["POST"])
@rate_limit(max_calls=30, window_seconds=60)
@validate_request({
    'query': {'required': True, 'type': str, 'max_length': 1000},
    'context': {'required': False, 'type': dict}
})
def natural_language_query():
    """Translate a natural language question into an analysis plan."""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        context = data.get('context', {})

        agents = get_agent_pool()
        nlq_agent: NLQInterpreterAgent = agents['nlq_interpreter']

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                nlq_agent.interpret(query=query, context=context)
            )
        finally:
            loop.close()

        return jsonify(result)
    except Exception as e:
        logger.exception("NLQ failed")
        return jsonify({"status": "error", "message": str(e)}), 500

# ─── Anomaly Detection Endpoint ────────────────────────────────────────────────
@app.route("/api/detect-anomalies", methods=["POST"])
@rate_limit(max_calls=20, window_seconds=60)
def detect_anomalies():
    """Run standalone anomaly detection on provided data."""
    try:
        data = request.get_json()
        file_contents = data.get("file_contents", [])
        sensitivity = data.get("sensitivity", "medium")  # low, medium, high

        agents = get_agent_pool()
        sentinel: AnomalySentinelAgent = agents['anomaly_sentinel']

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                sentinel.detect(file_contents=file_contents, sensitivity=sensitivity)
            )
        finally:
            loop.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ─── Forecasting Endpoint ──────────────────────────────────────────────────────
@app.route("/api/forecast", methods=["POST"])
@rate_limit(max_calls=20, window_seconds=60)
def forecast():
    """Time series forecasting endpoint."""
    try:
        data = request.get_json()
        file_contents = data.get("file_contents", [])
        periods = min(int(data.get("periods", 12)), 120)
        target_column = data.get("target_column")

        agents = get_agent_pool()
        oracle: ForecastingOracleAgent = agents['forecasting_oracle']

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                oracle.forecast(
                    file_contents=file_contents,
                    periods=periods,
                    target_column=target_column
                )
            )
        finally:
            loop.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ─── Causal Analysis Endpoint ─────────────────────────────────────────────────
@app.route("/api/causal-analysis", methods=["POST"])
@rate_limit(max_calls=10, window_seconds=60)
def causal_analysis():
    """Discover causal relationships in data."""
    try:
        data = request.get_json()
        file_contents = data.get("file_contents", [])
        target_variable = data.get("target_variable")

        agents = get_agent_pool()
        architect: CausalArchitectAgent = agents['causal_architect']

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                architect.analyze(
                    file_contents=file_contents,
                    target_variable=target_variable
                )
            )
        finally:
            loop.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ─── Data Quality Check ────────────────────────────────────────────────────────
@app.route("/api/data-quality", methods=["POST"])
@rate_limit(max_calls=20, window_seconds=60)
def data_quality():
    """Comprehensive data quality assessment."""
    try:
        data = request.get_json()
        file_contents = data.get("file_contents", [])

        agents = get_agent_pool()
        guardian: DataQualityGuardianAgent = agents['data_quality_guardian']

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(guardian.assess(file_contents=file_contents))
        finally:
            loop.close()

        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ─── Authentication Endpoints ──────────────────────────────────────────────────
@app.route("/api/auth/login", methods=["POST"])
@rate_limit(max_calls=5, window_seconds=60)
def login():
    """Login and receive JWT token."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    user = auth.authenticate(email, password)
    if not user:
        return jsonify({"error": "invalid_credentials"}), 401

    token = auth.generate_token(user)
    return jsonify({
        "token": token,
        "user": {k: v for k, v in user.items() if k != 'password_hash'},
        "expires_in": 86400
    })

@app.route("/api/auth/register", methods=["POST"])
@rate_limit(max_calls=3, window_seconds=300)
def register():
    """Register a new user."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "")

    if not email or not password or not name:
        return jsonify({"error": "name, email, and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "password must be at least 8 characters"}), 400

    user = auth.create_user(email=email, password=password, name=name)
    if not user:
        return jsonify({"error": "email_already_registered"}), 409

    token = auth.generate_token(user)
    return jsonify({
        "token": token,
        "user": {k: v for k, v in user.items() if k != 'password_hash'},
        "message": "Welcome to IntelliFlow!"
    }), 201

@app.route("/api/auth/api-keys", methods=["GET", "POST"])
@require_auth
def manage_api_keys():
    """List or create API keys for the authenticated user."""
    user_id = g.user.get('id')
    if request.method == "GET":
        keys = auth.list_api_keys(user_id)
        return jsonify({"api_keys": keys})
    
    data = request.get_json(silent=True) or {}
    key_name = data.get("name", f"Key {datetime.utcnow().strftime('%Y-%m-%d')}")
    new_key = auth.create_api_key(user_id=user_id, name=key_name)
    return jsonify({"api_key": new_key, "message": "Store this key safely — it won't be shown again."}), 201

# ─── Paystack Payment Endpoints ────────────────────────────────────────────────
PLANS = {
    "free": {"price_ngn": 0, "price_usd": 0, "analyses_per_month": 5, "features": ["basic_analysis"]},
    "pro": {"price_ngn": 15000, "price_usd": 29, "analyses_per_month": 50, "features": ["all_agents", "forecasting", "anomaly_detection", "api_access"]},
    "team": {"price_ngn": 50000, "price_usd": 99, "analyses_per_month": 200, "features": ["all_agents", "collaboration", "priority_support", "advanced_export"]},
    "enterprise": {"price_ngn": None, "price_usd": None, "analyses_per_month": -1, "features": ["everything", "dedicated_support", "sso", "custom_agents"]}
}

@app.route("/api/plans", methods=["GET"])
def get_plans():
    """Return available subscription plans."""
    return jsonify({"plans": PLANS})

@app.route("/api/payments/initialize", methods=["POST"])
@require_auth
@rate_limit(max_calls=5, window_seconds=60)
def initialize_payment():
    """Initialize a Paystack transaction for plan upgrade."""
    data = request.get_json(silent=True) or {}
    plan = data.get("plan")
    currency = data.get("currency", "NGN")
    
    if plan not in PLANS:
        return jsonify({"error": f"Invalid plan. Choose from: {list(PLANS.keys())}"}), 400
    if plan == "free":
        return jsonify({"error": "Free plan requires no payment"}), 400
    if plan == "enterprise":
        return jsonify({"message": "Contact sales@intelliflow.ai for enterprise pricing", "contact": True}), 200

    plan_details = PLANS[plan]
    amount_ngn = plan_details["price_ngn"] * 100  # Paystack uses kobo

    result = paystack.initialize_transaction(
        email=g.user.get("email"),
        amount=amount_ngn,
        metadata={
            "user_id": g.user.get("id"),
            "plan": plan,
            "currency_display": currency
        },
        callback_url=os.getenv("FRONTEND_URL", "https://intelli-flow-brown.vercel.app") + "/payment/verify"
    )

    if not result.get("success"):
        return jsonify({"error": "Payment initialization failed", "details": result.get("error")}), 500

    return jsonify({
        "authorization_url": result["authorization_url"],
        "access_code": result["access_code"],
        "reference": result["reference"],
        "plan": plan,
        "amount_ngn": plan_details["price_ngn"],
        "amount_usd": plan_details["price_usd"]
    })

@app.route("/api/payments/verify", methods=["POST"])
@rate_limit(max_calls=10, window_seconds=60)
def verify_payment():
    """Verify a Paystack payment and upgrade user plan."""
    data = request.get_json(silent=True) or {}
    reference = data.get("reference")

    if not reference:
        return jsonify({"error": "Payment reference required"}), 400

    result = paystack.verify_transaction(reference)
    
    if not result.get("success"):
        return jsonify({"error": "Payment verification failed", "details": result.get("message")}), 400

    # Extract plan from metadata and upgrade user
    metadata = result.get("metadata", {})
    user_id = metadata.get("user_id")
    plan = metadata.get("plan", "pro")

    if user_id:
        auth.upgrade_user_plan(user_id=user_id, plan=plan)

    return jsonify({
        "status": "success",
        "message": f"Payment verified. Your account has been upgraded to {plan.upper()}!",
        "plan": plan,
        "amount_paid": result.get("amount"),
        "reference": reference
    })

@app.route("/api/payments/webhook", methods=["POST"])
def paystack_webhook():
    """Handle Paystack webhook events."""
    signature = request.headers.get("x-paystack-signature", "")
    body = request.get_data()

    if not paystack.verify_webhook(body, signature):
        return jsonify({"error": "Invalid webhook signature"}), 401

    event = request.get_json()
    event_type = event.get("event")
    
    if event_type == "charge.success":
        data = event.get("data", {})
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        plan = metadata.get("plan", "pro")
        if user_id:
            auth.upgrade_user_plan(user_id=user_id, plan=plan)
            logger.info(f"Webhook: User {user_id} upgraded to {plan} via Paystack")

    return jsonify({"status": "ok"})

# ─── Analytics Endpoints ──────────────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
@require_auth
def user_stats():
    """Return usage stats for the current user."""
    user_id = g.user.get("id")
    plan = g.user.get("plan", "free")
    plan_details = PLANS.get(plan, PLANS["free"])
    
    return jsonify({
        "user": {
            "id": user_id,
            "plan": plan,
            "analyses_used_this_month": auth.get_usage_count(user_id),
            "analyses_limit": plan_details["analyses_per_month"],
            "features": plan_details["features"]
        },
        "platform": {
            "total_agents": 12,
            "agent_names": [
                "Orchestrator", "Data Scout", "Data Engineer", "Analysis Strategist",
                "Insight Generator", "Visualization Specialist", "Narrative Composer",
                "Anomaly Sentinel", "Forecasting Oracle", "Causal Architect",
                "NLQ Interpreter", "Data Quality Guardian"
            ]
        }
    })

# ─── Health & System Endpoints ─────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health_check():
    """Comprehensive health check."""
    agents = get_agent_pool()
    cache_stats = cache.stats()
    return jsonify({
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "agents": {
            "total": len(agents),
            "names": list(agents.keys())
        },
        "cache": cache_stats,
        "environment": os.getenv("ENVIRONMENT", "development")
    })

@app.route("/api/agents", methods=["GET"])
def list_agents():
    """Return info about all available agents."""
    return jsonify({
        "agents": [
            {"id": "orchestrator", "name": "Orchestrator", "role": "Workflow coordination & task distribution", "tier": "core"},
            {"id": "data_scout", "name": "Data Scout", "role": "Data discovery, validation & quality assessment", "tier": "core"},
            {"id": "data_engineer", "name": "Data Engineer", "role": "Advanced preprocessing, cleaning & transformation", "tier": "core"},
            {"id": "analysis_strategist", "name": "Analysis Strategist", "role": "Strategic analysis planning & methodology selection", "tier": "core"},
            {"id": "insight_generator", "name": "Insight Generator", "role": "AI-powered insight generation via Gemini", "tier": "core"},
            {"id": "visualization_specialist", "name": "Visualization Specialist", "role": "Dynamic chart creation & visual representation", "tier": "core"},
            {"id": "narrative_composer", "name": "Narrative Composer", "role": "Professional report compilation & storytelling", "tier": "core"},
            {"id": "anomaly_sentinel", "name": "Anomaly Sentinel", "role": "Multi-algorithm anomaly & outlier detection", "tier": "advanced"},
            {"id": "forecasting_oracle", "name": "Forecasting Oracle", "role": "Time series forecasting with confidence intervals", "tier": "advanced"},
            {"id": "causal_architect", "name": "Causal Architect", "role": "Causal relationship discovery & what-if analysis", "tier": "advanced"},
            {"id": "nlq_interpreter", "name": "NLQ Interpreter", "role": "Natural language to structured analysis query", "tier": "advanced"},
            {"id": "data_quality_guardian", "name": "Data Quality Guardian", "role": "Comprehensive data quality scoring & validation", "tier": "advanced"},
        ],
        "total": 12
    })

# ─── Error Handlers ────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "not_found", "message": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "method_not_allowed"}), 405

@app.errorhandler(500)
def internal_error(e):
    logger.exception("Internal server error")
    return jsonify({"error": "internal_server_error", "message": "Something went wrong"}), 500

# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("ENVIRONMENT", "development") == "development"
    logger.info(f"Starting IntelliFlow v2.0 on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
