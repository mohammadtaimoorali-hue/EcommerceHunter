import { useEffect, useState } from 'react';
import { api } from '../api';

const JOB_TYPES = ['DISCOVERY', 'PRICE_STOCK_CHECK', 'MONITORING', 'RESCORING', 'WEEKLY_ANALYSIS'];

export default function SystemSettings() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<any>(null);

  useEffect(() => {
    api.settings().then(setSettings).catch((e) => setError(String(e)));
  }, []);

  async function triggerJob(type: string) {
    setJobResult(null);
    try {
      const result = await api.triggerJob(type);
      setJobResult(result);
    } catch (e) {
      setError(String(e));
    }
  }

  async function updateOperatingMode(mode: string) {
    await api.updateSetting('operating_mode', mode);
    const refreshed = await api.settings();
    setSettings(refreshed);
  }

  return (
    <div>
      <h1>System / Settings</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <div className="panel">
        <h2>Operating Mode</h2>
        <p>Current: {String(settings?.operating_mode ?? '…')}</p>
        {['MANUAL', 'ASSISTED', 'AUTONOMOUS'].map((mode) => (
          <button key={mode} onClick={() => updateOperatingMode(mode)}>
            Set {mode}
          </button>
        ))}
      </div>

      <div className="panel">
        <h2>Safety Limits</h2>
        <pre>{JSON.stringify(settings?.safety_limits, null, 2)}</pre>
      </div>

      <div className="panel">
        <h2>Fee Settings</h2>
        <pre>{JSON.stringify(settings?.fee_settings, null, 2)}</pre>
      </div>

      <div className="panel">
        <h2>Scoring Weights</h2>
        <pre>{JSON.stringify(settings?.scoring_weights, null, 2)}</pre>
      </div>

      <div className="panel">
        <h2>Trigger Jobs (for testing)</h2>
        {JOB_TYPES.map((t) => (
          <button key={t} onClick={() => triggerJob(t)}>
            Run {t}
          </button>
        ))}
        {jobResult && <pre>{JSON.stringify(jobResult, null, 2)}</pre>}
      </div>
    </div>
  );
}
