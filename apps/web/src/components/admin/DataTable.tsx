'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Reusable DataTable with:
 *   - column-level sorting (click header to toggle asc/desc)
 *   - global text search (across all string columns)
 *   - per-column select filters
 *   - row selection via checkboxes (when onSelectionChange is provided)
 *   - pagination (page size + prev/next)
 *
 * The table is fully client-side — pass it the raw rows and it handles the
 * rest. Designed to keep admin pages small (the page just declares the column
 * config and the data source).
 */

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  /** Unique key — must be a top-level path on T. */
  key: string;
  header: string;
  /** Render the cell. Defaults to `String(row[key])`. */
  render?: (row: T) => React.ReactNode;
  /** Extract the comparable value for sorting. Defaults to `row[key]`. */
  sortValue?: (row: T) => string | number;
  /** Render the sort key instead of the display value when filtering. */
  filterValue?: (row: T) => string;
  /** When provided, this column gets a dropdown filter. */
  filterOptions?: { label: string; value: string }[];
  /** Right-align numeric columns. */
  numeric?: boolean;
  /** Disable sorting on this column. */
  disableSort?: boolean;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  pageSize?: number;
  /** Search placeholder. Set to null to hide search. */
  searchPlaceholder?: string | null;
  /** Called when row is clicked. */
  onRowClick?: (row: T) => void;
  /** Enable row selection (checkboxes). */
  selectable?: boolean;
  /** Currently selected row keys. */
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyState,
  pageSize = 25,
  searchPlaceholder = 'Search…',
  onRowClick,
  selectable,
  selectedKeys = [],
  onSelectionChange,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);

  const handleSort = useCallback(
    (col: DataTableColumn<T>) => {
      if (col.disableSort) return;
      if (sortKey === col.key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(col.key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const filtered = useMemo(() => {
    let out = rows;
    // Global search
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter(row =>
        columns.some(col => {
          const fv = col.filterValue
            ? col.filterValue(row)
            : String((row as Record<string, unknown>)[col.key] ?? '');
          return fv.toLowerCase().includes(q);
        }),
      );
    }
    // Per-column filters
    for (const [colKey, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      out = out.filter(row => {
        const col = columns.find(c => c.key === colKey);
        const fv = col?.filterValue
          ? col.filterValue(row)
          : String((row as Record<string, unknown>)[colKey] ?? '');
        return fv === value;
      });
    }
    return out;
  }, [rows, columns, search, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return filtered;
    const accessor = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[col.key] as string | number);
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return copy;
  }, [filtered, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const allOnPageSelected =
    selectable && pageRows.length > 0 && pageRows.every(r => selectedKeys.includes(rowKey(r, 0)));
  const someOnPageSelected =
    selectable && pageRows.some(r => selectedKeys.includes(rowKey(r, 0)));

  const toggleAllOnPage = useCallback(() => {
    if (!onSelectionChange) return;
    const pageKeys = pageRows.map(r => rowKey(r, 0));
    if (allOnPageSelected) {
      onSelectionChange(selectedKeys.filter(k => !pageKeys.includes(k)));
    } else {
      const next = [...selectedKeys];
      for (const k of pageKeys) if (!next.includes(k)) next.push(k);
      onSelectionChange(next);
    }
  }, [allOnPageSelected, onSelectionChange, pageRows, rowKey, selectedKeys]);

  const toggleRow = useCallback(
    (key: string) => {
      if (!onSelectionChange) return;
      if (selectedKeys.includes(key)) {
        onSelectionChange(selectedKeys.filter(k => k !== key));
      } else {
        onSelectionChange([...selectedKeys, key]);
      }
    },
    [onSelectionChange, selectedKeys],
  );

  return (
    <Card className={cn('bg-slate-900/60 border-slate-800', className)}>
      {/* Toolbar: search + per-column filters */}
      <div className="flex flex-col gap-3 p-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder !== null && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-600 pl-8"
              />
            </div>
          )}
          {selectable && selectedKeys.length > 0 && (
            <span className="text-xs text-slate-400 px-2 py-1 rounded bg-slate-800/60 border border-slate-700">
              {selectedKeys.length} selected
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {columns
            .filter(c => c.filterOptions && c.filterOptions.length > 0)
            .map(col => (
              <div key={`filter-${col.key}`} className="flex items-center gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500">
                  {col.header}
                </label>
                <Select
                  value={columnFilters[col.key] ?? '__all'}
                  onValueChange={v => {
                    setColumnFilters(prev => ({ ...prev, [col.key]: v === '__all' ? '' : v }));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-[150px] bg-slate-950/60 border-slate-700 text-slate-200 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="__all">All</SelectItem>
                    {col.filterOptions!.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-10 w-full bg-slate-800" />
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">
          {emptyState ?? 'No rows match your filters.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10 text-slate-400">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500"
                    checked={allOnPageSelected}
                    ref={el => {
                      if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                    }}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                  />
                </TableHead>
              )}
              {columns.map(col => {
                const isSorted = sortKey === col.key;
                return (
                  <TableHead
                    key={col.key}
                    onClick={() => handleSort(col)}
                    className={cn(
                      'text-slate-400 font-medium select-none',
                      col.numeric && 'text-right',
                      col.hideOnMobile && 'hidden md:table-cell',
                      !col.disableSort && 'cursor-pointer hover:text-slate-200',
                    )}
                  >
                    <span className={cn('inline-flex items-center gap-1', col.numeric && 'flex-row-reverse')}>
                      {col.header}
                      {!col.disableSort && (
                        isSorted ? (
                          sortDir === 'asc' ? (
                            <ChevronUp className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-emerald-400" />
                          )
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-700" />
                        )
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => {
              const key = rowKey(row, i);
              const isSelected = selectedKeys.includes(key);
              return (
                <TableRow
                  key={key}
                  className={cn(
                    'border-slate-800 group',
                    onRowClick && 'cursor-pointer hover:bg-slate-900/60',
                    isSelected && 'bg-emerald-500/5',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        aria-label={`Select row ${key}`}
                      />
                    </TableCell>
                  )}
                  {columns.map(col => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.numeric && 'text-right tabular-nums',
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
          <span>
            Showing {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of{' '}
            {sorted.length.toLocaleString()}{sorted.length !== rows.length && ` (filtered from ${rows.length.toLocaleString()})`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="border-slate-700 text-slate-300 h-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="tabular-nums">
              Page {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="border-slate-700 text-slate-300 h-7"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
