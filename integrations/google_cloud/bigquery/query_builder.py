"""
BigQuery query builder for IntelliFlow.

This module provides a query builder for constructing BigQuery SQL queries
in a programmatic and type-safe manner.
"""

from typing import Dict, List, Any, Optional, Union, Set, Tuple
import logging
from enum import Enum

logger = logging.getLogger("intelliflow.integrations.google_cloud.bigquery.query_builder")

class JoinType(Enum):
    """Enum for SQL join types."""
    INNER = "INNER JOIN"
    LEFT = "LEFT JOIN"
    RIGHT = "RIGHT JOIN"
    FULL = "FULL JOIN"
    CROSS = "CROSS JOIN"


class AggregationType(Enum):
    """Enum for SQL aggregation functions."""
    SUM = "SUM"
    AVG = "AVG"
    MIN = "MIN"
    MAX = "MAX"
    COUNT = "COUNT"
    COUNT_DISTINCT = "COUNT_DISTINCT"


class SortOrder(Enum):
    """Enum for SQL sort orders."""
    ASC = "ASC"
    DESC = "DESC"


class QueryBuilder:
    """Builder for constructing BigQuery SQL queries."""
    
    def __init__(self):
        """Initialize query builder."""
        self.select_clauses: List[str] = []
        self.from_clause: Optional[str] = None
        self.join_clauses: List[str] = []
        self.where_clauses: List[str] = []
        self.group_by_clauses: List[str] = []
        self.having_clauses: List[str] = []
        self.order_by_clauses: List[str] = []
        self.limit_clause: Optional[int] = None
        self.offset_clause: Optional[int] = None
        self.parameters: Dict[str, Any] = {}
        
    def select(self, *columns: str) -> 'QueryBuilder':
        """
        Add columns to SELECT clause.
        
        Args:
            *columns: Column expressions
            
        Returns:
            Self for chaining
        """
        self.select_clauses.extend(columns)
        return self
        
    def select_with_alias(self, column: str, alias: str) -> 'QueryBuilder':
        """
        Add column with alias to SELECT clause.
        
        Args:
            column: Column expression
            alias: Column alias
            
        Returns:
            Self for chaining
        """
        self.select_clauses.append(f"{column} AS {alias}")
        return self
        
    def select_aggregate(self, 
                        aggregation: AggregationType, 
                        column: str, 
                        alias: Optional[str] = None) -> 'QueryBuilder':
        """
        Add aggregation to SELECT clause.
        
        Args:
            aggregation: Aggregation type
            column: Column to aggregate
            alias: Optional alias
            
        Returns:
            Self for chaining
        """
        if aggregation == AggregationType.COUNT_DISTINCT:
            expr = f"COUNT(DISTINCT {column})"
        else:
            expr = f"{aggregation.value}({column})"
            
        if alias:
            expr = f"{expr} AS {alias}"
            
        self.select_clauses.append(expr)
        return self
        
    def from_table(self, table: str) -> 'QueryBuilder':
        """
        Set FROM clause.
        
        Args:
            table: Table name
            
        Returns:
            Self for chaining
        """
        self.from_clause = table
        return self
        
    def from_subquery(self, subquery: 'QueryBuilder', alias: str) -> 'QueryBuilder':
        """
        Set FROM clause with subquery.
        
        Args:
            subquery: Subquery builder
            alias: Subquery alias
            
        Returns:
            Self for chaining
        """
        # Merge parameters from subquery
        self.parameters.update(subquery.parameters)
        
        # Set FROM clause
        self.from_clause = f"({subquery.build_query()}) AS {alias}"
        return self
        
    def join(self, 
            table: str, 
            on: str, 
            join_type: JoinType = JoinType.INNER) -> 'QueryBuilder':
        """
        Add JOIN clause.
        
        Args:
            table: Table to join
            on: Join condition
            join_type: Type of join
            
        Returns:
            Self for chaining
        """
        self.join_clauses.append(f"{join_type.value} {table} ON {on}")
        return self
        
    def where(self, condition: str) -> 'QueryBuilder':
        """
        Add WHERE clause.
        
        Args:
            condition: WHERE condition
            
        Returns:
            Self for chaining
        """
        self.where_clauses.append(condition)
        return self
        
    def where_equals(self, column: str, value: Any, param_name: Optional[str] = None) -> 'QueryBuilder':
        """
        Add WHERE equals condition with parameter.
        
        Args:
            column: Column name
            value: Value to compare
            param_name: Optional parameter name (auto-generated if None)
            
        Returns:
            Self for chaining
        """
        if param_name is None:
            param_name = f"param_{len(self.parameters)}"
            
        self.parameters[param_name] = value
        self.where_clauses.append(f"{column} = @{param_name}")
        return self
        
    def where_in(self, column: str, values: List[Any], param_name: Optional[str] = None) -> 'QueryBuilder':
        """
        Add WHERE IN condition with parameter.
        
        Args:
            column: Column name
            values: Values to check
            param_name: Optional parameter name (auto-generated if None)
            
        Returns:
            Self for chaining
        """
        if param_name is None:
            param_name = f"param_{len(self.parameters)}"
            
        self.parameters[param_name] = values
        self.where_clauses.append(f"{column} IN UNNEST(@{param_name})")
        return self
        
    def where_between(self, 
                     column: str, 
                     min_value: Any, 
                     max_value: Any,
                     min_param_name: Optional[str] = None,
                     max_param_name: Optional[str] = None) -> 'QueryBuilder':
        """
        Add WHERE BETWEEN condition with parameters.
        
        Args:
            column: Column name
            min_value: Minimum value
            max_value: Maximum value
            min_param_name: Optional parameter name for min value
            max_param_name: Optional parameter name for max value
            
        Returns:
            Self for chaining
        """
        if min_param_name is None:
            min_param_name = f"param_{len(self.parameters)}"
            
        if max_param_name is None:
            max_param_name = f"param_{len(self.parameters) + 1}"
            
        self.parameters[min_param_name] = min_value
        self.parameters[max_param_name] = max_value
        
        self.where_clauses.append(f"{column} BETWEEN @{min_param_name} AND @{max_param_name}")
        return self
        
    def group_by(self, *columns: str) -> 'QueryBuilder':
        """
        Add GROUP BY clause.
        
        Args:
            *columns: Columns to group by
            
        Returns:
            Self for chaining
        """
        self.group_by_clauses.extend(columns)
        return self
        
    def having(self, condition: str) -> 'QueryBuilder':
        """
        Add HAVING clause.
        
        Args:
            condition: HAVING condition
            
        Returns:
            Self for chaining
        """
        self.having_clauses.append(condition)
        return self
        
    def order_by(self, column: str, order: SortOrder = SortOrder.ASC) -> 'QueryBuilder':
        """
        Add ORDER BY clause.
        
        Args:
            column: Column to sort by
            order: Sort order
            
        Returns:
            Self for chaining
        """
        self.order_by_clauses.append(f"{column} {order.value}")
        return self
        
    def limit(self, limit: int) -> 'QueryBuilder':
        """
        Set LIMIT clause.
        
        Args:
            limit: Maximum number of rows
            
        Returns:
            Self for chaining
        """
        self.limit_clause = limit
        return self
        
    def offset(self, offset: int) -> 'QueryBuilder':
        """
        Set OFFSET clause.
        
        Args:
            offset: Number of rows to skip
            
        Returns:
            Self for chaining
        """
        self.offset_clause = offset
        return self
        
    def build_query(self) -> str:
        """
        Build the SQL query string.
        
        Returns:
            SQL query string
        """
        if not self.select_clauses:
            raise ValueError("SELECT clause is required")
            
        if not self.from_clause:
            raise ValueError("FROM clause is required")
            
        # Build query parts
        query_parts = []
        
        # SELECT clause
        select_clause = "SELECT " + ", ".join(self.select_clauses)
        query_parts.append(select_clause)
        
        # FROM clause
        from_clause = f"FROM {self.from_clause}"
        query_parts.append(from_clause)
        
        # JOIN clauses
        if self.join_clauses:
            query_parts.extend(self.join_clauses)
            
        # WHERE clause
        if self.where_clauses:
            where_clause = "WHERE " + " AND ".join(f"({condition})" for condition in self.where_clauses)
            query_parts.append(where_clause)
            
        # GROUP BY clause
        if self.group_by_clauses:
            group_by_clause = "GROUP BY " + ", ".join(self.group_by_clauses)
            query_parts.append(group_by_clause)
            
        # HAVING clause
        if self.having_clauses:
            having_clause = "HAVING " + " AND ".join(f"({condition})" for condition in self.having_clauses)
            query_parts.append(having_clause)
            
        # ORDER BY clause
        if self.order_by_clauses:
            order_by_clause = "ORDER BY " + ", ".join(self.order_by_clauses)
            query_parts.append(order_by_clause)
            
        # LIMIT clause
        if self.limit_clause is not None:
            query_parts.append(f"LIMIT {self.limit_clause}")
            
        # OFFSET clause
        if self.offset_clause is not None:
            query_parts.append(f"OFFSET {self.offset_clause}")
            
        # Join all parts
        query = "\n".join(query_parts)
        
        return query
        
    def build(self) -> Tuple[str, Dict[str, Any]]:
        """
        Build the SQL query string and parameters.
        
        Returns:
            Tuple of (query_string, parameters)
        """
        return (self.build_query(), self.parameters)
        
    @staticmethod
    def create() -> 'QueryBuilder':
        """
        Create a new query builder.
        
        Returns:
            New query builder instance
        """
        return QueryBuilder()


class CommonQueries:
    """Collection of common query patterns."""
    
    @staticmethod
    def table_schema(dataset_id: str, table_id: str) -> Tuple[str, Dict[str, Any]]:
        """
        Build a query to get table schema.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            
        Returns:
            Tuple of (query_string, parameters)
        """
        query = f"""
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM
          {dataset_id}.INFORMATION_SCHEMA.COLUMNS
        WHERE
          table_name = @table_id
        ORDER BY
          ordinal_position
        """
        
        params = {"table_id": table_id}
        
        return (query, params)
        
    @staticmethod
    def table_preview(dataset_id: str, table_id: str, limit: int = 10) -> Tuple[str, Dict[str, Any]]:
        """
        Build a query to preview table data.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            limit: Maximum number of rows
            
        Returns:
            Tuple of (query_string, parameters)
        """
        query = f"""
        SELECT
          *
        FROM
          `{dataset_id}.{table_id}`
        LIMIT
          {limit}
        """
        
        return (query, {})
        
    @staticmethod
    def table_stats(dataset_id: str, table_id: str) -> Tuple[str, Dict[str, Any]]:
        """
        Build a query to get table statistics.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            
        Returns:
            Tuple of (query_string, parameters)
        """
        query = f"""
        SELECT
          COUNT(*) AS row_count,
          COUNT(DISTINCT {{}}) AS distinct_count
        FROM
          `{dataset_id}.{table_id}`
        """
        
        return (query, {})
        
    @staticmethod
    def column_stats(dataset_id: str, table_id: str, column_name: str) -> Tuple[str, Dict[str, Any]]:
        """
        Build a query to get column statistics.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            column_name: Column name
            
        Returns:
            Tuple of (query_string, parameters)
        """
        query = f"""
        SELECT
          COUNT(*) AS row_count,
          COUNT({column_name}) AS non_null_count,
          COUNT(DISTINCT {column_name}) AS distinct_count,
          MIN({column_name}) AS min_value,
          MAX({column_name}) AS max_value,
          AVG({column_name}) AS avg_value,
          STDDEV({column_name}) AS stddev_value
        FROM
          `{dataset_id}.{table_id}`
        """
        
        return (query, {})

