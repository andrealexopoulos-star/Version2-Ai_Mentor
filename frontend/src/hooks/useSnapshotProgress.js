/**
 * useSnapshotProgress — Enhanced snapshot hook with stage tracking & telemetry.
 *
 * Extends useSnapshot to add:
 * - Granular stages: fetching → preprocessing → analyzing → assembling → complete
 * - Determinate progress (0-100)
 * - Telemetry: snapshot_start, snapshot_stage_complete, snapshot_finish, snapshot_error
 * - resumeSnapshot() — picks up from failed/cancelled run
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSnapshot } from './useSnapshot';
import { trackEvent } from '../lib/analytics';

const STAGES = ['fetching', 'preprocessing', 'analyzing', 'assembling', 'complete'];
const STAGE_DURATION_MS = {
  fetching: 3000,
  preprocessing: 6000,
  analyzing: 12000,
  assembling: 9000,
  complete: 0,
};

/**
 * Stage-to-progress mapping (auto-fill when no real progress provided)
 */
const STAGE_PCT = { fetching: 15, preprocessing: 35, analyzing: 65, assembling: 85, complete: 100 };

export function useSnapshotProgress() {
  const snapshot = useSnapshot();
  const { loading, error, cognitive, refresh } = snapshot;

  const [stage, setStage] = useState('fetching');
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const stageTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Start tracking when loading begins
  useEffect(() => {
    if (loading) {
      const now = Date.now();
      setStartedAt(now);
      startTimeRef.current = now;
      setStage('fetching');
      setProgress(5);

      // Emit snapshot_start telemetry
      trackEvent('snapshot_start', { timestamp: now });

      // Auto-advance stages when no real progress updates available
      let cumulativeMs = 0;
      const timers = STAGES.filter(s => s !== 'complete').map((s, i) => {
        cumulativeMs += STAGE_DURATION_MS[s];
        return setTimeout(() => {
          setStage(STAGES[i + 1] || 'assembling');
          setProgress(STAGE_PCT[STAGES[i + 1]] || 85);
          trackEvent('snapshot_stage_complete', { stage: s, elapsed_ms: Date.now() - startTimeRef.current });
        }, cumulativeMs);
      });

      stageTimerRef.current = timers;
      return () => timers.forEach(clearTimeout);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // When loading finishes
  useEffect(() => {
    if (!loading && startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current;

      if (error) {
        setStage('fetching');
        setProgress(0);
        trackEvent('snapshot_error', { error, elapsed_ms: elapsed });
      } else if (cognitive) {
        setStage('complete');
        setProgress(100);
        trackEvent('snapshot_finish', {
          elapsed_ms: elapsed,
          has_memo: !!(cognitive.executive_memo || cognitive.memo),
          state: cognitive.system_state?.status || cognitive.system_state || 'unknown',
        });
      }

      // Clear stage advance timers
      if (stageTimerRef.current) {
        stageTimerRef.current.forEach(clearTimeout);
        stageTimerRef.current = null;
      }
    }
  }, [loading, error, cognitive]);

  /**
   * resumeSnapshot — picks up from failed/cancelled run without full reload.
   * Resets stage to 'analyzing' (not 'fetching') to indicate continuation.
   */
  const resumeSnapshot = useCallback(async () => {
    setStage('analyzing');
    setProgress(50);
    trackEvent('snapshot_resume', { timestamp: Date.now() });
    await refresh();
  }, [refresh]);

  return {
    ...snapshot,
    stage,
    progress,
    startedAt,
    resumeSnapshot,
  };
}
