import { loadRoster } from "./loadRoster.js";

export async function routeQuery(query) {
  const roster = loadRoster();
  const rules = roster.routing.routing_rules || [];
  const threshold = roster.routing.confidence_threshold || 0.75;

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern, "i");
    if (pattern.test(query)) {
      const division = roster.divisions[rule.division];
      if (!division || !division.models || division.models.length === 0) continue;

      const model = division.models[0];
      return {
        received: query,
        routed_to: model.id,
        endpoint: model.api_endpoint,
        specialization: model.specialization,
        cost: model.cost_per_1k_tokens,
        latency_sla: model.latency_sla_ms,
        timestamp: Date.now()
      };
    }
  }

  return {
    received: query,
    routed_to: "fallback",
    message: "No matching rule found",
    timestamp: Date.now()
  };
}

