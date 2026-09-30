const { fitModel, scoreModel } = require('./model');
function mlService({ enabled = true } = {}) {
  if (typeof enabled !== 'boolean') throw new TypeError('ML enabled must be boolean.');
  let model = null;
  const unavailable = () => ({ status: enabled ? 'unavailable' : 'disabled', scores: [] });
  return {
    fit(pipeline) {
      model = null; // Failed refits cannot retain stale baselines.
      if (!enabled) return unavailable();
      try {
        model = fitModel(pipeline);
        return { status: 'ready', model: structuredClone(model) };
      } catch { return unavailable(); }
    },
    score(pipeline) {
      if (!enabled || !model) return unavailable();
      try { return { status: 'ready', scores: scoreModel(model, pipeline) }; }
      catch {
        // Never substitute a zero/benign score or expose input/error contents.
        return unavailable();
      }
    }
  };
}
module.exports = { mlService };
