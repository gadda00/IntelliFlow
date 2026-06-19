"""
Parallel Agent Executor v1.0
==============================
Replaces sequential agent execution with a DAG (Directed Acyclic Graph)
dependency scheduler. Independent agents run concurrently; dependent agents
wait only for their actual prerequisites.

Pipeline DAG:
  data_quality_guardian ─┐
  data_scout            ─┤
                         ├─→ data_engineer ─→ analysis_strategist ─┐
                         │                                          ├─→ orchestrator ─→ narrative_composer
  nlq_interpreter       ─┘   anomaly_sentinel ──────────────────────┤
                              forecasting_oracle ───────────────────┤
                              causal_architect ──────────────────────┤
                              insight_generator ─────────────────────┤
                              visualization_specialist ───────────────┘
"""

import asyncio
import time
import logging
import traceback
from typing import Any, Callable, Dict, List, Optional
from datetime import datetime

from common.circuit_breaker import CircuitBreaker
from common.adk import Message

logger = logging.getLogger("intelliflow.parallel_executor")


# ─── Agent Task Definitions ────────────────────────────────────────────────────

AGENT_DAG = {
    # Stage 0 – independent, run in parallel immediately
    "data_quality_guardian": {"depends_on": [], "stage": 0, "timeout": 30},
    "data_scout": {"depends_on": [], "stage": 0, "timeout": 30},
    "nlq_interpreter": {"depends_on": [], "stage": 0, "timeout": 15},

    # Stage 1 – depends on data_scout
    "data_engineer": {"depends_on": ["data_scout"], "stage": 1, "timeout": 60},

    # Stage 2 – all can run in parallel after data_engineer
    "analysis_strategist": {"depends_on": ["data_engineer"], "stage": 2, "timeout": 30},
    "anomaly_sentinel": {"depends_on": ["data_engineer"], "stage": 2, "timeout": 45},
    "forecasting_oracle": {"depends_on": ["data_engineer"], "stage": 2, "timeout": 60},
    "causal_architect": {"depends_on": ["data_engineer"], "stage": 2, "timeout": 60},

    # Stage 3 – depends on analysis_strategist + anomaly/forecast/causal
    "insight_generator": {
        "depends_on": ["analysis_strategist", "anomaly_sentinel", "forecasting_oracle"],
        "stage": 3, "timeout": 60
    },
    "visualization_specialist": {
        "depends_on": ["analysis_strategist", "causal_architect"],
        "stage": 3, "timeout": 45
    },

    # Stage 4 – final synthesis
    "narrative_composer": {
        "depends_on": ["insight_generator", "visualization_specialist"],
        "stage": 4, "timeout": 60
    },

    # Orchestrator runs last to compile everything
    "orchestrator": {
        "depends_on": ["narrative_composer", "data_quality_guardian"],
        "stage": 5, "timeout": 30
    },
}


class AgentExecutionResult:
    def __init__(self, agent_id: str, success: bool, result: Any, duration_ms: float, error: str = None):
        self.agent_id = agent_id
        self.success = success
        self.result = result
        self.duration_ms = duration_ms
        self.error = error


class ParallelAgentExecutor:
    """
    Runs agents in topological order based on the DAG,
    with parallelism within each stage, circuit breakers,
    and real-time WebSocket progress broadcasting.
    """

    def __init__(self, agents: Dict[str, Any], broadcast_fn: Optional[Callable] = None):
        self.agents = agents
        self.broadcast = broadcast_fn or (lambda *args, **kwargs: None)
        self.circuit_breakers: Dict[str, CircuitBreaker] = {
            agent_id: CircuitBreaker(failure_threshold=2, reset_timeout=60)
            for agent_id in agents
        }

    async def run_full_pipeline(
        self,
        analysis_id: str,
        analysis_config: Dict,
        nlq_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run the complete 12-agent pipeline with parallel execution."""
        start_time = time.time()
        results: Dict[str, AgentExecutionResult] = {}
        completed: set = set()

        # Build shared context passed to each agent
        shared_context = {
            "analysis_id": analysis_id,
            "analysis_config": analysis_config,
            "nlq_query": nlq_query,
            "file_contents": analysis_config.get("data_source", {}).get("file_contents", []),
            "started_at": datetime.utcnow().isoformat()
        }

        # Execute stages in topological order
        stages = self._group_by_stage()

        for stage_num in sorted(stages.keys()):
            stage_agents = [
                agent_id for agent_id in stages[stage_num]
                if agent_id in self.agents
            ]
            if not stage_agents:
                continue

            logger.info(f"[{analysis_id}] Stage {stage_num}: running {stage_agents} in parallel")

            # Create async tasks for all agents in this stage
            tasks = []
            for agent_id in stage_agents:
                # Skip if dependency failed
                deps = AGENT_DAG.get(agent_id, {}).get("depends_on", [])
                dep_failures = [d for d in deps if d in results and not results[d].success]
                if dep_failures:
                    logger.warning(f"[{analysis_id}] Skipping {agent_id} — dependencies failed: {dep_failures}")
                    results[agent_id] = AgentExecutionResult(
                        agent_id, False, None, 0,
                        f"Dependency failed: {dep_failures}"
                    )
                    continue

                # Build context enriched with dependency results
                dep_results = {d: results[d].result for d in deps if d in results and results[d].success}
                task_context = {**shared_context, "dependency_results": dep_results}
                timeout = AGENT_DAG.get(agent_id, {}).get("timeout", 60)

                tasks.append(
                    self._run_agent_with_circuit_breaker(
                        agent_id=agent_id,
                        context=task_context,
                        analysis_id=analysis_id,
                        timeout=timeout
                    )
                )

            # Run all stage tasks concurrently
            if tasks:
                stage_results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in stage_results:
                    if isinstance(res, AgentExecutionResult):
                        results[res.agent_id] = res
                    elif isinstance(res, Exception):
                        logger.error(f"Unexpected error in stage {stage_num}: {res}")

        # Compile final output
        total_duration = round((time.time() - start_time) * 1000, 2)
        return self._compile_results(results, total_duration, analysis_id)

    # ─── Agent Runner ─────────────────────────────────────────────────────────

    async def _run_agent_with_circuit_breaker(
        self,
        agent_id: str,
        context: Dict,
        analysis_id: str,
        timeout: int
    ) -> AgentExecutionResult:
        """Run a single agent with circuit breaker, timeout, and broadcast."""
        cb = self.circuit_breakers.get(agent_id)
        
        if cb and cb.is_open():
            logger.warning(f"[{analysis_id}] Circuit open for {agent_id} — skipping")
            self.broadcast(analysis_id, agent_id, "skipped", 0, None)
            return AgentExecutionResult(agent_id, False, None, 0, "circuit_breaker_open")

        start = time.time()
        self.broadcast(analysis_id, agent_id, "running", 0, None)

        try:
            result = await asyncio.wait_for(
                self._dispatch_agent(agent_id, context),
                timeout=timeout
            )
            duration_ms = round((time.time() - start) * 1000, 2)

            if cb:
                cb.record_success()

            self.broadcast(analysis_id, agent_id, "completed", 100, result)
            logger.info(f"[{analysis_id}] ✓ {agent_id} completed in {duration_ms}ms")
            return AgentExecutionResult(agent_id, True, result, duration_ms)

        except asyncio.TimeoutError:
            duration_ms = round((time.time() - start) * 1000, 2)
            if cb:
                cb.record_failure()
            error_msg = f"Timeout after {timeout}s"
            self.broadcast(analysis_id, agent_id, "timeout", 0, None)
            logger.error(f"[{analysis_id}] ✗ {agent_id} timed out after {timeout}s")
            return AgentExecutionResult(agent_id, False, None, duration_ms, error_msg)

        except Exception as e:
            duration_ms = round((time.time() - start) * 1000, 2)
            if cb:
                cb.record_failure()
            error_msg = str(e)
            self.broadcast(analysis_id, agent_id, "error", 0, {"error": error_msg})
            logger.error(f"[{analysis_id}] ✗ {agent_id} failed: {e}\n{traceback.format_exc()}")
            return AgentExecutionResult(agent_id, False, None, duration_ms, error_msg)

    # ─── Agent Dispatch ───────────────────────────────────────────────────────

    async def _dispatch_agent(self, agent_id: str, context: Dict) -> Any:
        """Route execution to the correct agent method based on agent_id."""
        agent = self.agents.get(agent_id)
        if not agent:
            raise ValueError(f"Agent '{agent_id}' not found in pool")

        file_contents = context.get("file_contents", [])
        dep_results = context.get("dependency_results", {})
        analysis_config = context.get("analysis_config", {})
        nlq_query = context.get("nlq_query")

        # Route to the right method based on agent type
        if agent_id == "orchestrator":
            # Orchestrator compiles everything
            msg = Message(
                sender="parallel_executor", intent="compile_results",
                content={"all_results": dep_results, "analysis_config": analysis_config}
            )
            result = await agent.handle_start_analysis(msg)
            return result.content if hasattr(result, 'content') else result

        elif agent_id == "data_scout":
            msg = Message(sender="parallel_executor", intent="scout_data",
                          content={"data": {"file_contents": file_contents}})
            result = await agent.handle_scout_data(msg) if hasattr(agent, 'handle_scout_data') else {"status": "skipped"}
            return result.content if hasattr(result, 'content') else result

        elif agent_id == "data_engineer":
            scout_result = dep_results.get("data_scout", {})
            msg = Message(sender="parallel_executor", intent="process_data",
                          content={"data": {"file_contents": file_contents}, "scout_result": scout_result})
            result = await agent.handle_process_data(msg) if hasattr(agent, 'handle_process_data') else {"status": "skipped"}
            return result.content if hasattr(result, 'content') else result

        elif agent_id == "anomaly_sentinel":
            return await agent.detect(file_contents=file_contents, sensitivity="medium")

        elif agent_id == "forecasting_oracle":
            return await agent.forecast(file_contents=file_contents, periods=12)

        elif agent_id == "causal_architect":
            return await agent.analyze(file_contents=file_contents)

        elif agent_id == "nlq_interpreter":
            if nlq_query:
                return await agent.interpret(query=nlq_query, context={})
            return {"status": "skipped", "reason": "no_nlq_query"}

        elif agent_id == "data_quality_guardian":
            return await agent.assess(file_contents=file_contents)

        elif agent_id in ("analysis_strategist", "insight_generator",
                          "visualization_specialist", "narrative_composer"):
            # These use Message-based dispatch
            msg = Message(
                sender="parallel_executor",
                intent=f"handle_{agent_id.replace('_', '')}",
                content={
                    "analysis_config": analysis_config,
                    "data": {"file_contents": file_contents},
                    "context": dep_results
                }
            )
            # Try common handler names
            for method_name in [
                f"handle_{agent_id}", "handle_analyze", "handle_process",
                "execute", "run", "analyze"
            ]:
                if hasattr(agent, method_name):
                    result = await getattr(agent, method_name)(msg)
                    return result.content if hasattr(result, 'content') else result

            return {"status": "skipped", "agent": agent_id}

        else:
            return {"status": "unknown_agent", "agent_id": agent_id}

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _group_by_stage(self) -> Dict[int, List[str]]:
        stages: Dict[int, List[str]] = {}
        for agent_id, config in AGENT_DAG.items():
            stage = config.get("stage", 0)
            stages.setdefault(stage, []).append(agent_id)
        return stages

    def _compile_results(
        self, results: Dict[str, AgentExecutionResult], total_duration_ms: float, analysis_id: str
    ) -> Dict[str, Any]:
        successful = {k: v.result for k, v in results.items() if v.success and v.result}
        failed = {k: v.error for k, v in results.items() if not v.success}
        timing = {k: v.duration_ms for k, v in results.items()}

        # Extract key outputs
        output = {
            "status": "success" if len(successful) > len(failed) else "partial",
            "analysis_id": analysis_id,
            "execution": {
                "total_duration_ms": total_duration_ms,
                "agents_succeeded": len(successful),
                "agents_failed": len(failed),
                "agent_timing_ms": timing
            }
        }

        # Map agent outputs to response structure
        if "data_quality_guardian" in successful:
            output["data_quality"] = successful["data_quality_guardian"]
        if "anomaly_sentinel" in successful:
            output["anomalies"] = successful["anomaly_sentinel"]
        if "forecasting_oracle" in successful:
            output["forecast"] = successful["forecasting_oracle"]
        if "causal_architect" in successful:
            output["causal_analysis"] = successful["causal_architect"]
        if "nlq_interpreter" in successful:
            output["nlq_interpretation"] = successful["nlq_interpreter"]
        if "narrative_composer" in successful:
            output["report"] = successful["narrative_composer"]
        if "visualization_specialist" in successful:
            output["visualizations"] = successful["visualization_specialist"]
        if "insight_generator" in successful:
            output["insights"] = successful["insight_generator"]
        if "orchestrator" in successful:
            output["summary"] = successful["orchestrator"]

        if failed:
            output["agent_errors"] = failed

        return output
