// Wire types for the run/job breakdown fields added alongside the gateway's
// per-category and per-stage benchmark reporting. Shared by both
// BenchmarkRun (a saved run) and JobResult (a submitted job's result) - both
// carry the same three optional fields on the wire (see benchmark.yaml's
// RunCountsBody/CategoryBreakdownBody/LayerBreakdownBody), so the aliases
// live in one file rather than being re-declared per consumer.
//
// All three fields are absent (not zero-filled) on a run/job persisted
// before the breakdown existed - never assume presence without checking.
export type {
  BenchmarkCategoryBreakdownBody as CategoryBreakdown,
  BenchmarkLayerBreakdownBody as LayerBreakdown,
  BenchmarkRunCountsBody as RunCounts,
} from '@/src/__codegen__/rest/benchmark';
